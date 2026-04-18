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

/**
 * 테두리 한 구간(선 하나)의 스펙.
 *
 * HWPX/OWPML 표준의 LineType1 enum 전체를 지원 (KS X 6101 §5.7).
 * type="NONE" 이면 그리지 않음.
 */
export type BorderLineType =
  | "NONE"
  | "SOLID"
  | "DASH"
  | "DOT"
  | "DASH_DOT"
  | "DASH_DOT_DOT"
  | "LONG_DASH"
  | "DOUBLE_SLIM"    // 이중 가는선 (얇은 두 줄)
  | "SLIM_THICK"     // 가는-굵은
  | "THICK_SLIM"     // 굵은-가는
  | "SLIM_THICK_SLIM"
  | "WAVE"
  | "DOUBLE_WAVE"
  | "THICK3D"
  | "NEGATIVE3D"
  | "CIRCLE"
  | "CLIPPING";

export interface BorderLineSpec {
  type: BorderLineType;
  color: string;         // "#RRGGBB"
  width: string;         // 사전정의값: "0.1 mm", "0.12 mm", "0.15 mm", "0.2 mm", ... "5.0 mm"
}

/** HWPX 표준 사전정의 LineWidth 값. */
export const BORDER_WIDTHS = [
  "0.1 mm", "0.12 mm", "0.15 mm", "0.2 mm", "0.25 mm", "0.3 mm", "0.4 mm",
  "0.5 mm", "0.6 mm", "0.7 mm", "1.0 mm", "1.5 mm", "2.0 mm", "3.0 mm",
  "4.0 mm", "5.0 mm",
] as const;

/** UI 표시용 라벨 (한글). */
export const BORDER_TYPE_LABELS: [BorderLineType, string][] = [
  ["SOLID",           "실선"],
  ["DASH",            "파선"],
  ["DOT",             "점선"],
  ["DASH_DOT",        "일점쇄선"],
  ["DASH_DOT_DOT",    "이점쇄선"],
  ["LONG_DASH",       "긴 파선"],
  ["DOUBLE_SLIM",     "이중 가는선"],
  ["SLIM_THICK",      "가는-굵은"],
  ["THICK_SLIM",      "굵은-가는"],
  ["SLIM_THICK_SLIM", "가는-굵은-가는"],
  ["WAVE",            "물결"],
  ["DOUBLE_WAVE",     "이중 물결"],
  ["THICK3D",         "3D 굵은선"],
  ["NEGATIVE3D",      "3D 음각"],
  ["CIRCLE",          "원형"],
  ["CLIPPING",        "잘라내기"],
  ["NONE",            "없음"],
];

/** 표 테두리 전체 디자인 — 7개 독립 구간. */
export interface TableBorderDesign {
  outerTop: BorderLineSpec;
  outerBottom: BorderLineSpec;
  outerLeft: BorderLineSpec;
  outerRight: BorderLineSpec;
  headerBottom: BorderLineSpec;  // 헤더와 본문 사이 가로선
  innerH: BorderLineSpec;        // 본문 행 사이
  innerV: BorderLineSpec;        // 열 사이 (헤더/본문 공통)
}

function defaultLine(): BorderLineSpec {
  return { type: "SOLID", color: "#000000", width: "0.12 mm" };
}

export function defaultBorderDesign(): TableBorderDesign {
  return {
    outerTop: defaultLine(),
    outerBottom: defaultLine(),
    outerLeft: defaultLine(),
    outerRight: defaultLine(),
    headerBottom: defaultLine(),
    innerH: defaultLine(),
    innerV: defaultLine(),
  };
}

export interface HwpxWriterSettings {
  // 기본
  outputFolder: string;
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
  fontHangul: string;      // 한글 폰트 (본문 기본)
  fontLatin: string;       // 영문 폰트

  // 스타일
  bodyFontSize: number;    // pt
  lineSpacing: number;     // %
  headingStyles: HeadingStyle[];  // H1~H6
  linkColor: string;

  // 표
  tableHeaderBgColor: string;
  tableHeaderFontSize: number;   // pt
  tableHeaderBold: boolean;
  tableHeaderAlign: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFY";
  tableBodyFontSize: number;     // pt
  tableRepeatHeader: boolean;
  tableCellPaddingH: number;     // mm (좌우)
  tableCellPaddingV: number;     // mm (상하)

