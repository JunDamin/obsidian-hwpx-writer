import { App, PluginSettingTab, Setting } from "obsidian";
import type HwpxWriterPlugin from "./main";

export interface HeadingStyle {
  fontSize: number;   // pt
  bold: boolean;
  italic: boolean;
  pageBreakBefore: boolean;
  spaceBefore: number; // mm (헤딩 앞 간격)
  spaceAfter: number;  // mm (헤딩 뒤 간격)
  color: string;       // #RRGGBB
  fontName: string;    // 빈 문자열이면 본문 폰트 사용
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
  tableHeaderFontSize: number;   // pt
  tableHeaderBold: boolean;
  tableHeaderAlign: string;
  tableBodyFontSize: number;     // pt
  tableRepeatHeader: boolean;
  tableBorderStyle: string;
  tableBorderWidth: string;
  tableBorderColor: string;
  tableCellPaddingH: number;     // mm (좌우)
  tableCellPaddingV: number;     // mm (상하)

  // 본문
  bodyIndent: number;           // mm (첫줄 들여쓰기)
  bodySpacingBefore: number;    // mm (문단 앞 간격)
  bodySpacingAfter: number;     // mm (문단 뒤 간격)
  bodyAlign: string;

  // 리스트
  listBulletChars: string;      // 레벨별 글머리표 (쉼표 구분)
  listIndentPerLevel: number;   // mm (레벨당 들여쓰기)
  listFontSize: number;         // pt
  listLineSpacing: number;      // %

  // 코드 블록
  codeFontName: string;
  codeFontSize: number;         // pt

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
    { fontSize: 22, bold: true, italic: false, pageBreakBefore: true, spaceBefore: 10, spaceAfter: 5, color: "#000000", fontName: "" },
    { fontSize: 18, bold: true, italic: false, pageBreakBefore: false, spaceBefore: 8, spaceAfter: 4, color: "#000000", fontName: "" },
    { fontSize: 16, bold: true, italic: false, pageBreakBefore: false, spaceBefore: 6, spaceAfter: 3, color: "#000000", fontName: "" },
    { fontSize: 14, bold: true, italic: false, pageBreakBefore: false, spaceBefore: 4, spaceAfter: 2, color: "#000000", fontName: "" },
    { fontSize: 12, bold: true, italic: false, pageBreakBefore: false, spaceBefore: 3, spaceAfter: 2, color: "#000000", fontName: "" },
    { fontSize: 11, bold: true, italic: false, pageBreakBefore: false, spaceBefore: 2, spaceAfter: 1, color: "#000000", fontName: "" },
  ],
  linkColor: "#0000FF",

  tableHeaderBgColor: "#D5E8F0",
  tableHeaderFontSize: 10,
  tableHeaderBold: true,
  tableHeaderAlign: "CENTER",
  tableBodyFontSize: 10,
  tableRepeatHeader: true,
  tableBorderStyle: "SOLID",
  tableBorderWidth: "0.12 mm",
  tableBorderColor: "#000000",
  tableCellPaddingH: 2,
  tableCellPaddingV: 1,

  bodyIndent: 0,
  bodySpacingBefore: 0,
  bodySpacingAfter: 0,
  bodyAlign: "JUSTIFY",

  listBulletChars: "ㅇ,-,∙,●",
  listIndentPerLevel: 7,
  listFontSize: 10,
  listLineSpacing: 160,

  codeFontName: "D2Coding",
  codeFontSize: 9,

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
