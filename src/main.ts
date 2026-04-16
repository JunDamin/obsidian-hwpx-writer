import { Plugin, MarkdownView, TFile, Notice } from "obsidian";
import { HwpxSidebarView, VIEW_TYPE_HWPX } from "./HwpxSidebarView";
import { HwpxWriterSettings, DEFAULT_SETTINGS, HwpxSettingTab } from "./settings";
import { convertMarkdownToHwpx } from "./converter/MarkdownToHwpx";
import { parseFrontmatter, applyFrontmatterOverrides } from "./frontmatter";

export default class HwpxWriterPlugin extends Plugin {
  settings: HwpxWriterSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    // 사이드바 뷰 등록
    this.registerView(VIEW_TYPE_HWPX, (leaf) => new HwpxSidebarView(leaf, this));

    // 리본 아이콘 (사이드바 토글)
    this.addRibbonIcon("file-output", "HWPX Writer", () => {
      this.activateSidebarView();
    });

    // 커맨드: HWPX로 내보내기
    this.addCommand({
      id: "export-to-hwpx",
      name: "HWPX로 내보내기",
      callback: () => this.exportCurrentFile(),
    });

    // 커맨드: 사이드바 열기
    this.addCommand({
      id: "open-hwpx-sidebar",
      name: "HWPX Writer 패널 열기",
      callback: () => this.activateSidebarView(),
    });

    // 파일 메뉴에 "HWPX로 내보내기" 추가
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "md") {
          menu.addItem((item) => {
            item.setTitle("HWPX로 내보내기")
              .setIcon("file-output")
              .onClick(() => this.exportFile(file));
          });
        }
      })
    );

    // 설정 탭
    this.addSettingTab(new HwpxSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateSidebarView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_HWPX)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: VIEW_TYPE_HWPX, active: true });
        leaf = rightLeaf;
      }
    }
    if (leaf) workspace.revealLeaf(leaf);
  }

  async exportCurrentFile() {
    const file = this.findMarkdownFile();
    if (!file) {
      new Notice("변환할 Markdown 파일이 없습니다. .md 파일을 열어주세요.");
      return;
    }
    await this.exportFile(file);
  }

  /** 현재 열려있는 .md 파일을 찾는다 (사이드바 포커스 상태에서도 동작). */
  findMarkdownFile(): TFile | null {
    // 방법 1: 활성 MarkdownView
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file) return activeView.file;

    // 방법 2: 모든 leaf 순회하며 MarkdownView 찾기
    let found: TFile | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      if (leaf.view instanceof MarkdownView && leaf.view.file) {
        found = leaf.view.file;
      }
    });
    if (found) return found;

    // 방법 3: 최근 활성 파일
    const recentFile = this.app.workspace.getActiveFile();
    if (recentFile && recentFile.extension === "md") return recentFile;

    return null;
  }

  async exportFile(file: TFile) {
    try {
      new Notice(`변환 중: ${file.basename}...`);
      console.log("[HWPX Writer] Converting:", file.path);
      const markdown = await this.app.vault.read(file);
      console.log("[HWPX Writer] Markdown length:", markdown.length);

      // YAML frontmatter로 설정 오버라이드
      const { frontmatter } = parseFrontmatter(markdown);
      const { settings: effectiveSettings, appliedKeys } =
        applyFrontmatterOverrides(this.settings, frontmatter);
      if (appliedKeys.length > 0) {
        console.log("[HWPX Writer] Frontmatter overrides:", appliedKeys);
      }

      const hwpxBytes = await convertMarkdownToHwpx(markdown, effectiveSettings);
      console.log("[HWPX Writer] HWPX bytes:", hwpxBytes.length);

      const outputPath = this.getOutputPath(file, effectiveSettings);
      console.log("[HWPX Writer] Output path:", outputPath);

      // ArrayBuffer 안전 복사 (Uint8Array.buffer 호환 문제 방지)
      const arrayBuffer = hwpxBytes.buffer.slice(
        hwpxBytes.byteOffset,
        hwpxBytes.byteOffset + hwpxBytes.byteLength
      );

      // 이미 존재하면 확인 후 덮어쓰기, 없으면 생성
      const existing = this.app.vault.getAbstractFileByPath(outputPath);
      if (existing instanceof TFile) {
        const overwrite = await this.confirmOverwrite(outputPath);
        if (!overwrite) {
          new Notice("내보내기 취소됨");
          return;
        }
        await this.app.vault.modifyBinary(existing, arrayBuffer);
      } else {
        await this.app.vault.createBinary(outputPath, arrayBuffer);
      }
      new Notice(`✅ 변환 완료: ${outputPath}`);

      // 사이드바에 결과 버튼 표시
      const sidebarLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HWPX);
      if (sidebarLeaves.length > 0) {
        const view = sidebarLeaves[0].view as HwpxSidebarView;
        const adapter = this.app.vault.adapter as any;
        const fullPath = require("path").join(adapter.basePath, outputPath);
        view.showExportResult(fullPath, outputPath);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(`❌ 변환 실패: ${msg}`);
      console.error("[HWPX Writer] export error:", error);
    }
  }

  /** 파일 덮어쓰기 확인 다이얼로그 */
  private confirmOverwrite(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = (val: boolean) => { if (!resolved) { resolved = true; resolve(val); } };
      const modal = new (class extends (require("obsidian").Modal) {
        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h3", { text: "파일이 이미 존재합니다" });
          contentEl.createEl("p", { text: `${path}` });
          contentEl.createEl("p", { text: "덮어쓰시겠습니까?" });
          const btnRow = contentEl.createDiv({ cls: "hwpx-result-btns" });
          const yesBtn = btnRow.createEl("button", { text: "덮어쓰기", cls: "hwpx-editor-save-btn" });
          yesBtn.addEventListener("click", () => { safeResolve(true); this.close(); });
          const noBtn = btnRow.createEl("button", { text: "취소", cls: "hwpx-editor-close-btn" });
          noBtn.addEventListener("click", () => { safeResolve(false); this.close(); });
        }
        onClose() { safeResolve(false); }
      })(this.app);
      modal.open();
    });
  }

  private getOutputPath(file: TFile, settings: HwpxWriterSettings = this.settings): string {
    const folder = settings.outputFolder || file.parent?.path || "";
    const name = `${file.basename}.hwpx`;
    if (!folder || folder === "/" || folder === ".") return name;
    return `${folder}/${name}`;
  }
}
