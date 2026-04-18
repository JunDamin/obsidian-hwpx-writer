/**
 * 파일 덮어쓰기 확인 모달.
 *
 * main.ts의 익명 `class extends (require("obsidian").Modal)` 를 대체한다.
 * 타입 체크 / 트리셰이킹 / 테스트 용이성 모두 확보.
 */
import { App, Modal } from "obsidian";

export class ConfirmOverwriteModal extends Modal {
  private resolved = false;
  private resolver: (v: boolean) => void;
  private readonly targetPath: string;

  constructor(app: App, targetPath: string, resolver: (v: boolean) => void) {
    super(app);
    this.targetPath = targetPath;
    this.resolver = resolver;
  }

  private safeResolve(val: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.resolver(val);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "파일이 이미 존재합니다" });
    contentEl.createEl("p", { text: this.targetPath });
    contentEl.createEl("p", { text: "덮어쓰시겠습니까?" });

    const btnRow = contentEl.createDiv({ cls: "hwpx-result-btns" });
    const yesBtn = btnRow.createEl("button", {
      text: "덮어쓰기",
      cls: "hwpx-editor-save-btn",
    });
    yesBtn.addEventListener("click", () => {
      this.safeResolve(true);
      this.close();
    });

    const noBtn = btnRow.createEl("button", {
      text: "취소",
      cls: "hwpx-editor-close-btn",
    });
    noBtn.addEventListener("click", () => {
      this.safeResolve(false);
      this.close();
    });
  }

  onClose(): void {
    // 버튼 선택 없이 닫힌 경우 = 취소로 간주
    this.safeResolve(false);
  }
}

/** 덮어쓰기 여부를 Promise<boolean>으로 반환. */
export function confirmOverwrite(app: App, targetPath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    new ConfirmOverwriteModal(app, targetPath, resolve).open();
  });
}
