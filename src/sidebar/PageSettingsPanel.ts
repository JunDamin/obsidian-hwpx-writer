/**
 * 페이지 설정 패널 — 용지 크기, 방향, 여백.
 */

import type HwpxWriterPlugin from "../main";

export function buildPageSettingsPanel(el: HTMLElement, plugin: HwpxWriterPlugin): void {
  const s = plugin.settings;

  // 용지 크기
  const paperRow = el.createDiv("hwpx-setting-row");
  paperRow.createEl("span", { text: "용지" });
  const paperBtns = paperRow.createDiv("hwpx-btn-group");
  for (const size of ["A4", "B5", "Letter"] as const) {
    const btn = paperBtns.createEl("button", {
      text: size,
      cls: `hwpx-toggle-btn ${s.paperSize === size ? "active" : ""}`,
    });
    btn.addEventListener("click", async () => {
      plugin.settings.paperSize = size;
      await plugin.saveSettings();
      paperBtns.querySelectorAll("button").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
    });
  }

  // 방향
  const dirRow = el.createDiv("hwpx-setting-row");
  dirRow.createEl("span", { text: "방향" });
  const dirBtns = dirRow.createDiv("hwpx-btn-group");
  for (const [label, val] of [["세로", false], ["가로", true]] as const) {
    const btn = dirBtns.createEl("button", {
      text: label,
      cls: `hwpx-toggle-btn ${s.landscape === val ? "active" : ""}`,
    });
    btn.addEventListener("click", async () => {
      plugin.settings.landscape = val;
      await plugin.saveSettings();
      dirBtns.querySelectorAll("button").forEach((b) => b.removeClass("active"));
      btn.addClass("active");
    });
  }

  // 여백 (mm)
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
      (plugin.settings as any)[key] = Number(input.value) || 15;
      await plugin.saveSettings();
    });
  }
}
