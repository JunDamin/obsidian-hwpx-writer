import { Plugin, MarkdownView, TFile, Notice } from "obsidian";
import { HwpxSidebarView, VIEW_TYPE_HWPX } from "./HwpxSidebarView";
import { HwpxWriterSettings, DEFAULT_SETTINGS, HwpxSettingTab } from "./settings";
import { convertMarkdownToHwpx } from "./converter/MarkdownToHwpx";

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
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.file) {
      new Notice("변환할 Markdown 파일이 없습니다.");
      return;
    }
    await this.exportFile(activeView.file);
  }

  async exportFile(file: TFile) {
    try {
      new Notice(`변환 중: ${file.basename}...`);
      const markdown = await this.app.vault.read(file);

      const hwpxBytes = await convertMarkdownToHwpx(markdown, this.settings);
      const outputPath = this.getOutputPath(file);
      await this.app.vault.createBinary(outputPath, hwpxBytes.buffer as ArrayBuffer);
      new Notice(`✅ 변환 완료: ${outputPath}`);
    } catch (error) {
      new Notice(`변환 실패: ${error}`);
      console.error("HWPX export error:", error);
    }
  }

  private getOutputPath(file: TFile): string {
    const folder = this.settings.outputFolder || file.parent?.path || "";
    const name = `${file.basename}.hwpx`;
    return folder ? `${folder}/${name}` : name;
  }
}
