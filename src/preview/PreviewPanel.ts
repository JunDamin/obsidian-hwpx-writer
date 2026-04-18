/**
 * 사이드바 최상단 미리보기 영역.
 *
 * 책임:
 * - 미리보기 캔버스(SVG 컨테이너) 렌더
 * - 페이지 네비게이션 (◀ / N / ▶)
 * - 실패 시 폴백 UI (한컴 열기 / 다시 시도 / 미리보기 끄기)
 * - 비활성 상태 UI (WASM 없음 / 반복 실패 / 설정 꺼짐)
 */

import { App, Notice } from "obsidian";
import { log } from "../logger";
import type HwpxWriterPlugin from "../main";
import type { EnvironmentInfo } from "../environment";
import { canUsePreview, openInHancom } from "../environment";
import { RhwpRenderer } from "./RhwpRenderer";
import { convertMarkdownToHwpx } from "../converter/MarkdownToHwpx";
import { parseFrontmatter, applyFrontmatterOverrides } from "../frontmatter";
import { resolveActiveTemplatePath } from "../converter/resolveTemplatePath";

/** 에러 → 사람이 읽을 수 있는 메시지. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export class PreviewPanel {
  private canvasEl: HTMLElement | null = null;
  private pageInfoEl: HTMLElement | null = null;
  private renderer: RhwpRenderer;
  private currentPage = 0;
  private lastHwpxBytes: Uint8Array | null = null;
  /** 세션당 미리보기 실패 Notice를 1회만 띄우기 위한 플래그. */
  private errorNoticeShown = false;

  constructor(
    private app: App,
    private plugin: HwpxWriterPlugin,
    private env: EnvironmentInfo | null,
    private onRebuildUI: () => void,
  ) {
    this.renderer = new RhwpRenderer(app, plugin.manifest.dir || "");
  }

  /** 사이드바 상단 영역 전체를 그린다 */
  render(parent: HTMLElement): void {
    const previewSection = parent.createDiv("hwpx-preview-section");
    this.canvasEl = previewSection.createDiv("hwpx-preview-canvas");

    const env = this.env;
    const previewEnabled = this.plugin.settings.showPreview && env && canUsePreview(env);

    if (!previewEnabled) {
      this.renderDisabledState();
    } else {
      this.canvasEl.setText("미리보기 준비 중... (🔄 버튼을 눌러 생성)");
    }

    // 페이지 네비게이션 (활성 시에만)
    if (previewEnabled) {
      const nav = previewSection.createDiv("hwpx-preview-nav");
      nav.createEl("button", { text: "◀", cls: "hwpx-nav-btn" })
        .addEventListener("click", () => this.prevPage());
      this.pageInfoEl = nav.createEl("span", { text: "- / -", cls: "hwpx-page-info" });
      nav.createEl("button", { text: "▶", cls: "hwpx-nav-btn" })
        .addEventListener("click", () => this.nextPage());
    }

    // 버튼 행
    const btnRow = previewSection.createDiv("hwpx-preview-btn-row");
    if (previewEnabled) {
      const refreshBtn = btnRow.createEl("button", {
        text: "🔄 미리보기 생성",
        cls: "hwpx-preview-btn",
      });
      refreshBtn.addEventListener("click", () => this.refresh());
    }

    // 한컴 / 외부 뷰어 버튼
    if (env?.electronAvailable) {
      const hancomBtn = btnRow.createEl("button", {
        text: env.hancomInstalled ? "🖨️ 한컴에서 미리보기" : "📄 외부 뷰어로 열기",
        cls: "hwpx-preview-btn",
      });
      hancomBtn.addEventListener("click", () => this.previewInHancom());
    }

    // 미리보기가 꺼진 경우 켜기 버튼
    if (!previewEnabled && env?.wasmAvailable) {
      const enableBtn = btnRow.createEl("button", {
        text: "🔄 미리보기 다시 켜기",
        cls: "hwpx-preview-btn",
      });
      enableBtn.addEventListener("click", () => {
        this.plugin.settings.showPreview = true;
        void this.plugin.saveSettings();
        if (this.env) this.env.renderFailCount = 0;
        this.onRebuildUI();
      });
    }
  }

  /** 미리보기 새로고침 — 현재 MD 파일 → HWPX → SVG 렌더 */
  async refresh(): Promise<void> {
    if (!this.canvasEl) return;

    const file = this.plugin.findMarkdownFile();
    if (!file) {
      this.canvasEl.setText("Markdown 파일을 열어주세요.");
      return;
    }

    this.canvasEl.setText("변환 중...");

    try {
      // Markdown → HWPX
      const markdown = await this.app.vault.read(file);
      const { frontmatter } = parseFrontmatter(markdown);
      const { settings, appliedKeys } = applyFrontmatterOverrides(this.plugin.settings, frontmatter);
      if (appliedKeys.length > 0) log.info("Frontmatter:", appliedKeys);

      // Preview 도 템플릿 경로를 동일하게 태움 — "미리보기와 실제 결과가 다른" 혼란 방지
      const templatePath = resolveActiveTemplatePath(this.app, this.plugin, settings);
      log.info("Preview conversion: templatePath =", templatePath);
      const hwpxBytes = await convertMarkdownToHwpx(markdown, settings, { templatePath });
      this.lastHwpxBytes = hwpxBytes;

      // WASM 초기화
      try {
        await this.renderer.initialize();
        if (this.env && this.env.wasmInitOk === null) this.env.wasmInitOk = true;
      } catch (e) {
        log.error("WASM init failed:", e);
        if (this.env) this.env.wasmInitOk = false;
        this.showFallback("WASM 초기화 실패", errorMessage(e));
        return;
      }

      // 문서 로드 + 첫 페이지 렌더
      await this.renderer.loadDocument(hwpxBytes);
      this.currentPage = 0;
      this.renderCurrentPage();
    } catch (error) {
      log.error("Preview error:", error);
      this.showFallback("미리보기 실패", errorMessage(error));
    }
  }

  private renderCurrentPage(): void {
    if (!this.canvasEl || !this.renderer.hasDocument) return;

    try {
      const svg = this.renderer.renderPageSvg(this.currentPage);
      this.canvasEl.empty();
      // @rhwp/core 가 생성한 SVG 문자열을 DOMParser 로 파싱 후 노드 삽입
      // (innerHTML 직접 사용은 Obsidian 가이드라인 권장 사항에 따라 회피)
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
      const svgRoot = parsed.documentElement;
      if (svgRoot && svgRoot.nodeName.toLowerCase() === "svg") {
        this.canvasEl.appendChild(svgRoot);
      }

      const svgEl = this.canvasEl.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("class", "hwpx-preview-svg");
      }

      if (this.env) this.env.renderFailCount = 0;
    } catch (e) {
      log.error("Render page failed:", e);
      if (this.env) this.env.renderFailCount++;
      this.showFallback(`페이지 ${this.currentPage + 1} 렌더링 실패`, errorMessage(e));
    }

    if (this.pageInfoEl) {
      this.pageInfoEl.setText(`${this.currentPage + 1}/${this.renderer.pageCount} 페이지`);
    }
  }

  private prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderCurrentPage();
    }
  }

  private nextPage(): void {
    if (this.currentPage < this.renderer.pageCount - 1) {
      this.currentPage++;
      this.renderCurrentPage();
    }
  }

  /** HWPX 변환 후 한컴/외부 뷰어로 열기 */
  private async previewInHancom(): Promise<void> {
    if (!this.env?.electronAvailable) {
      new Notice("이 환경에서는 외부 뷰어로 열 수 없습니다.");
      return;
    }
    const file = this.plugin.findMarkdownFile();
    if (!file) {
      new Notice("Markdown 파일을 열어주세요.");
      return;
    }
    try {
      new Notice("변환 중...");
      const markdown = await this.app.vault.read(file);
      const { frontmatter } = parseFrontmatter(markdown);
      const { settings } = applyFrontmatterOverrides(this.plugin.settings, frontmatter);
      const templatePath = resolveActiveTemplatePath(this.app, this.plugin, settings);
      const hwpxBytes = await convertMarkdownToHwpx(markdown, settings, { templatePath });
      this.lastHwpxBytes = hwpxBytes;
      const tmp = await openInHancom(hwpxBytes, file.basename);
      new Notice(`📄 열기 요청: ${tmp}`);
    } catch (e) {
      new Notice(`외부 뷰어 열기 실패: ${e}`);
    }
  }

  /** 미리보기 실패 시 환경별 폴백 UI */
  private showFallback(title: string, detail: string): void {
    if (!this.canvasEl) return;
    this.canvasEl.empty();
    const box = this.canvasEl.createDiv("hwpx-editor-fallback");
    box.createEl("h4", { text: `⚠️ ${title}` });

    // export는 정상 작동한다는 안내 (preview 단독 실패임을 명확히)
    box.createEl("p", {
      text: "ℹ️ HWPX 내보내기(export) 기능은 정상 작동합니다. 미리보기만 실패했습니다.",
      cls: "hwpx-preview-note",
    });

    box.createEl("p", { text: detail, cls: "hwpx-preview-msg" });

    // 세션당 1회 Notice — 사이드바를 보고 있지 않아도 알 수 있도록
    if (!this.errorNoticeShown) {
      this.errorNoticeShown = true;
      new Notice(`미리보기 실패 — ${title}. 내보내기는 정상 작동합니다.`, 6000);
    }

    const btnRow = box.createDiv("hwpx-result-btns");

    if (this.env?.electronAvailable) {
      const openBtn = btnRow.createEl("button", {
        text: this.env.hancomInstalled ? "🖨️ 한컴에서 열기" : "📄 외부 뷰어로 열기",
        cls: "hwpx-result-btn",
      });
      openBtn.addEventListener("click", () => { void (async () => {
        try {
          if (!this.lastHwpxBytes) {
            const file = this.plugin.findMarkdownFile();
            if (!file) { new Notice("Markdown 파일을 열어주세요."); return; }
            const md = await this.app.vault.read(file);
            const { frontmatter } = parseFrontmatter(md);
            const { settings } = applyFrontmatterOverrides(this.plugin.settings, frontmatter);
            const templatePath = resolveActiveTemplatePath(this.app, this.plugin, settings);
            this.lastHwpxBytes = await convertMarkdownToHwpx(md, settings, { templatePath });
          }
          const file = this.plugin.findMarkdownFile();
          await openInHancom(this.lastHwpxBytes, file?.basename || "preview");
        } catch (e) {
          new Notice(`열기 실패: ${e}`);
        }
      })(); });
    }

    const retryBtn = btnRow.createEl("button", { text: "🔄 다시 시도", cls: "hwpx-result-btn" });
    retryBtn.addEventListener("click", () => this.refresh());

    const disableBtn = btnRow.createEl("button", { text: "🚫 미리보기 끄기", cls: "hwpx-result-btn" });
    disableBtn.addEventListener("click", () => {
      this.plugin.settings.showPreview = false;
      void this.plugin.saveSettings();
      this.onRebuildUI();
      new Notice("미리보기를 껐습니다. 설정에서 다시 켤 수 있습니다.");
    });
  }

  /** 미리보기 비활성 상태 UI */
  private renderDisabledState(): void {
    if (!this.canvasEl) return;
    this.canvasEl.empty();
    const box = this.canvasEl.createDiv("hwpx-editor-fallback");

    const env = this.env;
    if (!env?.wasmAvailable) {
      box.createEl("h4", { text: "🔌 미리보기 불가" });
      box.createEl("p", { text: "rhwp_bg.wasm 파일이 플러그인 폴더에 없습니다." });
    } else if (env?.renderFailCount >= 3) {
      box.createEl("h4", { text: "⚠️ 렌더링이 반복 실패했습니다" });
      box.createEl("p", { text: "한컴오피스에서 직접 확인해 주세요." });
    } else {
      box.createEl("h4", { text: "💡 미리보기가 꺼져 있습니다" });
      box.createEl("p", { text: "환경 진단 결과 또는 설정에 따라 꺼진 상태입니다." });
    }

    // 환경 정보 요약
    if (env) {
      const detail = box.createEl("p", { cls: "hwpx-preview-detail" });
      const parts = [
        `플랫폼: ${env.platform}`,
        `WASM: ${env.wasmAvailable ? "있음" : "없음"}`,
        `한컴: ${env.hancomInstalled ? "설치됨" : "미확인"}`,
        `온라인: ${env.online ? "O" : "X"}`,
      ];
      detail.setText(parts.join(" · "));
    }
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
