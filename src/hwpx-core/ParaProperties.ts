/**
 * ParaProperties — 문단 속성 (정렬, 들여쓰기, 줄간격, 페이지 나누기, 테두리 등).
 *
 * header.xml의 `<hh:paraProperties>` 하위로 들어가며, Paragraph의 paraPrIDRef가 참조한다.
 * margin 과 lineSpacing 은 `hp:switch` 래핑이 필요(HwpUnitChar 호환용).
 */

import { XmlWriter } from "./XmlBuilder";
import { boolToStr } from "./utils";
import { NS } from "./constants";

export interface ParaPropertiesInit {
  id?: number;

  alignHorizontal?: string;
  alignVertical?: string;

  headingType?: string;
  headingIdRef?: number | null;
  headingLevel?: number;

  indent?: number;
  marginLeft?: number;
  marginRight?: number;
  spacingBefore?: number;
  spacingAfter?: number;

  lineSpacingType?: string;
  lineSpacingValue?: number;

  breakLatinWord?: string;
  breakNonLatinWord?: string;
  widowOrphan?: boolean;
  keepWithNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;

  borderFillId?: number | null;
  borderOffsetLeft?: number;
  borderOffsetRight?: number;
  borderOffsetTop?: number;
  borderOffsetBottom?: number;
  borderConnect?: boolean;
  borderIgnoreMargin?: boolean;

  tabPrId?: number | null;

  autoSpacingEaEng?: boolean;
  autoSpacingEaNum?: boolean;

  condense?: number;
  fontLineHeight?: boolean;
  snapToGrid?: boolean;
  suppressLineNumbers?: boolean;
}

export class ParaProperties {
  id: number;

  alignHorizontal: string;
  alignVertical: string;

  headingType: string;
  headingIdRef: number | null;
  headingLevel: number;

  indent: number;
  marginLeft: number;
  marginRight: number;
  spacingBefore: number;
  spacingAfter: number;

  lineSpacingType: string;
  lineSpacingValue: number;

  breakLatinWord: string;
  breakNonLatinWord: string;
  widowOrphan: boolean;
  keepWithNext: boolean;
  keepLines: boolean;
  pageBreakBefore: boolean;

  borderFillId: number | null;
  borderOffsetLeft: number;
  borderOffsetRight: number;
  borderOffsetTop: number;
  borderOffsetBottom: number;
  borderConnect: boolean;
  borderIgnoreMargin: boolean;

  tabPrId: number | null;

  autoSpacingEaEng: boolean;
  autoSpacingEaNum: boolean;

  condense: number;
  fontLineHeight: boolean;
  snapToGrid: boolean;
  suppressLineNumbers: boolean;

  constructor(init: ParaPropertiesInit = {}) {
    this.id = init.id ?? 0;

    this.alignHorizontal = init.alignHorizontal ?? "JUSTIFY";
    this.alignVertical = init.alignVertical ?? "BASELINE";

    this.headingType = init.headingType ?? "NONE";
    this.headingIdRef = init.headingIdRef ?? null;
    this.headingLevel = init.headingLevel ?? 0;

    this.indent = init.indent ?? 0;
    this.marginLeft = init.marginLeft ?? 0;
    this.marginRight = init.marginRight ?? 0;
    this.spacingBefore = init.spacingBefore ?? 0;
    this.spacingAfter = init.spacingAfter ?? 0;

    this.lineSpacingType = init.lineSpacingType ?? "PERCENT";
    this.lineSpacingValue = init.lineSpacingValue ?? 160;

    this.breakLatinWord = init.breakLatinWord ?? "KEEP_WORD";
    this.breakNonLatinWord = init.breakNonLatinWord ?? "KEEP_WORD";
    this.widowOrphan = init.widowOrphan ?? false;
    this.keepWithNext = init.keepWithNext ?? false;
    this.keepLines = init.keepLines ?? false;
    this.pageBreakBefore = init.pageBreakBefore ?? false;

    this.borderFillId = init.borderFillId ?? null;
    this.borderOffsetLeft = init.borderOffsetLeft ?? 0;
    this.borderOffsetRight = init.borderOffsetRight ?? 0;
    this.borderOffsetTop = init.borderOffsetTop ?? 0;
    this.borderOffsetBottom = init.borderOffsetBottom ?? 0;
    this.borderConnect = init.borderConnect ?? false;
    this.borderIgnoreMargin = init.borderIgnoreMargin ?? false;

    this.tabPrId = init.tabPrId ?? null;

    this.autoSpacingEaEng = init.autoSpacingEaEng ?? false;
    this.autoSpacingEaNum = init.autoSpacingEaNum ?? false;

    this.condense = init.condense ?? 0;
    this.fontLineHeight = init.fontLineHeight ?? false;
    this.snapToGrid = init.snapToGrid ?? false;
    this.suppressLineNumbers = init.suppressLineNumbers ?? false;
  }

