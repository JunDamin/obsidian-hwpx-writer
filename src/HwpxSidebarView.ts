import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { shell } from "electron";
import { log } from "./logger";
import type HwpxWriterPlugin from "./main";
import { detectEnvironment, EnvironmentInfo } from "./environment";

import { PreviewPanel } from "./preview/PreviewPanel";
import { buildPageSettingsPanel } from "./sidebar/PageSettingsPanel";
import { HeadingStylePanel } from "./sidebar/HeadingStylePanel";
import { BodyStylePanel } from "./sidebar/BodyStylePanel";
import { PresetManager } from "./sidebar/PresetManager";
import { TemplateManager } from "./sidebar/TemplateManager";
import { readTemplate } from "./converter/TemplateReader";
import { extractSettingsFromTemplate } from "./converter/extractSettingsFromTemplate";

export const VIEW_TYPE_HWPX = "hwpx-writer-view";

/**
 * HWPX Writer 사이드바 뷰.
 * 각 기능 패널을 조립하고 공유 상태(expanded 섹션)만 관리한다.
 */
export class HwpxSidebarView extends ItemView {
  plugin: HwpxWriterPlugin;
  private env: EnvironmentInfo | null = null;
  private resultEl: HTMLElement | null = null;
  // 프리셋·템플릿 섹션은 기본 펼침 — 사용자가 자주 접근하는 영역
  private expandedSections = new Set<string>(["🎨 프리셋", "📋 템플릿"]);

  // 패널 인스턴스 — 탭/레벨 등 로컬 상태를 유지하기 위해 재빌드 중에도 보존
  private preview: PreviewPanel | null = null;
  private headingPanel: HeadingStylePanel;
  private bodyStylePanel: BodyStylePanel;
  private presetManager: PresetManager;
  private templateManager: TemplateManager;

  constructor(leaf: WorkspaceLeaf, plugin: HwpxWriterPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.headingPanel = new HeadingStylePanel(plugin);
    this.bodyStylePanel = new BodyStylePanel(plugin);
    this.presetManager = new PresetManager(plugin, () => this.rebuildUI());
    this.templateManager = new TemplateManager(
      plugin,
      () => this.rebuildUI(),
      async (id) => { await this.applyTemplateToSettings(id); },
    );
  }

  getViewType(): string { return VIEW_TYPE_HWPX; }
  getDisplayText(): string { return "Hwpx writer"; }
  getIcon(): string { return "file-output"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hwpx-sidebar");

    this.env = detectEnvironment(this.app, this.plugin.manifest.dir || "");
    log.info("Environment:", this.env);

    this.buildUI(container);
  }

  onClose(): void {
    this.preview?.dispose();
  }

  /** 전체 사이드바 UI 조립 */
  private buildUI(container: HTMLElement): void {
    // ── 미리보기 영역 ──
    this.preview = new PreviewPanel(this.app, this.plugin, this.env, () => this.rebuildUI());
    this.preview.render(container);

    // ── 변환 버튼 영역 ──
    const convertSection = container.createDiv("hwpx-convert-section");

    // 내보내기 버튼
    const exportBtn = convertSection.createEl("button", {
      text: "📄 Hwpx로 내보내기",
      cls: "hwpx-export-btn",
    });
    exportBtn.addEventListener("click", () => { void (async () => {
      exportBtn.disabled = true;
      exportBtn.setText("변환 중...");
      try {
        await this.plugin.exportCurrentFile();
      } finally {
        exportBtn.disabled = false;
        exportBtn.setText("📄 Hwpx로 내보내기");
      }
    })(); });

    // 내보내기 결과 영역
    this.resultEl = convertSection.createDiv("hwpx-result-section");
    this.resultEl.addClass("hwpx-hidden");

    // ── 🎨 프리셋 통합 섹션 (선택 + 관리) ──
    this.buildCollapsibleSection(container, "🎨 프리셋", (el) => {
      // 선택 드롭다운 + 저장/내보내기/불러오기/삭제
      this.presetManager.renderSelector(el);
      // 구분선
      el.createDiv("hwpx-divider");
      // 상세 관리 (프리셋 목록 + 각각에 대한 액션)
      this.presetManager.renderDetailedManager(el);
    });

    // ── 📋 템플릿 통합 섹션 (선택 + 관리) ──
    this.buildCollapsibleSection(container, "📋 템플릿", (el) => {
      // 템플릿 선택 드롭다운 + 값 불러오기 버튼
      this.renderTemplateDropdown(el);
      // 구분선
      el.createDiv("hwpx-divider");
      // 설명 힌트
      el.createDiv("hwpx-hint").setText(
        "💡 '적용' 버튼을 누르면 템플릿 스타일이 설정값으로 복사됩니다. " +
        "'본문 스타일' 등 설정에서 값이 바뀐 걸 확인할 수 있습니다.",
      );
      // 템플릿 관리 (상단 버튼 행 + 목록)
      this.templateManager.render(el);
    });

    // ── 페이지·헤딩·본문 스타일 설정 섹션들 ──
    this.buildCollapsibleSection(container, "페이지 설정", (el) => {
      buildPageSettingsPanel(el, this.plugin);
    });

    this.buildCollapsibleSection(container, "헤딩 스타일", (el) => {
      this.headingPanel.render(el);
    });

    this.buildCollapsibleSection(container, "본문 스타일", (el) => {
      this.bodyStylePanel.render(el);
    });
  }

