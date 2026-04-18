/**
 * Obsidian (Electron)에서는 window.prompt() / confirm()이 지원되지 않는다
 * ("prompt() is not supported" 에러). Modal 기반 유틸로 대체.
 */

import { App, Modal } from "obsidian";

/** 텍스트 입력 프롬프트. 취소 시 null. */
export function promptText(
  app: App,
  title: string,
  defaultValue: string = "",
  placeholder: string = "",
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const safe = (v: string | null) => { if (!resolved) { resolved = true; resolve(v); } };
    const modal = new (class extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: title });
        const input = contentEl.createEl("input", {
          type: "text",
          cls: "hwpx-text-input hwpx-prompt-input",
          value: defaultValue,
          attr: { placeholder },
        });
        setTimeout(() => { input.focus(); input.select(); }, 30);

        const btnRow = contentEl.createDiv({ cls: "hwpx-result-btns" });
        const okBtn = btnRow.createEl("button", {
          text: "확인", cls: "hwpx-editor-save-btn",
        });
        okBtn.addEventListener("click", () => { safe(input.value); this.close(); });

        const cancelBtn = btnRow.createEl("button", {
          text: "취소", cls: "hwpx-editor-close-btn",
        });
        cancelBtn.addEventListener("click", () => { safe(null); this.close(); });

        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault(); safe(input.value); this.close();
          } else if (e.key === "Escape") {
            e.preventDefault(); safe(null); this.close();
          }
        });
      }
      onClose() { safe(null); }
    })(app);
    modal.open();
  });
}

/** 예/아니오 확인. 취소 시 false. */
export function confirmModal(
  app: App,
  title: string,
  message: string,
  okLabel: string = "확인",
  cancelLabel: string = "취소",
): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const safe = (v: boolean) => { if (!resolved) { resolved = true; resolve(v); } };
    const modal = new (class extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: title });
        contentEl.createEl("p", { text: message });
        const btnRow = contentEl.createDiv({ cls: "hwpx-result-btns" });
        const okBtn = btnRow.createEl("button", {
          text: okLabel, cls: "hwpx-editor-save-btn",
        });
        okBtn.addEventListener("click", () => { safe(true); this.close(); });
        const cancelBtn = btnRow.createEl("button", {
          text: cancelLabel, cls: "hwpx-editor-close-btn",
        });
        cancelBtn.addEventListener("click", () => { safe(false); this.close(); });
      }
      onClose() { safe(false); }
    })(app);
    modal.open();
  });
}
