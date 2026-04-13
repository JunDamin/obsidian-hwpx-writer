import { ItemView, WorkspaceLeaf, MarkdownView } from "obsidian";
import type HwpxWriterPlugin from "./main";

export const VIEW_TYPE_HWPX = "hwpx-writer-view";

export class HwpxSidebarView extends ItemView {
  plugin: HwpxWriterPlugin;
  private previewEl: HTMLElement | null = null;
  private debounceTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: HwpxWriterPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_HWPX;
  }

  getDisplayText(): string {
    return "HWPX Writer";
  }

  getIcon(): string {
    return "file-output";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hwpx-sidebar");

    this.buildUI(container);

    // 파일 변경 감지
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.onActiveFileChange();
      })
    );
  }

  async onClose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private buildUI(container: HTMLElement) {
    // ── 미리보기 영역 ──
    const previewSection = container.createDiv("hwpx-preview-section");
    this.previewEl = previewSection.createDiv("hwpx-preview-canvas");
    this.previewEl.setText("미리보기 준비 중...");

    const previewNav = previewSection.createDiv("hwpx-preview-nav");
    previewNav.createEl("button", { text: "◀", cls: "hwpx-nav-btn" });
    previewNav.createEl("span", { text: "1/1 페이지", cls: "hwpx-page-info" });
    previewNav.createEl("button", { text: "▶", cls: "hwpx-nav-btn" });
    previewNav.createEl("button", { text: "🔄", cls: "hwpx-refresh-btn" })
      .addEventListener("click", () => this.refreshPreview());

    // ── 변환 버튼 ──
    const convertSection = container.createDiv("hwpx-convert-section");

    const templateRow = convertSection.createDiv("hwpx-template-row");
    templateRow.createEl("span", { text: "템플릿:" });
    const templateSelect = templateRow.createEl("select", { cls: "hwpx-template-select" });
    templateSelect.createEl("option", { text: "기본 양식", value: "default" });

    const exportBtn = convertSection.createEl("button", {
      text: "📄 HWPX로 내보내기",
      cls: "hwpx-export-btn",
    });
    exportBtn.addEventListener("click", () => this.plugin.exportCurrentFile());

    // ── 접이식 설정 섹션들 ──
    this.buildCollapsibleSection(container, "페이지 설정", (el) => {
      this.buildPageSettings(el);
    });

    this.buildCollapsibleSection(container, "스타일", (el) => {
      this.buildStyleSettings(el);
    });

    this.buildCollapsibleSection(container, "표 설정", (el) => {
      this.buildTableSettings(el);
    });

    this.buildCollapsibleSection(container, "템플릿 관리", (el) => {
      this.buildTemplateManager(el);
    });
  }

  private buildCollapsibleSection(
    parent: HTMLElement,
    title: string,
    buildContent: (el: HTMLElement) => void,
  ) {
    const section = parent.createDiv("hwpx-collapsible");
    const header = section.createDiv("hwpx-collapsible-header");
    const arrow = header.createEl("span", { text: "▶", cls: "hwpx-arrow" });
    header.createEl("span", { text: title });

    const content = section.createDiv("hwpx-collapsible-content");
    content.style.display = "none";
    buildContent(content);

    header.addEventListener("click", () => {
      const isOpen = content.style.display !== "none";
      content.style.display = isOpen ? "none" : "block";
      arrow.setText(isOpen ? "▶" : "▼");
    });
  }

  private buildPageSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 용지 크기 버튼 그룹
    const paperRow = el.createDiv("hwpx-setting-row");
    paperRow.createEl("span", { text: "용지" });
    const paperBtns = paperRow.createDiv("hwpx-btn-group");
    for (const size of ["A4", "B5", "Letter"] as const) {
      const btn = paperBtns.createEl("button", {
        text: size,
        cls: `hwpx-toggle-btn ${s.paperSize === size ? "active" : ""}`,
      });
      btn.addEventListener("click", async () => {
        this.plugin.settings.paperSize = size;
        await this.plugin.saveSettings();
        paperBtns.querySelectorAll("button").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    }

    // 방향 토글
    const dirRow = el.createDiv("hwpx-setting-row");
    dirRow.createEl("span", { text: "방향" });
    const dirBtns = dirRow.createDiv("hwpx-btn-group");
    for (const [label, val] of [["세로", false], ["가로", true]] as const) {
      const btn = dirBtns.createEl("button", {
        text: label,
        cls: `hwpx-toggle-btn ${s.landscape === val ? "active" : ""}`,
      });
      btn.addEventListener("click", async () => {
        this.plugin.settings.landscape = val;
        await this.plugin.saveSettings();
        dirBtns.querySelectorAll("button").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    }

    // 여백
    el.createEl("div", { text: "여백 (mm)", cls: "hwpx-label" });
    const marginGrid = el.createDiv("hwpx-margin-grid");
    for (const [label, key] of [
      ["좌", "marginLeft"], ["우", "marginRight"],
      ["상", "marginTop"], ["하", "marginBottom"],
    ] as const) {
      const cell = marginGrid.createDiv("hwpx-margin-cell");
      cell.createEl("span", { text: label });
      const input = cell.createEl("input", {
        type: "number",
        cls: "hwpx-num-input",
        value: String((s as any)[key]),
      });
      input.addEventListener("change", async () => {
        (this.plugin.settings as any)[key] = Number(input.value) || 15;
        await this.plugin.saveSettings();
      });
    }
  }

  private buildStyleSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 본문 폰트
    const fontRow = el.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "본문" });
    const fontInput = fontRow.createEl("input", {
      cls: "hwpx-text-input",
      value: s.bodyFont,
    });
    fontInput.addEventListener("change", async () => {
      this.plugin.settings.bodyFont = fontInput.value;
      await this.plugin.saveSettings();
    });
    const sizeInput = fontRow.createEl("input", {
      type: "number",
      cls: "hwpx-num-input-sm",
      value: String(s.bodyFontSize),
    });
    sizeInput.addEventListener("change", async () => {
      this.plugin.settings.bodyFontSize = Number(sizeInput.value) || 10;
      await this.plugin.saveSettings();
    });
    fontRow.createEl("span", { text: "pt", cls: "hwpx-unit" });

    // 줄간격
    const lsRow = el.createDiv("hwpx-setting-row");
    lsRow.createEl("span", { text: "줄간격" });
    const lsInput = lsRow.createEl("input", {
      type: "number",
      cls: "hwpx-num-input-sm",
      value: String(s.lineSpacing),
    });
    lsInput.addEventListener("change", async () => {
      this.plugin.settings.lineSpacing = Number(lsInput.value) || 160;
      await this.plugin.saveSettings();
    });
    lsRow.createEl("span", { text: "%", cls: "hwpx-unit" });

    // 헤딩 스타일 H1~H4
    el.createEl("hr");
    for (let i = 0; i < 4; i++) {
      const hs = s.headingStyles[i];
      const row = el.createDiv("hwpx-heading-row");
      row.createEl("span", { text: `H${i + 1}`, cls: "hwpx-heading-label" });

      const fsInput = row.createEl("input", {
        type: "number",
        cls: "hwpx-num-input-sm",
        value: String(hs.fontSize),
      });
      fsInput.addEventListener("change", async () => {
        this.plugin.settings.headingStyles[i].fontSize = Number(fsInput.value) || 10;
        await this.plugin.saveSettings();
      });
      row.createEl("span", { text: "pt", cls: "hwpx-unit" });

      const boldBtn = row.createEl("button", {
        text: "B",
        cls: `hwpx-toggle-btn hwpx-bold-btn ${hs.bold ? "active" : ""}`,
      });
      boldBtn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[i].bold = !this.plugin.settings.headingStyles[i].bold;
        boldBtn.toggleClass("active", this.plugin.settings.headingStyles[i].bold);
        await this.plugin.saveSettings();
      });

      const pbBtn = row.createEl("button", {
        text: "↵",
        cls: `hwpx-toggle-btn ${hs.pageBreakBefore ? "active" : ""}`,
        title: "페이지 나누기",
      });
      pbBtn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[i].pageBreakBefore =
          !this.plugin.settings.headingStyles[i].pageBreakBefore;
        pbBtn.toggleClass("active", this.plugin.settings.headingStyles[i].pageBreakBefore);
        await this.plugin.saveSettings();
      });
    }
  }

  private buildTableSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    const bgRow = el.createDiv("hwpx-setting-row");
    bgRow.createEl("span", { text: "머리행 배경" });
    const colorInput = bgRow.createEl("input", {
      type: "color",
      cls: "hwpx-color-input",
      value: s.tableHeaderBgColor,
    });
    colorInput.addEventListener("change", async () => {
      this.plugin.settings.tableHeaderBgColor = colorInput.value;
      await this.plugin.saveSettings();
    });

    const repeatRow = el.createDiv("hwpx-setting-row");
    const repeatCb = repeatRow.createEl("input", { type: "checkbox" });
    (repeatCb as HTMLInputElement).checked = s.tableRepeatHeader;
    repeatRow.createEl("span", { text: " 머리행 반복" });
    repeatCb.addEventListener("change", async () => {
      this.plugin.settings.tableRepeatHeader = (repeatCb as HTMLInputElement).checked;
      await this.plugin.saveSettings();
    });
  }

  private buildTemplateManager(el: HTMLElement) {
    const btnRow = el.createDiv("hwpx-btn-row");
    btnRow.createEl("button", { text: "+ 추가", cls: "hwpx-action-btn" });
    btnRow.createEl("button", { text: "📂 열기", cls: "hwpx-action-btn" });

    const list = el.createDiv("hwpx-template-list");
    const defaultItem = list.createDiv("hwpx-template-item active");
    defaultItem.createEl("span", { text: "• 기본 양식" });
    defaultItem.createEl("span", { text: "[활성]", cls: "hwpx-badge" });
  }

  private onActiveFileChange() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.file) {
      // 디바운스로 미리보기 업데이트
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => {
        this.refreshPreview();
      }, 1000);
    }
  }

  private async refreshPreview() {
    if (!this.previewEl) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
      this.previewEl.setText("Markdown 파일을 열어주세요.");
      return;
    }
    this.previewEl.setText(`미리보기: ${view.file.basename}\n(Phase 3에서 구현 예정)`);
  }
}
