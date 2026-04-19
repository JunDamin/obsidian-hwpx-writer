/**
 * 본문 스타일 패널 — [본문] [리스트] [표] [코드] 탭 전환.
 * 리스트 탭 안에서 L1~L4 레벨별 스타일 서브탭.
 */

import type HwpxWriterPlugin from "../main";
import { addNumInput, addColorInput, addCheckbox } from "./FormControls";
import { TableBorderDesigner } from "./TableBorderDesigner";

export class BodyStylePanel {
  private currentTabIdx = 0;
  private currentLevelIdx = 0;

  constructor(private plugin: HwpxWriterPlugin) {}

  render(el: HTMLElement): void {
    const tabLabels = ["본문", "리스트", "표", "코드"];
    const tabRow = el.createDiv("hwpx-style-tabs");
    const panel = el.createDiv("hwpx-heading-panel");
    const buttons: HTMLButtonElement[] = [];

    for (let t = 0; t < tabLabels.length; t++) {
      const btn = tabRow.createEl("button", {
        text: tabLabels[t],
        cls: `hwpx-style-tab ${t === this.currentTabIdx ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.currentTabIdx = t;
        buttons.forEach((b, bi) => b.toggleClass("active", bi === t));
        this.renderTab(panel);
      });
      buttons.push(btn);
    }

    this.renderTab(panel);
  }

  private renderTab(panel: HTMLElement): void {
    panel.empty();
    switch (this.currentTabIdx) {
      case 0: this.renderBodyTab(panel); break;
      case 1: this.renderListTab(panel); break;
      case 2: this.renderTableTab(panel); break;
      case 3: this.renderCodeTab(panel); break;
    }
  }

  // ── 본문 탭 ──
  private renderBodyTab(panel: HTMLElement): void {
    const s = this.plugin.settings;

    // 미리보기
    const preview = panel.createDiv("hwpx-heading-preview");
    const previewText = preview.createEl("div", { cls: "hwpx-heading-preview-text" });
    const updatePreview = () => {
      const latest = this.plugin.settings;
      const fontName = latest.fontHangul || "맑은 고딕";
      previewText.setText("본문 미리보기 텍스트");
      previewText.setCssProps({
        "--hwpx-preview-font-size": `${latest.bodyFontSize}pt`,
        "--hwpx-preview-font-weight": "400",
        "--hwpx-preview-font-family": `"${fontName}", sans-serif`,
      });
    };
    updatePreview();

    // 한글 폰트
    const hangulRow = panel.createDiv("hwpx-setting-row");
    hangulRow.createEl("span", { text: "한글 폰트" });
    const hangulInput = hangulRow.createEl("input", {
      cls: "hwpx-text-input", value: s.fontHangul,
      attr: { placeholder: "맑은 고딕" },
    });
    hangulInput.addEventListener("change", () => {
      this.plugin.settings.fontHangul = hangulInput.value;
      void this.plugin.saveSettings();
      updatePreview();
    });

    // 영문 폰트
    const latinRow = panel.createDiv("hwpx-setting-row");
    latinRow.createEl("span", { text: "영문 폰트" });
    const latinInput = latinRow.createEl("input", {
      cls: "hwpx-text-input", value: s.fontLatin,
      attr: { placeholder: s.fontHangul || "맑은 고딕" },
    });
    latinInput.addEventListener("change", () => {
      this.plugin.settings.fontLatin = latinInput.value;
      void this.plugin.saveSettings();
      updatePreview();
    });

    // 크기
    const sizeRow = panel.createDiv("hwpx-setting-row");
    sizeRow.createEl("span", { text: "크기" });
    const sizeInput = sizeRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm", value: String(s.bodyFontSize),
    });
    sizeInput.addEventListener("change", () => {
      this.plugin.settings.bodyFontSize = Number(sizeInput.value) || 10;
      void this.plugin.saveSettings();
      updatePreview();
    });
    sizeRow.createEl("span", { text: "Pt", cls: "hwpx-unit" });

    // 줄간격
    const lsRow = panel.createDiv("hwpx-setting-row");
    lsRow.createEl("span", { text: "줄간격" });
    const lsInput = lsRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm", value: String(s.lineSpacing),
    });
    lsInput.addEventListener("change", () => {
      this.plugin.settings.lineSpacing = Number(lsInput.value) || 160;
      void this.plugin.saveSettings();
      updatePreview();
    });
    lsRow.createEl("span", { text: "%", cls: "hwpx-unit" });

    // 정렬
    const alignRow = panel.createDiv("hwpx-setting-row");
    alignRow.createEl("span", { text: "정렬" });
    const alignBtns = alignRow.createDiv("hwpx-btn-group");
    for (const [label, val] of [["양쪽", "JUSTIFY"], ["좌", "LEFT"], ["중앙", "CENTER"], ["우", "RIGHT"]] as const) {
      const btn = alignBtns.createEl("button", {
        text: label,
        cls: `hwpx-toggle-btn ${s.bodyAlign === val ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.plugin.settings.bodyAlign = val;
        void this.plugin.saveSettings();
        alignBtns.querySelectorAll("button").forEach(b => b.removeClass("active"));
        btn.addClass("active");
        updatePreview();
      });
    }

    // 들여쓰기
    const indentRow = panel.createDiv("hwpx-setting-row");
    indentRow.createEl("span", { text: "들여쓰기" });
    addNumInput(indentRow, s.bodyIndent, "mm", this.plugin, (v) => { this.plugin.settings.bodyIndent = v; });

    // 간격
    const spRow = panel.createDiv("hwpx-setting-row");
    spRow.createEl("span", { text: "간격" });
    spRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    addNumInput(spRow, s.bodySpacingBefore, "mm", this.plugin, (v) => { this.plugin.settings.bodySpacingBefore = v; });
    spRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    addNumInput(spRow, s.bodySpacingAfter, "mm", this.plugin, (v) => { this.plugin.settings.bodySpacingAfter = v; });
  }

  // ── 리스트 탭 ──
  private renderListTab(panel: HTMLElement): void {
    const s = this.plugin.settings;

    // 공통 설정
    const commonRow = panel.createDiv("hwpx-setting-row");
    commonRow.createEl("span", { text: "들여쓰기/레벨" });
    addNumInput(commonRow, s.listIndentPerLevel, "mm", this.plugin, (v) => { this.plugin.settings.listIndentPerLevel = v; });

    // 레벨 탭 L1~L4
    const tabRow = panel.createDiv("hwpx-style-tabs");
    const levelPanel = panel.createDiv("hwpx-heading-panel");
    const buttons: HTMLButtonElement[] = [];

    for (let l = 0; l < 4; l++) {
      const btn = tabRow.createEl("button", {
        text: `L${l + 1}`,
        cls: `hwpx-style-tab ${l === this.currentLevelIdx ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.currentLevelIdx = l;
        buttons.forEach((b, bi) => b.toggleClass("active", bi === l));
        this.renderListLevel(levelPanel);
      });
      buttons.push(btn);
    }

    this.renderListLevel(levelPanel);
  }

  private renderListLevel(panel: HTMLElement): void {
    panel.empty();
    const li = this.currentLevelIdx;
    const s = this.plugin.settings;
    const ls = s.listLevelStyles[li];
    if (!ls) return;

    // 미리보기
    const preview = panel.createDiv("hwpx-heading-preview");
    const previewText = preview.createEl("div", { cls: "hwpx-heading-preview-text" });
    const updatePreview = () => {
      const latest = this.plugin.settings.listLevelStyles[li];
      const fontName = latest.fontName || this.plugin.settings.fontHangul || "맑은 고딕";
      const size = latest.fontSize || this.plugin.settings.bodyFontSize;
      previewText.setText(`${latest.bulletChar} 리스트 항목`);
      previewText.setCssProps({
        "--hwpx-preview-font-size": `${size}pt`,
        "--hwpx-preview-font-family": `"${fontName}", sans-serif`,
      });
    };
    updatePreview();

    // 글머리표
    const bulletRow = panel.createDiv("hwpx-setting-row");
    bulletRow.createEl("span", { text: "글머리표" });
    const bulletInput = bulletRow.createEl("input", {
      cls: "hwpx-text-input", value: ls.bulletChar,
    });
    bulletInput.addEventListener("change", () => {
      this.plugin.settings.listLevelStyles[li].bulletChar = bulletInput.value;
      void this.plugin.saveSettings();
      updatePreview();
    });

    // 폰트
    const fontRow = panel.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트" });
    const fontInput = fontRow.createEl("input", {
      type: "text", cls: "hwpx-text-input",
      value: ls.fontName || "",
      attr: { placeholder: `(본문: ${s.fontHangul || "맑은 고딕"})` },
    });
    fontInput.addEventListener("change", () => {
      this.plugin.settings.listLevelStyles[li].fontName = fontInput.value;
      void this.plugin.saveSettings();
      updatePreview();
    });

    // 크기
    const sizeRow = panel.createDiv("hwpx-setting-row");
    sizeRow.createEl("span", { text: "크기" });
    const sizeInput = sizeRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm",
      value: String(ls.fontSize),
    });
    sizeInput.addEventListener("change", () => {
      this.plugin.settings.listLevelStyles[li].fontSize = Number(sizeInput.value) || 0;
      void this.plugin.saveSettings();
      updatePreview();
    });
    sizeRow.createEl("span", { text: "Pt", cls: "hwpx-unit" });
  }

  // ── 표 탭 ──
  private renderTableTab(panel: HTMLElement): void {
    const s = this.plugin.settings;

    // 머리행
    panel.createEl("div", { text: "머리행", cls: "hwpx-label" });
    const hdrRow = panel.createDiv("hwpx-setting-row");
    hdrRow.createEl("span", { text: "배경" });
    addColorInput(hdrRow, s.tableHeaderBgColor, this.plugin, (v) => { this.plugin.settings.tableHeaderBgColor = v; });
    addNumInput(hdrRow, s.tableHeaderFontSize, "pt", this.plugin, (v) => { this.plugin.settings.tableHeaderFontSize = v; });
    const hdrBoldBtn = hdrRow.createEl("button", {
      text: "B", cls: `hwpx-toggle-btn hwpx-bold-btn ${s.tableHeaderBold ? "active" : ""}`,
    });
    hdrBoldBtn.addEventListener("click", () => {
      this.plugin.settings.tableHeaderBold = !this.plugin.settings.tableHeaderBold;
      hdrBoldBtn.toggleClass("active", this.plugin.settings.tableHeaderBold);
      void this.plugin.saveSettings();
    });

    // 본문 크기
    const bodyRow = panel.createDiv("hwpx-setting-row");
    bodyRow.createEl("span", { text: "본문" });
    addNumInput(bodyRow, s.tableBodyFontSize, "pt", this.plugin, (v) => { this.plugin.settings.tableBodyFontSize = v; });

    // 반복
    const repeatRow = panel.createDiv("hwpx-setting-row");
    addCheckbox(repeatRow, s.tableRepeatHeader, "머리행 반복", this.plugin, (v) => { this.plugin.settings.tableRepeatHeader = v; });

    // 테두리 디자이너 — 7개 구간별 {종류, 색, 굵기} 독립 지정
    panel.createEl("div", { text: "테두리", cls: "hwpx-label" });
    new TableBorderDesigner(this.plugin).render(panel);

    // 셀 여백
    const padRow = panel.createDiv("hwpx-setting-row");
    padRow.createEl("span", { text: "셀 여백" });
    padRow.createEl("span", { text: "좌우", cls: "hwpx-unit" });
    addNumInput(padRow, s.tableCellPaddingH, "mm", this.plugin, (v) => { this.plugin.settings.tableCellPaddingH = v; });
    padRow.createEl("span", { text: "상하", cls: "hwpx-unit" });
    addNumInput(padRow, s.tableCellPaddingV, "mm", this.plugin, (v) => { this.plugin.settings.tableCellPaddingV = v; });
  }

  // ── 코드 탭 ──
  private renderCodeTab(panel: HTMLElement): void {
    const s = this.plugin.settings;

    const fontRow = panel.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트" });
    const fontInput = fontRow.createEl("input", { cls: "hwpx-text-input", value: s.codeFontName });
    fontInput.addEventListener("change", () => {
      this.plugin.settings.codeFontName = fontInput.value;
      void this.plugin.saveSettings();
    });

    const fsRow = panel.createDiv("hwpx-setting-row");
    fsRow.createEl("span", { text: "크기" });
    addNumInput(fsRow, s.codeFontSize, "pt", this.plugin, (v) => { this.plugin.settings.codeFontSize = v; });
  }
}
