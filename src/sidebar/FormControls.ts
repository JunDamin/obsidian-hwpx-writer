/**
 * 사이드바 각 패널이 공유하는 폼 컨트롤 헬퍼.
 * 값 변경 시 자동으로 plugin.saveSettings()를 호출한다.
 */

import type HwpxWriterPlugin from "../main";

export function addNumInput(
  parent: HTMLElement,
  value: number,
  unit: string,
  plugin: HwpxWriterPlugin,
  onChange: (v: number) => void,
): HTMLInputElement {
  const input = parent.createEl("input", {
    type: "number",
    cls: "hwpx-num-input-sm",
    value: String(value),
  });
  if (unit) parent.createEl("span", { text: unit, cls: "hwpx-unit" });
  input.addEventListener("change", () => {
    onChange(Number(input.value) || 0);
    void plugin.saveSettings();
  });
  return input;
}

export function addColorInput(
  parent: HTMLElement,
  value: string,
  plugin: HwpxWriterPlugin,
  onChange: (v: string) => void,
): HTMLInputElement {
  const input = parent.createEl("input", {
    type: "color",
    cls: "hwpx-color-input-sm",
    value,
  });
  input.addEventListener("change", () => {
    onChange(input.value);
    void plugin.saveSettings();
  });
  return input;
}

export function addCheckbox(
  parent: HTMLElement,
  value: boolean,
  label: string,
  plugin: HwpxWriterPlugin,
  onChange: (v: boolean) => void,
): HTMLInputElement {
  const cb = parent.createEl("input", { type: "checkbox" });
  cb.checked = value;
  parent.createEl("span", { text: ` ${label}`, cls: "hwpx-unit" });
  cb.addEventListener("change", () => {
    onChange(cb.checked);
    void plugin.saveSettings();
  });
  return cb;
}
