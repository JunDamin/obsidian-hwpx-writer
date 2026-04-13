import { ItemView, WorkspaceLeaf, MarkdownView, Notice } from "obsidian";
import type HwpxWriterPlugin from "./main";
import { convertMarkdownToHwpx } from "./converter/MarkdownToHwpx";

export const VIEW_TYPE_HWPX = "hwpx-writer-view";

export class HwpxSidebarView extends ItemView {
  plugin: HwpxWriterPlugin;
  private previewEl: HTMLElement | null = null;
  private pageInfoEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;
  private debounceTimer: number | null = null;
  private currentPage = 0;
  private totalPages = 0;
  private rhwpDoc: any = null;
  private rhwpInitialized = false;

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
    previewNav.createEl("button", { text: "◀", cls: "hwpx-nav-btn" })
      .addEventListener("click", () => this.prevPage());
    this.pageInfoEl = previewNav.createEl("span", { text: "- / -", cls: "hwpx-page-info" });
    previewNav.createEl("button", { text: "▶", cls: "hwpx-nav-btn" })
      .addEventListener("click", () => this.nextPage());

    // 미리보기 생성 버튼 (수동)
    const previewBtnRow = previewSection.createDiv("hwpx-preview-btn-row");
    const previewBtn = previewBtnRow.createEl("button", {
      text: "🔄 미리보기 생성",
      cls: "hwpx-preview-btn",
    });
    previewBtn.addEventListener("click", () => this.refreshPreview());

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

    // ── 내보내기 결과 영역 ──
    this.resultEl = convertSection.createDiv("hwpx-result-section");
    this.resultEl.style.display = "none";

    // ── 접이식 설정 섹션들 ──
    this.buildCollapsibleSection(container, "글꼴", (el) => {
      this.buildFontSettings(el);
    });

    this.buildCollapsibleSection(container, "페이지 설정", (el) => {
      this.buildPageSettings(el);
    });

    this.buildCollapsibleSection(container, "스타일", (el) => {
      this.buildStyleSettings(el);
    });

    this.buildCollapsibleSection(container, "본문", (el) => {
      this.buildBodySettings(el);
    });

    this.buildCollapsibleSection(container, "리스트", (el) => {
      this.buildListSettings(el);
    });

    this.buildCollapsibleSection(container, "표 설정", (el) => {
      this.buildTableSettings(el);
    });