  /**
   * 7개 독립 구간(외곽 4 + 헤더-본문 구분 + 본문 내부 가로 + 열 사이)의 선 스펙.
   * 각 구간별로 종류와 색, 굵기를 독립 지정한다. TableBorderDesigner UI 로 편집.
   */
  tableBorderDesign: TableBorderDesign;

  /**
   * 사용자가 저장한 표 테두리 프리셋.
   * 이름·디자인 쌍의 배열. TableBorderDesigner UI 의 "저장" 버튼으로 추가·삭제.
   */
  tableBorderUserPresets: Array<{ name: string; design: TableBorderDesign }>;

  // 본문
  bodyIndent: number;           // mm (첫줄 들여쓰기)
  bodySpacingBefore: number;    // mm (문단 앞 간격)
  bodySpacingAfter: number;     // mm (문단 뒤 간격)
  bodyAlign: string;

  // 리스트
  listIndentPerLevel: number;   // mm (레벨당 들여쓰기)
  listLevelStyles: ListLevelStyle[];  // L1~L4 레벨별 스타일

  // 코드 블록
  codeFontName: string;
  codeFontSize: number;         // pt

  // 템플릿
  activeTemplateId: string | null;  // 현재 선택된 템플릿 ID (null이면 사용 안 함)

  /**
   * 샘플 템플릿 자동 시드 여부(레거시 플래그) + 현재 시드 버전.
   *
   * - sampleTemplatesSeeded: 0/1 단순 플래그 (구버전 사용자 호환)
   * - sampleTemplatesVersion: 현재까지 시드한 샘플 세트의 버전
   *   CURRENT_SAMPLE_VERSION 보다 작으면 onload 에서 업데이트 (overwrite) 진행.
   *   사용자가 샘플을 삭제한 뒤에는 다시 자동 생성하지 않도록, 업그레이드 여부도
   *   "기존 샘플 파일이 남아있을 때만" 수행.
   */
  sampleTemplatesSeeded: boolean;
  sampleTemplatesVersion: number;

  // 프리셋
  presets: { [name: string]: Partial<HwpxWriterSettings> };
  activePreset: string;  // 현재 활성 프리셋 이름 (빈 문자열이면 커스텀)
}

export const DEFAULT_SETTINGS: HwpxWriterSettings = {
  outputFolder: "",
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
  tableCellPaddingH: 2,
  tableCellPaddingV: 1,
  tableBorderDesign: defaultBorderDesign(),
  tableBorderUserPresets: [],

  bodyIndent: 0,
  bodySpacingBefore: 0,
  bodySpacingAfter: 0,
  bodyAlign: "JUSTIFY",

  listIndentPerLevel: 7,
  listLevelStyles: [
    { bulletChar: "ㅇ", fontSize: 10, fontName: "" },
    { bulletChar: "-",  fontSize: 10, fontName: "" },
    { bulletChar: "∙",  fontSize: 10, fontName: "" },
    { bulletChar: "●",  fontSize: 9,  fontName: "" },
  ],

  codeFontName: "D2Coding",
  codeFontSize: 9,

  activeTemplateId: null,
  sampleTemplatesSeeded: false,
  sampleTemplatesVersion: 0,

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

/**
 * Legacy 데이터 → 현행 스키마 마이그레이션.
 *
 * 이전 버전에서 저장된 설정에 들어있던 dead/legacy 필드들을 현행 필드로 이관하고 제거.
 * `loadData()` 결과를 이 함수로 통과시킨 뒤 DEFAULT_SETTINGS와 병합한다.
 */
export function migrateLegacySettings(raw: unknown): Partial<HwpxWriterSettings> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  // bodyFont → fontHangul (UI가 bodyFont에 써두고 converter는 fontHangul을 읽던 버그 흔적)
  if (out.bodyFont && !out.fontHangul) {
    out.fontHangul = out.bodyFont;
  }
  delete out.bodyFont;

  // listBulletChars → listLevelStyles
  if (out.listBulletChars && !Array.isArray(out.listLevelStyles)) {
    const chars: string[] = String(out.listBulletChars).split(",").map((c: string) => c.trim());
    out.listLevelStyles = chars.map((ch: string) => ({
      bulletChar: ch || "•", fontSize: 10, fontName: "",
    }));
  }
  delete out.listBulletChars;

  // 완전 제거 필드 (ref 0)
  delete out.defaultTemplate;
  delete out.headingFontHangul;
  delete out.headingFontLatin;
  delete out.listFontSize;
  delete out.listLineSpacing;
  delete out.templates;

  // 표 테두리 — 이전 버전의 평면 필드들을 tableBorderDesign 으로 이관
  out.tableBorderDesign = migrateBorderDesign(out);

  // 사용자 프리셋 배열 — 누락 시 빈 배열
  if (!Array.isArray(out.tableBorderUserPresets)) {
    out.tableBorderUserPresets = [];
  }

  // 제거: 평면 필드들 (이관 완료)
  delete out.tableBorderStyle;
  delete out.tableBorderWidth;
  delete out.tableBorderColor;
  delete out.tableBorderOuterTop;
  delete out.tableBorderOuterBottom;
  delete out.tableBorderOuterLeft;
  delete out.tableBorderOuterRight;
  delete out.tableBorderInnerH;
  delete out.tableBorderInnerV;

  return out;
}

