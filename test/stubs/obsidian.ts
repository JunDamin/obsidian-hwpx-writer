/**
 * Obsidian API 스텁 — 테스트 환경에서 `import ... from "obsidian"`을 통과시키기 위한
 * 최소 구현. 실제 런타임 동작은 필요 없고 타입/심볼 해소 목적.
 */

export class App {}
export class Plugin {
  app: any = {};
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
  registerView() {}
  registerEvent() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
}
export class PluginSettingTab {
  containerEl: any = { empty() {}, createEl() { return {}; } };
  constructor(_app: any, _plugin: any) {}
  display() {}
  hide() {}
}
export class Setting {
  constructor(_containerEl: any) {}
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addDropdown() { return this; }
  addButton() { return this; }
  addSlider() { return this; }
  addColorPicker() { return this; }
  addTextArea() { return this; }
}
export class Modal {
  app: any;
  contentEl: any = { empty() {}, createEl() { return {}; } };
  constructor(app: any) { this.app = app; }
  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}
export class Notice {
  constructor(_msg: string, _timeout?: number) {}
  hide() {}
}
export class ItemView {
  contentEl: any = { empty() {}, createEl() { return {}; } };
  constructor(_leaf: any) {}
  getViewType() { return ""; }
  getDisplayText() { return ""; }
  onOpen() { return Promise.resolve(); }
  onClose() { return Promise.resolve(); }
}
export class WorkspaceLeaf {}
export class TFile {
  path: string = "";
  basename: string = "";
  extension: string = "";
}
export class MarkdownView {}
export const MarkdownRenderer = {
  render: () => Promise.resolve(),
  renderMarkdown: () => Promise.resolve(),
};

export function normalizePath(p: string): string { return p; }
