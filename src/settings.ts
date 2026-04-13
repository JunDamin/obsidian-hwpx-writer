import { App, PluginSettingTab, Setting } from "obsidian";
import type HwpxWriterPlugin from "./main";

export interface HeadingStyle {
  fontSize: number;  // pt
  bold: boolean;
  pageBreakBefore: boolean;
}

export interface HwpxWriterSettings {
  // 기본
  outputFolder: string;
  defaultTemplate: string;
  mathMode: "none" | "italic" | "hwce";
  showPreview: boolean;

  // 페이지
  paperSize: "A4" | "B5" | "Letter";
  landscape: boolean;
  marginLeft: number;   // mm
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  marginHeader: number;
  marginFooter: number;

  // 스타일
  bodyFont: string;
  bodyFontSize: number;  // pt
  lineSpacing: number;   // %
  headingStyles: HeadingStyle[];  // H1~H6
  linkColor: string;

  // 표
  tableHeaderBgColor: string;
  tableRepeatHeader: boolean;
  tableBorderStyle: string;

  // 템플릿
  templates: string[];  // 템플릿 파일명 목록
}

export const DEFAULT_SETTINGS: HwpxWriterSettings = {
  outputFolder: "",
  defaultTemplate: "default",
  mathMode: "hwce",
  showPreview: true,

  paperSize: "A4",
  landscape: false,
  marginLeft: 20,
  marginRight: 15,
  marginTop: 15,
  marginBottom: 15,
  marginHeader: 15,
  marginFooter: 15,

  bodyFont: "맑은 고딕",
  bodyFontSize: 10,
  lineSpacing: 160,
  headingStyles: [
    { fontSize: 22, bold: true, pageBreakBefore: true },   // H1
    { fontSize: 18, bold: true, pageBreakBefore: false },  // H2
    { fontSize: 16, bold: true, pageBreakBefore: false },  // H3
    { fontSize: 14, bold: true, pageBreakBefore: false },  // H4
    { fontSize: 12, bold: true, pageBreakBefore: false },  // H5
    { fontSize: 11, bold: true, pageBreakBefore: false },  // H6
  ],
  linkColor: "#0000FF",

  tableHeaderBgColor: "#D5E8F0",
  tableRepeatHeader: true,
  tableBorderStyle: "SOLID",

  templates: [],
};

export class HwpxSettingTab extends PluginSettingTab {
  plugin: HwpxWriterPlugin;

  constructor(app: App, plugin: HwpxWriterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "HWPX Writer 설정" });

    // 기본 설정
    new Setting(containerEl)
      .setName("출력 폴더")
      .setDesc("HWPX 파일을 저장할 폴더 (비어있으면 원본과 같은 폴더)")
      .addText((text) =>
        text.setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("수식 모드")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("hwce", "HWCE (한컴 수식)")
          .addOption("italic", "기울임 텍스트")
          .addOption("none", "무시")
          .setValue(this.plugin.settings.mathMode)
          .onChange(async (value: any) => {
            this.plugin.settings.mathMode = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("미리보기 표시")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showPreview)
          .onChange(async (value) => {
            this.plugin.settings.showPreview = value;
            await this.plugin.saveSettings();
          })
      );

    // 페이지 설정
    containerEl.createEl("h3", { text: "페이지 설정" });

    new Setting(containerEl)
      .setName("용지 크기")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("A4", "A4")
          .addOption("B5", "B5")
          .addOption("Letter", "Letter")
          .setValue(this.plugin.settings.paperSize)
          .onChange(async (value: any) => {
            this.plugin.settings.paperSize = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("가로 방향")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.landscape)
          .onChange(async (value) => {
            this.plugin.settings.landscape = value;
            await this.plugin.saveSettings();
          })
      );

    // 스타일 설정
    containerEl.createEl("h3", { text: "스타일" });

    new Setting(containerEl)
      .setName("본문 폰트")
      .addText((text) =>
        text.setValue(this.plugin.settings.bodyFont)
          .onChange(async (value) => {
            this.plugin.settings.bodyFont = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("본문 크기 (pt)")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.bodyFontSize))
          .onChange(async (value) => {
            this.plugin.settings.bodyFontSize = Number(value) || 10;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("줄간격 (%)")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.lineSpacing))
          .onChange(async (value) => {
            this.plugin.settings.lineSpacing = Number(value) || 160;
            await this.plugin.saveSettings();
          })
      );
  }
}