    this.buildCollapsibleSection(container, "코드 블록", (el) => {
      this.buildCodeSettings(el);
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

  private buildFontSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 본문 폰트
    el.createEl("div", { text: "본문", cls: "hwpx-label" });
    const bodyRow = el.createDiv("hwpx-setting-row");
    bodyRow.createEl("span", { text: "한글" });
    const hangulInput = bodyRow.createEl("input", { cls: "hwpx-text-input", value: s.fontHangul });
    hangulInput.addEventListener("change", async () => {
      this.plugin.settings.fontHangul = hangulInput.value;
      this.plugin.settings.bodyFont = hangulInput.value; // 동기화
      await this.plugin.saveSettings();
    });

    const latinRow = el.createDiv("hwpx-setting-row");
    latinRow.createEl("span", { text: "영문" });
    const latinInput = latinRow.createEl("input", { cls: "hwpx-text-input", value: s.fontLatin });
    latinInput.addEventListener("change", async () => {
      this.plugin.settings.fontLatin = latinInput.value;
      await this.plugin.saveSettings();
    });

    // 헤딩 폰트
    el.createEl("div", { text: "헤딩 (비어있으면 본문 폰트 사용)", cls: "hwpx-label" });
    const hHangulRow = el.createDiv("hwpx-setting-row");
    hHangulRow.createEl("span", { text: "한글" });
    const hHangulInput = hHangulRow.createEl("input", {
      cls: "hwpx-text-input", value: s.headingFontHangul,
      attr: { placeholder: s.fontHangul },
    });
    hHangulInput.addEventListener("change", async () => {
      this.plugin.settings.headingFontHangul = hHangulInput.value;
      await this.plugin.saveSettings();
    });

    const hLatinRow = el.createDiv("hwpx-setting-row");
    hLatinRow.createEl("span", { text: "영문" });
    const hLatinInput = hLatinRow.createEl("input", {
      cls: "hwpx-text-input", value: s.headingFontLatin,
      attr: { placeholder: s.fontLatin },
    });
    hLatinInput.addEventListener("change", async () => {
      this.plugin.settings.headingFontLatin = hLatinInput.value;
      await this.plugin.saveSettings();
    });

    // 코드 폰트 (참조)
    el.createEl("div", { text: "코드 블록 폰트는 '코드 블록' 섹션에서 설정", cls: "hwpx-label" });
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

    // 헤딩 스타일 H1~H6
    el.createEl("hr");
    for (let i = 0; i < 6; i++) {
      const hs = s.headingStyles[i];
      if (!hs) continue;

      // 행 1: H번호 + 크기 + B + I + 페이지나누기 + 색상
      const row = el.createDiv("hwpx-heading-row");
      row.createEl("span", { text: `H${i + 1}`, cls: "hwpx-heading-label" });

      const fsInput = row.createEl("input", {
        type: "number", cls: "hwpx-num-input-sm", value: String(hs.fontSize),
      });
      fsInput.addEventListener("change", async () => {
        this.plugin.settings.headingStyles[i].fontSize = Number(fsInput.value) || 10;
        await this.plugin.saveSettings();
      });
      row.createEl("span", { text: "pt", cls: "hwpx-unit" });

      const boldBtn = row.createEl("button", {
        text: "B", cls: `hwpx-toggle-btn hwpx-bold-btn ${hs.bold ? "active" : ""}`,
      });
      boldBtn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[i].bold = !this.plugin.settings.headingStyles[i].bold;
        boldBtn.toggleClass("active", this.plugin.settings.headingStyles[i].bold);
        await this.plugin.saveSettings();
      });

      const italicBtn = row.createEl("button", {
        text: "I", cls: `hwpx-toggle-btn ${hs.italic ? "active" : ""}`,
        attr: { style: "font-style:italic" },
      });
      italicBtn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[i].italic = !this.plugin.settings.headingStyles[i].italic;
        italicBtn.toggleClass("active", this.plugin.settings.headingStyles[i].italic);
        await this.plugin.saveSettings();
      });

      const pbBtn = row.createEl("button", {
        text: "↵", cls: `hwpx-toggle-btn ${hs.pageBreakBefore ? "active" : ""}`,
        title: "페이지 나누기",
      });
      pbBtn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[i].pageBreakBefore = !this.plugin.settings.headingStyles[i].pageBreakBefore;
        pbBtn.toggleClass("active", this.plugin.settings.headingStyles[i].pageBreakBefore);
        await this.plugin.saveSettings();
      });

      const colorInput = row.createEl("input", {
        type: "color", cls: "hwpx-color-input-sm", value: hs.color || "#000000",
      });
      colorInput.addEventListener("change", async () => {
        this.plugin.settings.headingStyles[i].color = colorInput.value;
        await this.plugin.saveSettings();
      });

      // 행 2: 빈줄 앞/뒤 + 빈줄 높이
      const row2 = el.createDiv("hwpx-heading-spacing");
      row2.createEl("span", { text: "  ", cls: "hwpx-heading-label" });
      row2.createEl("span", { text: "빈줄↑", cls: "hwpx-unit", attr: { title: "헤딩 앞 빈 줄 수" } });
      this.addNumInput(row2, hs.blankLinesBefore ?? 0, "", (v) => { this.plugin.settings.headingStyles[i].blankLinesBefore = v; });
      row2.createEl("span", { text: "↓", cls: "hwpx-unit", attr: { title: "헤딩 뒤 빈 줄 수" } });
      this.addNumInput(row2, hs.blankLinesAfter ?? 0, "", (v) => { this.plugin.settings.headingStyles[i].blankLinesAfter = v; });
      row2.createEl("span", { text: "높이", cls: "hwpx-unit", attr: { title: "빈 줄 높이 (pt, 0=본문크기)" } });
      this.addNumInput(row2, hs.blankLineHeight ?? 0, "pt", (v) => { this.plugin.settings.headingStyles[i].blankLineHeight = v; });

      // 행 3: 문단 간격 앞/뒤 (mm)
      const row3 = el.createDiv("hwpx-heading-spacing");
      row3.createEl("span", { text: "  ", cls: "hwpx-heading-label" });
      row3.createEl("span", { text: "간격↑", cls: "hwpx-unit" });
      this.addNumInput(row3, hs.spaceBefore ?? 0, "mm", (v) => { this.plugin.settings.headingStyles[i].spaceBefore = v; });
      row3.createEl("span", { text: "↓", cls: "hwpx-unit" });
      this.addNumInput(row3, hs.spaceAfter ?? 0, "mm", (v) => { this.plugin.settings.headingStyles[i].spaceAfter = v; });
    }
  }

  private buildTableSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 머리행
    el.createEl("div", { text: "머리행", cls: "hwpx-label" });
    const hdrRow = el.createDiv("hwpx-setting-row");
    hdrRow.createEl("span", { text: "배경" });
    this.addColorInput(hdrRow, s.tableHeaderBgColor, (v) => { this.plugin.settings.tableHeaderBgColor = v; });
    this.addNumInput(hdrRow, s.tableHeaderFontSize, "pt", (v) => { this.plugin.settings.tableHeaderFontSize = v; });
    const hdrBoldBtn = hdrRow.createEl("button", { text: "B", cls: `hwpx-toggle-btn hwpx-bold-btn ${s.tableHeaderBold ? "active" : ""}` });
    hdrBoldBtn.addEventListener("click", async () => {
      this.plugin.settings.tableHeaderBold = !this.plugin.settings.tableHeaderBold;
      hdrBoldBtn.toggleClass("active", this.plugin.settings.tableHeaderBold);
      await this.plugin.saveSettings();
    });

    // 본문 크기
    const bodyRow = el.createDiv("hwpx-setting-row");
    bodyRow.createEl("span", { text: "본문" });
    this.addNumInput(bodyRow, s.tableBodyFontSize, "pt", (v) => { this.plugin.settings.tableBodyFontSize = v; });

    // 반복
    const repeatRow = el.createDiv("hwpx-setting-row");
    this.addCheckbox(repeatRow, s.tableRepeatHeader, "머리행 반복", (v) => { this.plugin.settings.tableRepeatHeader = v; });

    // 테두리
    el.createEl("div", { text: "테두리", cls: "hwpx-label" });
    const borderRow = el.createDiv("hwpx-setting-row");
    const borderSelect = borderRow.createEl("select", { cls: "hwpx-select-sm" });
    for (const [val, label] of [["SOLID", "실선"], ["DASH", "파선"], ["DOT", "점선"], ["NONE", "없음"]]) {
      borderSelect.createEl("option", { text: label, value: val });
    }
    (borderSelect as HTMLSelectElement).value = s.tableBorderStyle;
    borderSelect.addEventListener("change", async () => {
      this.plugin.settings.tableBorderStyle = (borderSelect as HTMLSelectElement).value;
      await this.plugin.saveSettings();
    });
    this.addColorInput(borderRow, s.tableBorderColor, (v) => { this.plugin.settings.tableBorderColor = v; });

    // 셀 여백
    const padRow = el.createDiv("hwpx-setting-row");
    padRow.createEl("span", { text: "셀 여백" });
    padRow.createEl("span", { text: "좌우", cls: "hwpx-unit" });
    this.addNumInput(padRow, s.tableCellPaddingH, "mm", (v) => { this.plugin.settings.tableCellPaddingH = v; });
    padRow.createEl("span", { text: "상하", cls: "hwpx-unit" });
    this.addNumInput(padRow, s.tableCellPaddingV, "mm", (v) => { this.plugin.settings.tableCellPaddingV = v; });
  }

  // ── 헬퍼 메서드 ──

  private addNumInput(parent: HTMLElement, value: number, unit: string, onChange: (v: number) => void) {
    const input = parent.createEl("input", { type: "number", cls: "hwpx-num-input-sm", value: String(value) });
    parent.createEl("span", { text: unit, cls: "hwpx-unit" });
    input.addEventListener("change", async () => {
      onChange(Number(input.value) || 0);
      await this.plugin.saveSettings();
    });
    return input;
  }

  private addColorInput(parent: HTMLElement, value: string, onChange: (v: string) => void) {
    const input = parent.createEl("input", { type: "color", cls: "hwpx-color-input-sm", value });
    input.addEventListener("change", async () => {
      onChange(input.value);
      await this.plugin.saveSettings();
    });
    return input;
  }

  private addCheckbox(parent: HTMLElement, value: boolean, label: string, onChange: (v: boolean) => void) {
    const cb = parent.createEl("input", { type: "checkbox" });
    (cb as HTMLInputElement).checked = value;
    parent.createEl("span", { text: ` ${label}`, cls: "hwpx-unit" });
    cb.addEventListener("change", async () => {
      onChange((cb as HTMLInputElement).checked);
      await this.plugin.saveSettings();
    });
  }

  private buildBodySettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 정렬
    const alignRow = el.createDiv("hwpx-setting-row");
    alignRow.createEl("span", { text: "정렬" });
    const alignBtns = alignRow.createDiv("hwpx-btn-group");
    for (const [label, val] of [["양쪽", "JUSTIFY"], ["좌", "LEFT"], ["중앙", "CENTER"], ["우", "RIGHT"]] as const) {
      const btn = alignBtns.createEl("button", { text: label, cls: `hwpx-toggle-btn ${s.bodyAlign === val ? "active" : ""}` });
      btn.addEventListener("click", async () => {
        this.plugin.settings.bodyAlign = val;
        await this.plugin.saveSettings();
        alignBtns.querySelectorAll("button").forEach(b => b.removeClass("active"));
        btn.addClass("active");
      });
    }

    // 첫줄 들여쓰기
    const indentRow = el.createDiv("hwpx-setting-row");
    indentRow.createEl("span", { text: "첫줄 들여쓰기" });
    this.addNumInput(indentRow, s.bodyIndent, "mm", (v) => { this.plugin.settings.bodyIndent = v; });

    // 문단 간격
    const spRow = el.createDiv("hwpx-setting-row");
    spRow.createEl("span", { text: "간격" });
    spRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    this.addNumInput(spRow, s.bodySpacingBefore, "mm", (v) => { this.plugin.settings.bodySpacingBefore = v; });
    spRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    this.addNumInput(spRow, s.bodySpacingAfter, "mm", (v) => { this.plugin.settings.bodySpacingAfter = v; });
  }

  private buildListSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 글머리표 문자
    const bulletRow = el.createDiv("hwpx-setting-row");
    bulletRow.createEl("span", { text: "글머리표" });
    const bulletInput = bulletRow.createEl("input", { cls: "hwpx-text-input", value: s.listBulletChars });
    bulletInput.setAttribute("placeholder", "ㅇ,-,∙,●");
    bulletInput.addEventListener("change", async () => {
      this.plugin.settings.listBulletChars = bulletInput.value;
      await this.plugin.saveSettings();
    });

    // 들여쓰기
    const indentRow = el.createDiv("hwpx-setting-row");
    indentRow.createEl("span", { text: "들여쓰기/레벨" });
    this.addNumInput(indentRow, s.listIndentPerLevel, "mm", (v) => { this.plugin.settings.listIndentPerLevel = v; });

    // 글꼴 크기
    const fsRow = el.createDiv("hwpx-setting-row");
    fsRow.createEl("span", { text: "글꼴 크기" });
    this.addNumInput(fsRow, s.listFontSize, "pt", (v) => { this.plugin.settings.listFontSize = v; });
  }

  private buildCodeSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    const fontRow = el.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트" });
    const fontInput = fontRow.createEl("input", { cls: "hwpx-text-input", value: s.codeFontName });
    fontInput.addEventListener("change", async () => {
      this.plugin.settings.codeFontName = fontInput.value;
      await this.plugin.saveSettings();
    });

    const fsRow = el.createDiv("hwpx-setting-row");
    fsRow.createEl("span", { text: "크기" });
    this.addNumInput(fsRow, s.codeFontSize, "pt", (v) => { this.plugin.settings.codeFontSize = v; });
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


  /** 내보내기 결과 버튼 표시 */
  showExportResult(fullPath: string, vaultPath: string) {
    if (!this.resultEl) return;
    this.resultEl.empty();
    this.resultEl.style.display = "block";

    const info = this.resultEl.createDiv("hwpx-result-info");
    info.createEl("span", { text: `✅ ${vaultPath}`, cls: "hwpx-result-path" });

    const btnRow = this.resultEl.createDiv("hwpx-result-btns");

    // 파일 열기 (한컴오피스)
    const openFileBtn = btnRow.createEl("button", {
      text: "📄 파일 열기",
      cls: "hwpx-result-btn",
    });
    openFileBtn.addEventListener("click", () => {
      try {
        const { shell } = require("electron");
        shell.openPath(fullPath);
      } catch (e) {
        new Notice("파일 열기 실패");
      }
    });

    // 폴더 열기
    const openFolderBtn = btnRow.createEl("button", {
      text: "📂 폴더 열기",
      cls: "hwpx-result-btn",
    });
    openFolderBtn.addEventListener("click", () => {
      try {
        const { shell } = require("electron");
        shell.showItemInFolder(fullPath);
      } catch (e) {
        new Notice("폴더 열기 실패");
      }
    });
  }

  private async refreshPreview() {
    if (!this.previewEl) return;

    // 현재 Markdown 파일 찾기 (plugin의 공통 메서드 사용)
    const file = this.plugin.findMarkdownFile();
    if (!file) {
      this.previewEl.setText("Markdown 파일을 열어주세요.");
      return;
    }

    this.previewEl.setText("변환 중...");

    try {
      // Markdown → HWPX bytes
      const markdown = await this.app.vault.read(file);
      const hwpxBytes = await convertMarkdownToHwpx(markdown, this.plugin.settings);

      // @rhwp/core로 렌더링
      if (!this.rhwpInitialized) {
        try {
          const rhwp = await import("@rhwp/core");
          const wasmPath = this.app.vault.adapter.getResourcePath(
            `${this.plugin.manifest.dir}/rhwp_bg.wasm`
          );
          // WASM 초기화 시도
          await rhwp.default({ module_or_path: wasmPath });
          this.rhwpInitialized = true;
        } catch (e) {
          // WASM 초기화 실패 — initSync로 폴백
          try {
            const rhwp = await import("@rhwp/core");
            const fs = require("fs");
            const wasmBuffer = fs.readFileSync(
              require("path").join(
                (this.app.vault.adapter as any).basePath,
                ".obsidian/plugins/obsidian-hwpx-writer/rhwp_bg.wasm"
              )
            );
            rhwp.initSync({ module: wasmBuffer });
            this.rhwpInitialized = true;
          } catch (e2) {
            console.error("[HWPX Writer] WASM init failed:", e2);
            this.previewEl.setText(`미리보기 준비 실패\n(WASM 파일 필요)`);
            return;
          }
        }
      }

      // HwpDocument 생성 + SVG 렌더링
      const rhwp = await import("@rhwp/core");
      this.rhwpDoc = new rhwp.HwpDocument(hwpxBytes);
      this.totalPages = this.rhwpDoc.pageCount();
      this.currentPage = 0;

      this.renderCurrentPage();
    } catch (error) {
      console.error("[HWPX Writer] Preview error:", error);
      this.previewEl.setText(`미리보기 실패: ${error}`);
    }
  }

  private renderCurrentPage() {
    if (!this.previewEl || !this.rhwpDoc) return;

    try {
      const svg = this.rhwpDoc.renderPageSvg(this.currentPage);
      this.previewEl.empty();
      this.previewEl.innerHTML = svg;

      // SVG 크기 조정
      const svgEl = this.previewEl.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = "100%";
        svgEl.style.height = "auto";
      }
    } catch (e) {
      this.previewEl.setText(`페이지 렌더링 실패: ${e}`);
    }

    // 페이지 정보 업데이트
    if (this.pageInfoEl) {
      this.pageInfoEl.setText(`${this.currentPage + 1}/${this.totalPages} 페이지`);
    }
  }

  private prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderCurrentPage();
    }
  }

  private nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.renderCurrentPage();
    }
  }
}