  toXml(w: XmlWriter): void {
    const attrs: Record<string, string | undefined> = {
      id: String(this.id),
      tabPrIDRef: this.tabPrId !== null ? String(this.tabPrId) : "0",
      condense: this.condense ? String(this.condense) : "0",
      fontLineHeight: boolToStr(this.fontLineHeight),
      snapToGrid: boolToStr(this.snapToGrid),
      suppressLineNumbers: boolToStr(this.suppressLineNumbers),
      checked: "0",
    };
    w.start("hh:paraPr", attrs);

    // align
    w.empty("hh:align", {
      horizontal: this.alignHorizontal,
      vertical: this.alignVertical,
    });

    // heading
    w.empty("hh:heading", {
      type: this.headingType,
      idRef: this.headingIdRef !== null ? String(this.headingIdRef) : "0",
      level: String(this.headingLevel),
    });

    // breakSetting
    w.empty("hh:breakSetting", {
      breakLatinWord: this.breakLatinWord,
      breakNonLatinWord: this.breakNonLatinWord,
      widowOrphan: boolToStr(this.widowOrphan),
      keepWithNext: boolToStr(this.keepWithNext),
      keepLines: boolToStr(this.keepLines),
      pageBreakBefore: boolToStr(this.pageBreakBefore),
    });

    // autoSpacing
    w.empty("hh:autoSpacing", {
      eAsianEng: boolToStr(this.autoSpacingEaEng),
      eAsianNum: boolToStr(this.autoSpacingEaNum),
    });

    // margin + lineSpacing wrapped in hp:switch
    this.writeSwitchMargin(w);
    this.writeSwitchLineSpacing(w);

    // border
    if (this.borderFillId !== null) {
      w.start("hh:border", {
        borderFillIDRef: String(this.borderFillId),
        connect: boolToStr(this.borderConnect),
        ignoreMargin: boolToStr(this.borderIgnoreMargin),
      });
      w.empty("hh:offset", {
        left: String(this.borderOffsetLeft),
        right: String(this.borderOffsetRight),
        top: String(this.borderOffsetTop),
        bottom: String(this.borderOffsetBottom),
      });
      w.end("hh:border");
    }

    w.end("hh:paraPr");
  }

  private writeSwitchMargin(w: XmlWriter): void {
    /** margin을 hp:switch로 래핑. */
    w.start("hp:switch");
    w.start("hp:case", { "hp:required-namespace": NS["hwpunitchar"] });
    this.writeMargin(w);
    w.end("hp:case");
    w.start("hp:default");
    this.writeMargin(w);
    w.end("hp:default");
    w.end("hp:switch");
  }

  private writeMargin(w: XmlWriter): void {
    w.start("hh:margin");
    w.empty("hc:intent", { value: String(this.indent), unit: "HWPUNIT" });
    w.empty("hc:left", { value: String(this.marginLeft), unit: "HWPUNIT" });
    w.empty("hc:right", { value: String(this.marginRight), unit: "HWPUNIT" });
    w.empty("hc:prev", { value: String(this.spacingBefore), unit: "HWPUNIT" });
    w.empty("hc:next", { value: String(this.spacingAfter), unit: "HWPUNIT" });
    w.end("hh:margin");
  }

  private writeSwitchLineSpacing(w: XmlWriter): void {
    /** lineSpacing을 hp:switch로 래핑. */
    w.start("hp:switch");
    w.start("hp:case", { "hp:required-namespace": NS["hwpunitchar"] });
    this.writeLineSpacing(w);
    w.end("hp:case");
    w.start("hp:default");
    this.writeLineSpacing(w);
    w.end("hp:default");
    w.end("hp:switch");
  }

  private writeLineSpacing(w: XmlWriter): void {
    w.empty("hh:lineSpacing", {
      type: this.lineSpacingType,
      value: String(this.lineSpacingValue),
      unit: "HWPUNIT",
    });
  }
}
