import { Plugin, MarkdownView, TFile, Notice } from "obsidian";
import { log } from "./logger";
import * as path from "path";
import { HwpxSidebarView, VIEW_TYPE_HWPX } from "./HwpxSidebarView";
import { HwpxWriterSettings, DEFAULT_SETTINGS, HwpxSettingTab, migrateLegacySettings } from "./settings";
import { convertMarkdownToHwpx } from "./converter/MarkdownToHwpx";
import { parseFrontmatter, applyFrontmatterOverrides } from "./frontmatter";
import { TemplateStore } from "./templates/TemplateStore";
import { CURRENT_SAMPLE_VERSION } from "./templates/sampleTemplates";
import { resolveActiveTemplatePath } from "./converter/resolveTemplatePath";
import { confirmOverwrite } from "./ui/ConfirmOverwriteModal";

export default class HwpxWriterPlugin extends Plugin {
  settings: HwpxWriterSettings = DEFAULT_SETTINGS;

  async onload() {
    // 배포·빌드 식별용 마커 — 콘솔에서 이 메시지가 보이면 최신 코드가 로드된 것.
    log.info(
      "%c[HWPX Writer] Plugin loaded %cbuild=" + new Date().toISOString().slice(0, 19) + "%c",
      "color: white; background: #4A5568; padding: 2px 6px; border-radius: 3px;",
      "color: #4A5568; font-family: monospace;",
      "",
    );
    log.info("Template model: settings-import (apply via 📥 button)");

    await this.loadSettings();

    // 첫 실행(또는 템플릿 폴더가 비어있으면) 샘플 템플릿 자동 시드
    // 사용자가 의식적으로 삭제한 뒤에는 다시 만들지 않기 위해
    // 설정 플래그로 "한 번만" 실행하도록 함.
    await this.seedSampleTemplatesIfNeeded();

    // 사이드바 뷰 등록
    this.registerView(VIEW_TYPE_HWPX, (leaf) => new HwpxSidebarView(leaf, this));

    // 리본 아이콘 (사이드바 토글)
    this.addRibbonIcon("file-output", "HWPX Writer", () => {
      this.activateSidebarView();
    });

    // 커맨드: HWPX로 내보내기
    this.addCommand({
      id: "export-to-hwpx",
      name: "HWPX로 내보내기",
      callback: () => this.exportCurrentFile(),
    });

    // 커맨드: 사이드바 열기
    this.addCommand({
      id: "open-hwpx-sidebar",
      name: "HWPX Writer 패널 열기",
      callback: () => this.activateSidebarView(),
    });

    // 파일 메뉴에 "HWPX로 내보내기" 추가
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "md") {
          menu.addItem((item) => {
            item.setTitle("HWPX로 내보내기")
              .setIcon("file-output")
              .onClick(() => this.exportFile(file));
          });
        }
      })
    );

    // 설정 탭
    this.addSettingTab(new HwpxSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    const raw = await this.loadData();
    const migrated = migrateLegacySettings(raw);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, migrated);
  }

  /**
   * 샘플 템플릿 자동 시드 / 업그레이드.
   *
   * - 첫 실행: 폴더에 비파괴 시드, 플래그 설정
   * - 샘플 버전 업: 기존 샘플 파일이 남아있고 사용자가 편집하지 않았다고 판단되면
   *   새 버전으로 덮어쓰기. 사용자가 샘플을 모두 삭제한 상태라면 재시드하지 않음
   *   (의식적으로 지운 것 존중).
   */
  private async seedSampleTemplatesIfNeeded(): Promise<void> {
    try {
      const store = new TemplateStore(this.app, this);
      const currentVersion = this.settings.sampleTemplatesVersion || 0;

      if (!this.settings.sampleTemplatesSeeded) {
        // 첫 실행 — 비파괴 시드
        const added = await store.seedSampleTemplates();
        if (added > 0) {
          log.info(`Auto-seeded ${added} sample template(s) on first run.`);
        }
        this.settings.sampleTemplatesSeeded = true;
        this.settings.sampleTemplatesVersion = CURRENT_SAMPLE_VERSION;
        await this.saveSettings();
        return;
      }

      // 버전 업그레이드 — 이미 시드된 이력이 있고, 현재 폴더에 샘플 파일이 하나라도
      // 남아 있을 때만 덮어쓴다. 완전히 비어 있으면 사용자가 지운 것으로 보고 건드리지 않음.
      if (currentVersion < CURRENT_SAMPLE_VERSION && !store.isEmpty()) {
        // v3 이전의 자동 생성 샘플 4종 정리 (md2hwpx 컨벤션 미준수라 무의미)
        const pruned = await store.pruneLegacySampleTemplates();
        if (pruned.length > 0) {
          log.info(`Pruned ${pruned.length} legacy sample(s): ${pruned.join(", ")}`);
        }
        const written = await store.seedSampleTemplates({ force: true });
        log.info(
          `[HWPX Writer] Upgraded sample templates to v${CURRENT_SAMPLE_VERSION} ` +
          `(${written} written).`,
        );
        this.settings.sampleTemplatesVersion = CURRENT_SAMPLE_VERSION;
        await this.saveSettings();
      } else if (currentVersion < CURRENT_SAMPLE_VERSION) {
        // 폴더가 비어있으면 업그레이드 대신 버전만 갱신 (사용자가 완전 삭제한 것)
        this.settings.sampleTemplatesVersion = CURRENT_SAMPLE_VERSION;
        await this.saveSettings();
      }
    } catch (e) {
      log.warn("Sample template seed/upgrade failed:", e);
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateSidebarView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HWPX)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: VIEW_TYPE_HWPX, active: true });
        leaf = rightLeaf;
      }
    }
    if (leaf) workspace.revealLeaf(leaf);
  }

  async exportCurrentFile() {
    const file = this.findMarkdownFile();
    if (!file) {
      new Notice("변환할 Markdown 파일이 없습니다. .md 파일을 열어주세요.");
      return;
    }
    await this.exportFile(file);
  }

  /** 현재 열려있는 .md 파일을 찾는다 (사이드바 포커스 상태에서도 동작). */
  findMarkdownFile(): TFile | null {
    // 방법 1: 활성 MarkdownView
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file) return activeView.file;

    // 방법 2: 모든 leaf 순회하며 MarkdownView 찾기
    let found: TFile | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      if (leaf.view instanceof MarkdownView && leaf.view.file) {
        found = leaf.view.file;
      }
    });
    if (found) return found;

    // 방법 3: 최근 활성 파일
    const recentFile = this.app.workspace.getActiveFile();
    if (recentFile && recentFile.extension === "md") return recentFile;

    return null;
  }

  async exportFile(file: TFile) {
    new Notice(`변환 중: ${file.basename}...`);
    log.info("Converting:", file.path);

    // ── Phase 1: Markdown 읽기 ──────────────────────────────
    let markdown: string;
    try {
      markdown = await this.app.vault.read(file);
      log.info("Markdown length:", markdown.length);
    } catch (error) {
      this.reportExportError("읽기 실패", error, file);
      return;
    }

    // ── Phase 2: Markdown → HWPX 변환 ─────────────────────
    let hwpxBytes: Uint8Array;
    let effectiveSettings: HwpxWriterSettings;
    let outputPath: string;
    try {
      const { frontmatter } = parseFrontmatter(markdown);
      const applied = applyFrontmatterOverrides(this.settings, frontmatter);
      effectiveSettings = applied.settings;
      if (applied.appliedKeys.length > 0) {
        log.info("Frontmatter overrides:", applied.appliedKeys);
      }

      // 활성 템플릿 경로 — preview 와 동일 로직 공유
      const templatePath = resolveActiveTemplatePath(this.app, this, effectiveSettings);
      log.info("Export conversion: templatePath =", templatePath);

      hwpxBytes = await convertMarkdownToHwpx(markdown, effectiveSettings, { templatePath });
      log.info("HWPX bytes:", hwpxBytes.length);
      outputPath = this.getOutputPath(file, effectiveSettings);
      log.info("Output path:", outputPath);
    } catch (error) {
      this.reportExportError("변환 실패", error, file);
      return;
    }

    // ── Phase 3: 파일 저장 ──────────────────────────────
    try {
      const arrayBuffer = toArrayBuffer(hwpxBytes);

      // 이미 존재하면 확인 후 덮어쓰기, 없으면 생성
      const existing = this.app.vault.getAbstractFileByPath(outputPath);
      if (existing instanceof TFile) {
        const overwrite = await confirmOverwrite(this.app, outputPath);
        if (!overwrite) {
          new Notice("내보내기 취소됨");
          return;
        }
        await this.app.vault.modifyBinary(existing, arrayBuffer);
      } else {
        await this.app.vault.createBinary(outputPath, arrayBuffer);
      }
    } catch (error) {
      this.reportExportError("저장 실패", error, file, outputPath);
      return;
    }

    new Notice(`✅ 변환 완료: ${outputPath}`);

    // 사이드바에 결과 버튼 표시
    const sidebarLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HWPX);
    if (sidebarLeaves.length > 0) {
      const view = sidebarLeaves[0].view as HwpxSidebarView;
      const adapter = this.app.vault.adapter as any;
      const fullPath = path.join(adapter.basePath, outputPath);
      view.showExportResult(fullPath, outputPath);
    }
  }

  /**
   * 단계별 실패 리포팅 — 사용자가 해결할 수 있는 힌트를 주는 것이 목표.
   * Windows 에서 한컴이 파일을 열고 있으면 EBUSY/EPERM 발생하므로 전용 메시지 제공.
   */
  private reportExportError(
    phase: string,
    error: unknown,
    file: TFile,
    outputPath?: string,
  ): void {
    const err = error as { message?: string; code?: string };
    const msg = err?.message ?? String(error);
    const code = err?.code;

    // 파일 잠김 (한컴 등에서 열고 있는 경우)
    if (code === "EBUSY" || code === "EPERM" || /EBUSY|EPERM|locked|already in use/i.test(msg)) {
      new Notice(
        `❌ 저장 실패 — 파일이 사용 중입니다. 한컴오피스 등에서 "${outputPath ?? file.basename}.hwpx"를 닫고 다시 시도해 주세요.`,
        8000,
      );
    } else if (code === "ENOENT" || /no such file|directory does not exist/i.test(msg)) {
      new Notice(
        `❌ 저장 실패 — 출력 폴더가 없습니다: ${outputPath ?? "(경로 불명)"}. 설정의 출력 폴더를 확인해 주세요.`,
        8000,
      );
    } else {
      new Notice(`❌ ${phase}: ${msg}`, 6000);
    }
    log.error(`${phase}:`, error);
  }

  private getOutputPath(file: TFile, settings: HwpxWriterSettings = this.settings): string {
    const folder = settings.outputFolder || file.parent?.path || "";
    const name = `${file.basename}.hwpx`;
    if (!folder || folder === "/" || folder === ".") return name;
    return `${folder}/${name}`;
  }
}

/**
 * Uint8Array 를 독립된 ArrayBuffer 로 복사한다.
 *
 * TypeScript 의 lib.dom / lib.es2017 에서 Uint8Array.buffer 타입이
 * `ArrayBuffer | SharedArrayBuffer` 로 확장되어, `vault.createBinary`/`modifyBinary`
 * 가 요구하는 순수 `ArrayBuffer` 와 호환되지 않는다. 새 버퍼에 복사해서 타입과
 * 수명 문제를 동시에 해결한다.
 */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}