  /** 템플릿 드롭다운 + 📥 값 불러오기 버튼 — 📋 템플릿 섹션 맨 위에 배치. */
  private renderTemplateDropdown(parent: HTMLElement): void {
    const templateRow = parent.createDiv("hwpx-template-row");
    templateRow.createEl("span", { text: "활성 템플릿:" });
    const templateSelect = templateRow.createEl("select", {
      cls: "hwpx-template-select",
    });
    const templates = this.templateManager.list();
    templateSelect.createEl("option", { text: "— 사용 안 함 —", value: "" });
    for (const t of templates) {
      const opt = templateSelect.createEl("option", {
        text: t.name, value: t.id,
      });
      if (this.plugin.settings.activeTemplateId === t.id) opt.selected = true;
    }
    templateSelect.addEventListener("change", () => { void (async () => {
      const val = templateSelect.value;
      const newId = val || null;
      log.info("Template dropdown changed →", newId ?? "(none)");
      this.plugin.settings.activeTemplateId = newId;
      if (newId) await this.applyTemplateToSettings(newId);
      await this.plugin.saveSettings();
      this.rebuildUI();
    })(); });

    // 📥 값 불러오기 (현재 템플릿 재적용)
    if (this.plugin.settings.activeTemplateId) {
      const reapplyBtn = templateRow.createEl("button", {
        text: "📥 다시 불러오기",
        cls: "hwpx-reapply-btn",
        attr: { title: "현재 템플릿의 스타일을 설정에 다시 복사" },
      });
      reapplyBtn.addEventListener("click", () => { void (async () => {
        log.info("📥 REAPPLY BUTTON CLICKED");
        new Notice("📥 템플릿 값 불러오는 중...", 2000);
        try {
          const id = this.plugin.settings.activeTemplateId;
          if (!id) { new Notice("⚠️ 선택된 템플릿 없음"); return; }
          await this.applyTemplateToSettings(id);
          await this.plugin.saveSettings();
          this.rebuildUI();
        } catch (e) {
          log.error("Re-apply failed:", e);
          new Notice(`❌ 실패: ${e instanceof Error ? e.message : e}`);
        }
      })(); });
    }
  }

