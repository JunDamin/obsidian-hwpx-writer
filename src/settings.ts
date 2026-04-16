import { App, PluginSettingTab, Setting } from "obsidian";
import type HwpxWriterPlugin from "./main";

export interface HeadingStyle {
  fontSize: number;       // pt
  bold: boolean;
  italic: boolean;
  pageBreakBefore: boolean;
  blankLinesBefore: number;  // 헤딩 앞 빈 줄 수 (0이면 없음)
  blankLinesAfter: number;   // 헤딩 뒤 빈 줄 수
  blankLineHeight: number;   // 빈 줄 높이 (pt, 0이면 본문 크기)
  spaceBefore: number;       // mm (문단 속성 앞 간격)
  spaceAfter: number;        // mm (문단 속성 뒤 간격)
  color: string;             // #RRGGBB
  fontName: string;          // 빈 문자열이면 본문 폰트 사용
}

export interface ListLevelStyle {
  bulletChar: string;    // 글머리표 문자 (예: "ㅇ", "-", "∙", "●")
  fontSize: number;      // pt (0이면 본문 크기 사용)
  fontName: string;      // 빈 문자열이면 본문 폰트 사용
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

  // 글꼴
  fontHangul: string;      // 한글 폰트
  fontLatin: string;       // 영문 폰트
  headingFontHangul: string;  // 헤딩 한글 폰트 (빈 문자열이면 본문 폰트)
  headingFontLatin: string;   // 헤딩 영문 폰트

  // 스타일
  bodyFont: string;        // (하위 호환용, fontHangul과 동기화)
  bodyFontSize: number;    // pt
  lineSpacing: number;     // %
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
  listBulletChars: string;      // 레벨별 글머리표 (쉼표 구분) — 하위호환용
  listIndentPerLevel: number;   // mm (레벨당 들여쓰기)
  listFontSize: number;         // pt — 하위호환용
  listLineSpacing: number;      // %
  listLevelStyles: ListLevelStyle[];  // L1~L4 레벨별 스타일

  // 코드 블록
  codeFontName: string;
  codeFontSize: number;         // pt

  // 템플릿
  templates: string[];  // 템플릿 파일명 목록

  // 프리셋
  presets: { [name: string]: Partial<HwpxWriterSettings> };
  activePreset: string;  // 현재 활성 프리셋 이름 (빈 문자열이면 커스텀)
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

  fontHangul: "맑은 고딕",
  fontLatin: "맑은 고딕",
  headingFontHangul: "",
  headingFontLatin: "",

  bodyFont: "맑은 고딕",
  bodyFontSize: 10,
  lineSpacing: 160,
  headingStyles: [
    { fontSize: 22, bold: true, italic: false, pageBreakBefore: true, blankLinesBefore: 0, blankLinesAfter: 1, blankLineHeight: 0, spaceBefore: 10, spaceAfter: 5, color: "#000000", fontName: "" },
    { fontSize: 18, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 2, blankLinesAfter: 1, blankLineHeight: 5, spaceBefore: 8, spaceAfter: 4, color: "#000000", fontName: "" },
    { fontSize: 16, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 6, spaceAfter: 3, color: "#000000", fontName: "" },
    { fontSize: 14, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 4, spaceAfter: 2, color: "#000000", fontName: "" },
    { fontSize: 12, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 3, spaceAfter: 2, color: "#000000", fontName: "" },
    { fontSize: 11, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 2, spaceAfter: 1, color: "#000000", fontName: "" },
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
  listLevelStyles: [
    { bulletChar: "ㅇ", fontSize: 10, fontName: "" },
    { bulletChar: "-",  fontSize: 10, fontName: "" },
    { bulletChar: "∙",  fontSize: 10, fontName: "" },
    { bulletChar: "●",  fontSize: 9,  fontName: "" },
  ],

  codeFontName: "D2Coding",
  codeFontSize: 9,

  templates: [],

  presets: {
    "기본": {},  // 기본값 그대로
    "공문 양식": {
      fontHangul: "함초롬바탕", fontLatin: "함초롬바탕",
      bodyFontSize: 10, lineSpacing: 160,
      marginLeft: 20, marginRight: 15, marginTop: 15, marginBottom: 15,
      headingStyles: [
        { fontSize: 16, bold: true, italic: false, pageBreakBefore: true, blankLinesBefore: 0, blankLinesAfter: 1, blankLineHeight: 0, spaceBefore: 0, spaceAfter: 5, color: "#000000", fontName: "" },
        { fontSize: 14, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 8, spaceAfter: 4, color: "#000000", fontName: "" },
        { fontSize: 13, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 6, spaceAfter: 3, color: "#000000", fontName: "" },
        { fontSize: 12, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 4, spaceAfter: 2, color: "#000000", fontName: "" },
        { fontSize: 11, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 3, spaceAfter: 2, color: "#000000", fontName: "" },
        { fontSize: 10, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 2, spaceAfter: 1, color: "#000000", fontName: "" },
      ],
      tableHeaderBgColor: "#E8E8E8",
    },
    "학술 논문": {
      fontHangul: "맑은 고딕", fontLatin: "Times New Roman",
      bodyFontSize: 11, lineSpacing: 200,
      marginLeft: 25, marginRight: 25, marginTop: 25, marginBottom: 25,
      bodyIndent: 10, bodyAlign: "JUSTIFY",
      headingStyles: [
        { fontSize: 16, bold: true, italic: false, pageBreakBefore: true, blankLinesBefore: 0, blankLinesAfter: 1, blankLineHeight: 0, spaceBefore: 0, spaceAfter: 8, color: "#000000", fontName: "" },
        { fontSize: 14, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 2, blankLinesAfter: 1, blankLineHeight: 6, spaceBefore: 10, spaceAfter: 5, color: "#000000", fontName: "" },
        { fontSize: 12, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 8, spaceAfter: 4, color: "#000000", fontName: "" },
        { fontSize: 11, bold: true, italic: true, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 6, spaceAfter: 3, color: "#000000", fontName: "" },
        { fontSize: 11, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 4, spaceAfter: 2, color: "#000000", fontName: "" },
        { fontSize: 10, bold: false, italic: true, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 3, spaceAfter: 2, color: "#000000", fontName: "" },
      ],
    },
    "프레젠테이션": {
      fontHangul: "맑은 고딕", fontLatin: "맑은 고딕",
      bodyFontSize: 12, lineSpacing: 180,
      paperSize: "A4" as const, landscape: true,
      marginLeft: 25, marginRight: 25, marginTop: 20, marginBottom: 20,
      headingStyles: [
        { fontSize: 28, bold: true, italic: false, pageBreakBefore: true, blankLinesBefore: 0, blankLinesAfter: 2, blankLineHeight: 10, spaceBefore: 0, spaceAfter: 10, color: "#1A237E", fontName: "" },
        { fontSize: 22, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 1, blankLineHeight: 5, spaceBefore: 10, spaceAfter: 5, color: "#283593", fontName: "" },
        { fontSize: 18, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 1, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 8, spaceAfter: 4, color: "#303F9F", fontName: "" },
        { fontSize: 16, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 6, spaceAfter: 3, color: "#3949AB", fontName: "" },
        { fontSize: 14, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 4, spaceAfter: 2, color: "#000000", fontName: "" },
        { fontSize: 12, bold: true, italic: false, pageBreakBefore: false, blankLinesBefore: 0, blankLinesAfter: 0, blankLineHeight: 0, spaceBefore: 3, spaceAfter: 2, color: "#000000", fontName: "" },
      ],
    },
  },
  activePreset: "기본",
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