/**
 * 이전 저장 데이터 → 새 TableBorderDesign.
 *
 * 입력 형태:
 *   - 이미 tableBorderDesign 존재: 누락 구간만 기본값으로 채움
 *   - 구버전 평면 필드 (tableBorderStyle/Width/Color + 6 boolean): 해석해서 조립
 *   - 둘 다 없음: 기본값 (모두 SOLID 검정)
 */
function migrateBorderDesign(raw: Record<string, unknown>): TableBorderDesign {
  const defaults = defaultBorderDesign();
  // 이미 최신 필드가 있으면 누락분만 병합
  if (raw.tableBorderDesign && typeof raw.tableBorderDesign === "object") {
    const d = raw.tableBorderDesign as Partial<TableBorderDesign>;
    const merged: TableBorderDesign = { ...defaults };
    for (const k of Object.keys(defaults) as (keyof TableBorderDesign)[]) {
      if (d[k] && typeof d[k] === "object") {
        merged[k] = { ...defaults[k], ...(d[k] as BorderLineSpec) };
      }
    }
    return merged;
  }

  // 구버전 평면 필드 해석
  const oldStyle = typeof raw.tableBorderStyle === "string" ? raw.tableBorderStyle : "SOLID";
  const oldColor = typeof raw.tableBorderColor === "string" ? raw.tableBorderColor : "#000000";
  const oldWidth = typeof raw.tableBorderWidth === "string" ? raw.tableBorderWidth : "0.12 mm";
  const spec = (on: boolean | undefined): BorderLineSpec => ({
    type: on === false ? "NONE" : (oldStyle as BorderLineSpec["type"]),
    color: oldColor,
    width: oldWidth,
  });

  return {
    outerTop: spec(raw.tableBorderOuterTop),
    outerBottom: spec(raw.tableBorderOuterBottom),
    outerLeft: spec(raw.tableBorderOuterLeft),
    outerRight: spec(raw.tableBorderOuterRight),
    // headerBottom: 구버전엔 없었으므로 innerH 와 동일하게 시작
    headerBottom: spec(raw.tableBorderInnerH),
    innerH: spec(raw.tableBorderInnerH),
    innerV: spec(raw.tableBorderInnerV),
  };
}

export class HwpxSettingTab extends PluginSettingTab {
  plugin: HwpxWriterPlugin;

  constructor(app: App, plugin: HwpxWriterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("HWPX Writer 설정").setHeading();

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
          .onChange(async (value) => {
            this.plugin.settings.mathMode = value as "hwce" | "italic" | "none";
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
    new Setting(containerEl).setName("페이지 설정").setHeading();

    new Setting(containerEl)
      .setName("용지 크기")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("A4", "A4")
          .addOption("B5", "B5")
          .addOption("Letter", "Letter")
          .setValue(this.plugin.settings.paperSize)
          .onChange(async (value) => {
            this.plugin.settings.paperSize = value as "A4" | "B5" | "Letter";
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
    new Setting(containerEl).setName("스타일").setHeading();

    new Setting(containerEl)
      .setName("본문 한글 폰트")
      .addText((text) =>
        text.setValue(this.plugin.settings.fontHangul)
          .onChange(async (value) => {
            this.plugin.settings.fontHangul = value;
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