  /**
   * 템플릿의 스타일을 이 플러그인 settings 로 복사.
   * 템플릿 드롭다운에서 새 값을 선택할 때 호출. 결과: 사이드바의 설정 UI에
   * 표시되는 값이 템플릿 값으로 바뀌며, 이후 변환은 그 settings 로 진행.
   */
  private async applyTemplateToSettings(id: string): Promise<void> {
    log.info("━".repeat(60));
    log.info(`▶▶▶ applyTemplateToSettings START (id=${id})`);

    const info = this.templateManager.list().find(t => t.id === id);
    if (!info) {
      log.warn("✗ template not found in store");
      new Notice("❌ 템플릿을 찾을 수 없습니다.", 4000);
      return;
    }
    log.info(`Found template file: ${info.absPath}`);

    try {
      const meta = await readTemplate(info.absPath);
      log.info(
        `[HWPX Writer] Template parsed: headerXml=${meta.rawHeaderXml.length}B, ` +
        `placeholders paras=${meta.placeholderStyles.paragraphs.size} ` +
        `cells=${meta.placeholderStyles.cells.size} ` +
        `lists=${meta.placeholderStyles.lists.size}`,
      );

      if (!meta.rawHeaderXml) {
        log.warn("✗ Template has no header.xml — nothing to apply");
        new Notice("⚠️ 템플릿에 header.xml 이 없어 적용할 값이 없습니다.", 4000);
        return;
      }

      const { patch, summary } = extractSettingsFromTemplate(meta, meta.rawHeaderXml);
      log.info(`Extracted ${summary.length} fields from template:`);
      for (const line of summary) log.info(`  ▸ ${line}`);

      // 변경 전/후 비교 로그 — 무엇이 바뀌었는지 명확히
      for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
        const before = (this.plugin.settings as Record<string, unknown>)[key as string];
        const after = patch[key];
        const fmt = (v: unknown): string => {
          if (v === undefined) return "(undefined)";
          if (v === null) return "null";
          if (typeof v === "object") return `(object, ${Object.keys(v).length} keys)`;
          if (typeof v === "string") return v;
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          return "(unknown)";
        };
        log.info(`    ${String(key)}: ${fmt(before)} → ${fmt(after)}`);
      }

      Object.assign(this.plugin.settings, patch);
      log.info(`✓ Applied "${info.name}" to settings (${summary.length} fields)`);
      log.info("━".repeat(60));
      new Notice(
        `📋 "${info.name}" 스타일 적용됨 (${summary.length}개 항목)`,
        4000,
      );
    } catch (e) {
      log.error("✗ applyTemplateToSettings FAILED:", e);
      new Notice(`❌ 템플릿 적용 실패: ${e instanceof Error ? e.message : e}`, 4000);
    }
  }

  /** 접이식 섹션 공용 빌더 — expanded 상태는 rebuild 후에도 유지. */
  private buildCollapsibleSection(
    parent: HTMLElement,
    title: string,
    buildContent: (el: HTMLElement) => void,
  ): void {
    const section = parent.createDiv("hwpx-collapsible");
    const header = section.createDiv("hwpx-collapsible-header");
    const arrow = header.createEl("span", { text: "▶", cls: "hwpx-arrow" });
    header.createEl("span", { text: title });

    const content = section.createDiv("hwpx-collapsible-content");
    const wasExpanded = this.expandedSections.has(title);
    content.toggleClass("hwpx-hidden", !wasExpanded);
    arrow.setText(wasExpanded ? "▼" : "▶");
    buildContent(content);

    header.addEventListener("click", () => {
      const isOpen = !content.hasClass("hwpx-hidden");
      content.toggleClass("hwpx-hidden", isOpen);
      arrow.setText(isOpen ? "▶" : "▼");
      if (isOpen) {
        this.expandedSections.delete(title);
      } else {
        this.expandedSections.add(title);
      }
    });
  }

  /** UI 전체 재빌드 — 프리셋 적용 / 미리보기 켜기/끄기 시 호출 */
  private rebuildUI(): void {
    this.preview?.dispose();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hwpx-sidebar");
    this.buildUI(container);
  }

  /** 내보내기 결과 버튼 표시 (main.ts에서 호출) */
  showExportResult(fullPath: string, vaultPath: string): void {
    if (!this.resultEl) return;
    this.resultEl.empty();
    this.resultEl.removeClass("hwpx-hidden");

    const info = this.resultEl.createDiv("hwpx-result-info");
    info.createEl("span", { text: `✅ ${vaultPath}`, cls: "hwpx-result-path" });

    const btnRow = this.resultEl.createDiv("hwpx-result-btns");

    // 파일 열기
    const openFileBtn = btnRow.createEl("button", {
      text: "📄 파일 열기", cls: "hwpx-result-btn",
    });
    openFileBtn.addEventListener("click", () => {
      try {
        void shell.openPath(fullPath);
      } catch {
        new Notice("파일 열기 실패");
      }
    });

    // 폴더 열기
    const openFolderBtn = btnRow.createEl("button", {
      text: "📂 폴더 열기", cls: "hwpx-result-btn",
    });
    openFolderBtn.addEventListener("click", () => {
      try {
        shell.showItemInFolder(fullPath);
      } catch {
        new Notice("폴더 열기 실패");
      }
    });
  }
}
