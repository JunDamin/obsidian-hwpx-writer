/**
 * 헤딩 스타일 패널 — H1~H6 탭 + 각 레벨 상세 스타일.
 */

import { Notice } from "obsidian";
import type HwpxWriterPlugin from "../main";
import { addNumInput } from "./FormControls";

export class HeadingStylePanel {
  private currentIdx = 0;

  constructor(private plugin: HwpxWriterPlugin) {}

  render(el: HTMLElement): void {
    const tabRow = el.createDiv("hwpx-heading-tabs");
    const panel = el.createDiv("hwpx-heading-panel");
    const buttons: HTMLButtonElement[] = [];

    for (let i = 0; i < 6; i++) {
      const btn = tabRow.createEl("button", {
        text: `H${i + 1}`,
        cls: `hwpx-heading-tab ${i === this.currentIdx ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.currentIdx = i;
        buttons.forEach((b, bi) => b.toggleClass("active", bi === i));
        this.renderPanel(panel);
      });
      buttons.push(btn);
    }

    this.renderPanel(panel);
  }

  private renderPanel(panel: HTMLElement): void {
    panel.empty();
    const i = this.currentIdx;
    const s = this.plugin.settings;
    const hs = s.headingStyles[i];
    if (!hs) return;

    // 미리보기
    const preview = panel.createDiv("hwpx-heading-preview");
    const previewText = preview.createEl("div", { cls: "hwpx-heading-preview-text" });
    const updatePreview = () => {
      const latest = this.plugin.settings.headingStyles[i];
      const fontName = latest.fontName || this.plugin.settings.fontHangul || "맑은 고딕";
      previewText.setText(`H${i + 1} 헤딩 미리보기`);
      previewText.style.fontSize = `${latest.fontSize}pt`;
      previewText.style.fontWeight = latest.bold ? "700" : "400";
      previewText.style.fontStyle = latest.italic ? "italic" : "normal";
      previewText.style.color = latest.color || "#000000";
      previewText.style.fontFamily = `"${fontName}", sans-serif`;
    };
    updatePreview();

    // 폰트
    const fontRow = panel.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트", cls: "hwpx-heading-field-label" });
    const fontInput = fontRow.createEl("input", {
      type: "text", cls: "hwpx-text-input",
      value: hs.fontName || "",
      attr: { placeholder: `(본문: ${s.fontHangul || "맑은 고딕"})` },
    });
    fontInput.addEventListener("input", async () => {
      this.plugin.settings.headingStyles[i].fontName = fontInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 크기 + 색상
    const sizeRow = panel.createDiv("hwpx-setting-row");
    sizeRow.createEl("span", { text: "크기", cls: "hwpx-heading-field-label" });
    const fsInput = sizeRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm", value: String(hs.fontSize),
    });
    fsInput.addEventListener("change", async () => {
      this.plugin.settings.headingStyles[i].fontSize = Number(fsInput.value) || 10;
      await this.plugin.saveSettings();
      updatePreview();
    });
    sizeRow.createEl("span", { text: "pt", cls: "hwpx-unit" });
    sizeRow.createEl("span", { text: "  색상", cls: "hwpx-heading-field-label" });
    const colorInput = sizeRow.createEl("input", {
      type: "color", cls: "hwpx-color-input", value: hs.color || "#000000",
    });
    colorInput.addEventListener("change", async () => {
      this.plugin.settings.headingStyles[i].color = colorInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 스타일 토글 (B / I / 페이지 나누기)
    const toggleRow = panel.createDiv("hwpx-setting-row");
    toggleRow.createEl("span", { text: "스타일", cls: "hwpx-heading-field-label" });
    const boldBtn = toggleRow.createEl("button", {
      text: "B", cls: `hwpx-toggle-btn hwpx-bold-btn ${hs.bold ? "active" : ""}`,
      attr: { title: "굵게" },
    });
    boldBtn.addEventListener("click", async () => {
      const v = !this.plugin.settings.headingStyles[i].bold;
      this.plugin.settings.headingStyles[i].bold = v;
      boldBtn.toggleClass("active", v);
      await this.plugin.saveSettings();
      updatePreview();
    });
    const italicBtn = toggleRow.createEl("button", {
      text: "I", cls: `hwpx-toggle-btn ${hs.italic ? "active" : ""}`,
      attr: { style: "font-style:italic", title: "기울임" },
    });
    italicBtn.addEventListener("click", async () => {
      const v = !this.plugin.settings.headingStyles[i].italic;
      this.plugin.settings.headingStyles[i].italic = v;
      italicBtn.toggleClass("active", v);
      await this.plugin.saveSettings();
      updatePreview();
    });
    const pbBtn = toggleRow.createEl("button", {
      text: "↵ 페이지", cls: `hwpx-toggle-btn ${hs.pageBreakBefore ? "active" : ""}`,
      attr: { title: "헤딩 앞에서 페이지 나누기" },
    });
    pbBtn.addEventListener("click", async () => {
      const v = !this.plugin.settings.headingStyles[i].pageBreakBefore;
      this.plugin.settings.headingStyles[i].pageBreakBefore = v;
      pbBtn.toggleClass("active", v);
      await this.plugin.saveSettings();
    });

    // 빈 줄 앞/뒤/높이
    const blankRow = panel.createDiv("hwpx-setting-row");
    blankRow.createEl("span", { text: "빈 줄", cls: "hwpx-heading-field-label" });
    blankRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    addNumInput(blankRow, hs.blankLinesBefore ?? 0, "", this.plugin, (v) => {
      this.plugin.settings.headingStyles[i].blankLinesBefore = v;
    });
    blankRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    addNumInput(blankRow, hs.blankLinesAfter ?? 0, "", this.plugin, (v) => {
      this.plugin.settings.headingStyles[i].blankLinesAfter = v;
    });
    blankRow.createEl("span", { text: "높이", cls: "hwpx-unit", attr: { title: "0=본문 크기 사용" } });
    addNumInput(blankRow, hs.blankLineHeight ?? 0, "pt", this.plugin, (v) => {
      this.plugin.settings.headingStyles[i].blankLineHeight = v;
    });

    // 문단 간격
    const spaceRow = panel.createDiv("hwpx-setting-row");
    spaceRow.createEl("span", { text: "문단 간격", cls: "hwpx-heading-field-label" });
    spaceRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    addNumInput(spaceRow, hs.spaceBefore ?? 0, "mm", this.plugin, (v) => {
      this.plugin.settings.headingStyles[i].spaceBefore = v;
    });
    spaceRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    addNumInput(spaceRow, hs.spaceAfter ?? 0, "mm", this.plugin, (v) => {
      this.plugin.settings.headingStyles[i].spaceAfter = v;
    });

    // 복사
    const copyRow = panel.createDiv("hwpx-setting-row");
    copyRow.createEl("span", { text: "복사", cls: "hwpx-heading-field-label" });
    for (let j = 0; j < 6; j++) {
      if (j === i) continue;
      const btn = copyRow.createEl("button", {
        text: `→H${j + 1}`, cls: "hwpx-toggle-btn",
        attr: { title: `현재 H${i + 1} 설정을 H${j + 1}에 복사` },
      });
      btn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[j] = { ...this.plugin.settings.headingStyles[i] };
        await this.plugin.saveSettings();
        new Notice(`H${i + 1} → H${j + 1} 복사 완료`);
      });
    }
  }
}
