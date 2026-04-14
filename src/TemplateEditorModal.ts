/**
 * 템플릿 편집 모달 — @rhwp/editor로 HWPX 템플릿을 직접 편집.
 */

import { Modal, App, Notice } from "obsidian";

export class TemplateEditorModal extends Modal {
  private editor: any = null;
  private templateData: ArrayBuffer | null;
  private templateName: string;
  private onSave: ((data: ArrayBuffer) => Promise<void>) | null;

  constructor(
    app: App,
    templateData: ArrayBuffer | null,
    templateName: string,
    onSave?: (data: ArrayBuffer) => Promise<void>,
  ) {
    super(app);
    this.templateData = templateData;
    this.templateName = templateName;
    this.onSave = onSave || null;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;

    // 모달 크기 조정 (넓게)
    modalEl.addClass("hwpx-editor-modal");

    // 헤더
    const header = contentEl.createDiv("hwpx-editor-header");
    header.createEl("h3", { text: `템플릿 편집: ${this.templateName}` });

    const btnRow = header.createDiv("hwpx-editor-btns");
    const saveBtn = btnRow.createEl("button", { text: "💾 저장", cls: "hwpx-editor-save-btn" });
    saveBtn.addEventListener("click", () => this.saveTemplate());
    const closeBtn = btnRow.createEl("button", { text: "닫기", cls: "hwpx-editor-close-btn" });
    closeBtn.addEventListener("click", () => this.close());

    // 에디터 컨테이너
    const editorContainer = contentEl.createDiv("hwpx-editor-container");
    editorContainer.setAttribute("id", "hwpx-template-editor");

    // 안내 텍스트
    const info = contentEl.createDiv("hwpx-editor-info");
    info.createEl("p", { text: "💡 팁: 플레이스홀더 텍스트 ({{H1}}, {{BODY}} 등)를 넣으면 스타일이 자동으로 추출됩니다." });

    // @rhwp/editor 초기화
    try {
      const { createEditor } = await import("@rhwp/editor");
      this.editor = await createEditor(editorContainer, {
        width: "100%",
        height: "100%",
      });

      // 템플릿 데이터 로드
      if (this.templateData) {
        const result = await this.editor.loadFile(this.templateData, this.templateName);
        new Notice(`${result.pageCount}페이지 로드 완료`);
      }
    } catch (error) {
      console.error("[HWPX Writer] Editor init error:", error);
      editorContainer.empty();
      editorContainer.createEl("div", {
        text: `에디터 로드 실패: ${error}\n\n온라인 연결이 필요합니다 (rhwp-studio).`,
        cls: "hwpx-editor-error",
      });
    }
  }

  async saveTemplate() {
    if (!this.editor || !this.onSave) {
      new Notice("저장할 수 없습니다.");
      return;
    }

    try {
      // TODO: rhwp editor에서 수정된 데이터를 가져오는 API 확인 필요
      // 현재 @rhwp/editor에 exportFile 같은 메서드가 있는지 확인
      new Notice("💡 템플릿 저장은 추후 업데이트 예정입니다.");
    } catch (error) {
      new Notice(`저장 실패: ${error}`);
    }
  }

  onClose() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    this.contentEl.empty();
  }
}
