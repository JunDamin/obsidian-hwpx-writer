/** 스타일 정의: Font, CharProperties, ParaProperties, BorderFill, Style.
 *
 * header.xml에 들어가는 모든 공유 정의를 담당한다.
 */

import { boolToStr, colorToHwpx } from "./utils";
import { XmlWriter } from "./XmlBuilder";
import { LANG_GROUPS, NS } from "./constants";
import { pt } from "./units";


// ── Font / FontFace ──

export interface FontInit {
  id: number;
  face: string;
  type?: string;
  isEmbedded?: boolean;
}

export class Font {
  id: number;
  face: string;
  type: string;
  isEmbedded: boolean;

  constructor(init: FontInit) {
    this.id = init.id;
    this.face = init.face;
    this.type = init.type ?? "TTF";
    this.isEmbedded = init.isEmbedded ?? false;
  }
}


export interface FontFaceInit {
  lang: string;
  fonts?: Font[];
}

export class FontFace {
  lang: string;
  fonts: Font[];

  constructor(init: FontFaceInit) {
    this.lang = init.lang;
    this.fonts = init.fonts ?? [];
  }

  toXml(w: XmlWriter): void {
    w.start("hh:fontface", { lang: this.lang, fontCnt: String(this.fonts.length) });
    for (const font of this.fonts) {
      w.empty("hh:font", {
        id: String(font.id),
        face: font.face,
        type: font.type,
        isEmbedded: boolToStr(font.isEmbedded),
      });
    }
    w.end("hh:fontface");
  }
}


// ── CharProperties ──

export interface CharPropertiesInit {
  id?: number;
  height?: number;

  textColor?: string;
  shadeColor?: string;

  fontHangul?: number;
  fontLatin?: number;
  fontHanja?: number;
  fontJapanese?: number;
  fontOther?: number;
  fontSymbol?: number;
  fontUser?: number;

  ratioHangul?: number;
  ratioLatin?: number;
  ratioHanja?: number;
  ratioJapanese?: number;
  ratioOther?: number;
  ratioSymbol?: number;
  ratioUser?: number;

  spacingHangul?: number;
  spacingLatin?: number;
  spacingHanja?: number;
  spacingJapanese?: number;
  spacingOther?: number;
  spacingSymbol?: number;
  spacingUser?: number;

  relSizeHangul?: number;
  relSizeLatin?: number;
  relSizeHanja?: number;
  relSizeJapanese?: number;
  relSizeOther?: number;
  relSizeSymbol?: number;
  relSizeUser?: number;

  offsetHangul?: number;
  offsetLatin?: number;
  offsetHanja?: number;
  offsetJapanese?: number;
  offsetOther?: number;
  offsetSymbol?: number;
  offsetUser?: number;

  bold?: boolean;
  italic?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  outlineType?: string;

  underlineType?: string;
  underlineShape?: string;
  underlineColor?: string;

  strikeoutShape?: string;
  strikeoutColor?: string;

  shadowType?: string;
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  symMark?: string;

  useFontSpace?: boolean;
  useKerning?: boolean;
  borderFillId?: number | null;
}

export class CharProperties {
  id: number;
  height: number;

  textColor: string;
  shadeColor: string;

  fontHangul: number;
  fontLatin: number;
  fontHanja: number;
  fontJapanese: number;
  fontOther: number;
  fontSymbol: number;
  fontUser: number;

  ratioHangul: number;
  ratioLatin: number;
  ratioHanja: number;
  ratioJapanese: number;
  ratioOther: number;
  ratioSymbol: number;
  ratioUser: number;

  spacingHangul: number;
  spacingLatin: number;
  spacingHanja: number;
  spacingJapanese: number;
  spacingOther: number;
  spacingSymbol: number;
  spacingUser: number;

  relSizeHangul: number;
  relSizeLatin: number;
  relSizeHanja: number;
  relSizeJapanese: number;
  relSizeOther: number;
  relSizeSymbol: number;
  relSizeUser: number;

  offsetHangul: number;
  offsetLatin: number;
  offsetHanja: number;
  offsetJapanese: number;
  offsetOther: number;
  offsetSymbol: number;
  offsetUser: number;

  bold: boolean;
  italic: boolean;
  superscript: boolean;
  subscript: boolean;
  outlineType: string;

  underlineType: string;
  underlineShape: string;
  underlineColor: string;

  strikeoutShape: string;
  strikeoutColor: string;

  shadowType: string;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;

  symMark: string;

  useFontSpace: boolean;
  useKerning: boolean;
  borderFillId: number | null;

  constructor(init: CharPropertiesInit = {}) {
    this.id = init.id ?? 0;
    this.height = init.height ?? 1000; // pt(10)

    this.textColor = init.textColor ?? "#000000";
    this.shadeColor = init.shadeColor ?? "none";

    this.fontHangul = init.fontHangul ?? 0;
    this.fontLatin = init.fontLatin ?? 0;
    this.fontHanja = init.fontHanja ?? 0;
    this.fontJapanese = init.fontJapanese ?? 0;
    this.fontOther = init.fontOther ?? 0;
    this.fontSymbol = init.fontSymbol ?? 0;
    this.fontUser = init.fontUser ?? 0;

    this.ratioHangul = init.ratioHangul ?? 100;
    this.ratioLatin = init.ratioLatin ?? 100;
    this.ratioHanja = init.ratioHanja ?? 100;
    this.ratioJapanese = init.ratioJapanese ?? 100;
    this.ratioOther = init.ratioOther ?? 100;
    this.ratioSymbol = init.ratioSymbol ?? 100;
    this.ratioUser = init.ratioUser ?? 100;

    this.spacingHangul = init.spacingHangul ?? 0;
    this.spacingLatin = init.spacingLatin ?? 0;
    this.spacingHanja = init.spacingHanja ?? 0;
    this.spacingJapanese = init.spacingJapanese ?? 0;
    this.spacingOther = init.spacingOther ?? 0;
    this.spacingSymbol = init.spacingSymbol ?? 0;
    this.spacingUser = init.spacingUser ?? 0;

    this.relSizeHangul = init.relSizeHangul ?? 100;
    this.relSizeLatin = init.relSizeLatin ?? 100;
    this.relSizeHanja = init.relSizeHanja ?? 100;
    this.relSizeJapanese = init.relSizeJapanese ?? 100;
    this.relSizeOther = init.relSizeOther ?? 100;
    this.relSizeSymbol = init.relSizeSymbol ?? 100;
    this.relSizeUser = init.relSizeUser ?? 100;

    this.offsetHangul = init.offsetHangul ?? 0;
    this.offsetLatin = init.offsetLatin ?? 0;
    this.offsetHanja = init.offsetHanja ?? 0;
    this.offsetJapanese = init.offsetJapanese ?? 0;
    this.offsetOther = init.offsetOther ?? 0;
    this.offsetSymbol = init.offsetSymbol ?? 0;
    this.offsetUser = init.offsetUser ?? 0;

    this.bold = init.bold ?? false;
    this.italic = init.italic ?? false;
    this.superscript = init.superscript ?? false;
    this.subscript = init.subscript ?? false;
    this.outlineType = init.outlineType ?? "NONE";

    this.underlineType = init.underlineType ?? "NONE";
    this.underlineShape = init.underlineShape ?? "SOLID";
    this.underlineColor = init.underlineColor ?? "#000000";

    this.strikeoutShape = init.strikeoutShape ?? "NONE";
    this.strikeoutColor = init.strikeoutColor ?? "#000000";

    this.shadowType = init.shadowType ?? "NONE";
    this.shadowColor = init.shadowColor ?? "#B2B2B2";
    this.shadowOffsetX = init.shadowOffsetX ?? 10;
    this.shadowOffsetY = init.shadowOffsetY ?? 10;

    this.symMark = init.symMark ?? "NONE";

    this.useFontSpace = init.useFontSpace ?? false;
    this.useKerning = init.useKerning ?? false;
    this.borderFillId = init.borderFillId ?? null;
  }

  toXml(w: XmlWriter): void {
    const attrs: Record<string, string | undefined> = {
      id: String(this.id),
      height: String(this.height),
      textColor: colorToHwpx(this.textColor),
      shadeColor: colorToHwpx(this.shadeColor),
      useFontSpace: boolToStr(this.useFontSpace),
      useKerning: boolToStr(this.useKerning),
      symMark: this.symMark,
      borderFillIDRef: this.borderFillId ? String(this.borderFillId) : undefined,
    };
    w.start("hh:charPr", attrs);

    // fontRef
    w.empty("hh:fontRef", {
      hangul: String(this.fontHangul),
      latin: String(this.fontLatin),
      hanja: String(this.fontHanja),
      japanese: String(this.fontJapanese),
      other: String(this.fontOther),
      symbol: String(this.fontSymbol),
      user: String(this.fontUser),
    });

    // ratio
    w.empty("hh:ratio", {
      hangul: String(this.ratioHangul),
      latin: String(this.ratioLatin),
      hanja: String(this.ratioHanja),
      japanese: String(this.ratioJapanese),
      other: String(this.ratioOther),
      symbol: String(this.ratioSymbol),
      user: String(this.ratioUser),
    });

    // spacing
    w.empty("hh:spacing", {
      hangul: String(this.spacingHangul),
      latin: String(this.spacingLatin),
      hanja: String(this.spacingHanja),
      japanese: String(this.spacingJapanese),
      other: String(this.spacingOther),
      symbol: String(this.spacingSymbol),
      user: String(this.spacingUser),
    });

    // relSz
    w.empty("hh:relSz", {
      hangul: String(this.relSizeHangul),
      latin: String(this.relSizeLatin),
      hanja: String(this.relSizeHanja),
      japanese: String(this.relSizeJapanese),
      other: String(this.relSizeOther),
      symbol: String(this.relSizeSymbol),
      user: String(this.relSizeUser),
    });

    // offset
    w.empty("hh:offset", {
      hangul: String(this.offsetHangul),
      latin: String(this.offsetLatin),
      hanja: String(this.offsetHanja),
      japanese: String(this.offsetJapanese),
      other: String(this.offsetOther),
      symbol: String(this.offsetSymbol),
      user: String(this.offsetUser),
    });

    // bold/italic (빈 요소)
    if (this.bold) {
      w.empty("hh:bold");
    }
    if (this.italic) {
      w.empty("hh:italic");
    }

    // superscript/subscript
    if (this.superscript) {
      w.empty("hh:supscript");
    }
    if (this.subscript) {
      w.empty("hh:subscript");
    }

    // underline
    if (this.underlineType !== "NONE") {
      w.empty("hh:underline", {
        type: this.underlineType,
        shape: this.underlineShape,
        color: colorToHwpx(this.underlineColor),
      });
    }

    // strikeout
    if (this.strikeoutShape !== "NONE") {
      w.empty("hh:strikeout", {
        shape: this.strikeoutShape,
        color: colorToHwpx(this.strikeoutColor),
      });
    }

    // outline
    w.empty("hh:outline", { type: this.outlineType });

    // shadow
    if (this.shadowType !== "NONE") {
      w.empty("hh:charShadow", {
        type: this.shadowType,
        color: colorToHwpx(this.shadowColor),
        offsetX: String(this.shadowOffsetX),
        offsetY: String(this.shadowOffsetY),
      });
    }

    w.end("hh:charPr");
  }
}


// ── ParaProperties ──

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


// ── BorderFill ──

export interface BorderLineInit {
  type?: string;
  width?: string;
  color?: string;
}

export class BorderLine {
  type: string;
  width: string;
  color: string;

  constructor(init: BorderLineInit = {}) {
    this.type = init.type ?? "NONE";
    this.width = init.width ?? "0.1 mm";
    this.color = init.color ?? "#000000";
  }
}


export interface SolidFillInit {
  faceColor?: string;
  hatchColor?: string;
  hatchStyle?: string;
  alpha?: number;
}

export class SolidFill {
  faceColor: string;
  hatchColor: string;
  hatchStyle: string;
  alpha: number;

  constructor(init: SolidFillInit = {}) {
    this.faceColor = init.faceColor ?? "#FFFFFF";
    this.hatchColor = init.hatchColor ?? "none";
    this.hatchStyle = init.hatchStyle ?? "NONE";
    this.alpha = init.alpha ?? 0;
  }
}


export interface GradientFillInit {
  type?: string;
  angle?: number;
  centerX?: number;
  centerY?: number;
  step?: number;
  colors?: string[];
  stepCenter?: number;
}

export class GradientFill {
  type: string;       // "LINEAR" | "RADIAL" | "CONICAL" | "SQUARE"
  angle: number;
  centerX: number;
  centerY: number;
  step: number;
  colors: string[];
  stepCenter: number;

  constructor(init: GradientFillInit = {}) {
    this.type = init.type ?? "LINEAR";
    this.angle = init.angle ?? 0;
    this.centerX = init.centerX ?? 0;
    this.centerY = init.centerY ?? 0;
    this.step = init.step ?? 50;
    this.colors = init.colors ?? ["#FF0000", "#0000FF"];
    this.stepCenter = init.stepCenter ?? 50;
  }
}


export interface ImageFillInit {
  mode?: string;
  imageRef?: string;
  bright?: number;
  contrast?: number;
  effect?: string;
  alpha?: number;
}

export class ImageFill {
  mode: string;          // "TILE" | "CENTER" | "STRETCH" | "FIT"
  imageRef: string;      // BinData 참조
  bright: number;
  contrast: number;
  effect: string;        // "REAL_PIC" | "GRAY_SCALE" | "BLACK_WHITE"
  alpha: number;

  constructor(init: ImageFillInit = {}) {
    this.mode = init.mode ?? "TILE";
    this.imageRef = init.imageRef ?? "";
    this.bright = init.bright ?? 0;
    this.contrast = init.contrast ?? 0;
    this.effect = init.effect ?? "REAL_PIC";
    this.alpha = init.alpha ?? 0;
  }
}


export type FillType = SolidFill | GradientFill | ImageFill;

export interface BorderFillInit {
  id?: number;

  threeD?: boolean;
  shadow?: boolean;
  centerLine?: string;

  leftBorder?: BorderLine | null;
  rightBorder?: BorderLine | null;
  topBorder?: BorderLine | null;
  bottomBorder?: BorderLine | null;
  diagonal?: BorderLine | null;

  slashType?: string;
  slashCrooked?: boolean;
  slashIsCounter?: boolean;
  backSlashType?: string;
  backSlashCrooked?: boolean;
  backSlashIsCounter?: boolean;

  fill?: FillType | null;
}

export class BorderFill {
  id: number;  // borderFill은 1부터 시작

  threeD: boolean;
  shadow: boolean;
  centerLine: string;

  leftBorder: BorderLine | null;
  rightBorder: BorderLine | null;
  topBorder: BorderLine | null;
  bottomBorder: BorderLine | null;
  diagonal: BorderLine | null;

  slashType: string;
  slashCrooked: boolean;
  slashIsCounter: boolean;
  backSlashType: string;
  backSlashCrooked: boolean;
  backSlashIsCounter: boolean;

  fill: FillType | null;

  constructor(init: BorderFillInit = {}) {
    this.id = init.id ?? 1;

    this.threeD = init.threeD ?? false;
    this.shadow = init.shadow ?? false;
    this.centerLine = init.centerLine ?? "NONE";

    this.leftBorder = init.leftBorder ?? null;
    this.rightBorder = init.rightBorder ?? null;
    this.topBorder = init.topBorder ?? null;
    this.bottomBorder = init.bottomBorder ?? null;
    this.diagonal = init.diagonal ?? null;

    this.slashType = init.slashType ?? "NONE";
    this.slashCrooked = init.slashCrooked ?? false;
    this.slashIsCounter = init.slashIsCounter ?? false;
    this.backSlashType = init.backSlashType ?? "NONE";
    this.backSlashCrooked = init.backSlashCrooked ?? false;
    this.backSlashIsCounter = init.backSlashIsCounter ?? false;

    this.fill = init.fill ?? null;
  }

  toXml(w: XmlWriter): void {
    w.start("hh:borderFill", {
      id: String(this.id),
      threeD: boolToStr(this.threeD),
      shadow: boolToStr(this.shadow),
      centerLine: this.centerLine,
      breakCellSeparateLine: "0",
    });

    // slash
    w.empty("hh:slash", {
      type: this.slashType,
      Crooked: boolToStr(this.slashCrooked),
      isCounter: boolToStr(this.slashIsCounter),
    });
    w.empty("hh:backSlash", {
      type: this.backSlashType,
      Crooked: boolToStr(this.backSlashCrooked),
      isCounter: boolToStr(this.backSlashIsCounter),
    });

    // borders (4방향 + diagonal)
    const sides: [string, BorderLine | null][] = [
      ["hh:leftBorder", this.leftBorder],
      ["hh:rightBorder", this.rightBorder],
      ["hh:topBorder", this.topBorder],
      ["hh:bottomBorder", this.bottomBorder],
      ["hh:diagonal", this.diagonal],
    ];
    for (const [side, border] of sides) {
      const b = border ?? new BorderLine();
      w.empty(side, {
        type: b.type,
        width: b.width,
        color: colorToHwpx(b.color),
      });
    }

    // fill
    if (this.fill) {
      w.start("hc:fillBrush");
      if (this.fill instanceof SolidFill) {
        w.empty("hc:winBrush", {
          faceColor: colorToHwpx(this.fill.faceColor),
          hatchColor: colorToHwpx(this.fill.hatchColor),
          hatchStyle: this.fill.hatchStyle,
          alpha: String(this.fill.alpha),
        });
      } else if (this.fill instanceof GradientFill) {
        const gf = this.fill;
        w.start("hc:gradation", {
          type: gf.type,
          angle: String(gf.angle),
          centerX: String(gf.centerX),
          centerY: String(gf.centerY),
          step: String(gf.step),
          colorNum: String(gf.colors.length),
          stepCenter: String(gf.stepCenter),
        });
        for (const color of gf.colors) {
          w.textElement("hc:color", colorToHwpx(color));
        }
        w.end("hc:gradation");
      } else if (this.fill instanceof ImageFill) {
        const imf = this.fill;
        w.start("hc:imgBrush", { mode: imf.mode });
        w.empty("hc:img", {
          binaryItemIDRef: imf.imageRef,
          bright: String(imf.bright),
          contrast: String(imf.contrast),
          effect: imf.effect,
          alpha: String(imf.alpha),
        });
        w.end("hc:imgBrush");
      }
      w.end("hc:fillBrush");
    }

    w.end("hh:borderFill");
  }
}


// ── Style ──

export interface StyleInit {
  id?: number;
  type?: string;
  name?: string;
  engName?: string;
  paraPrId?: number;
  charPrId?: number;
  nextStyleId?: number | null;
  langId?: number;
  lockForm?: boolean;
}

export class Style {
  id: number;
  type: string;
  name: string;
  engName: string;
  paraPrId: number;
  charPrId: number;
  nextStyleId: number | null;
  langId: number;
  lockForm: boolean;

  constructor(init: StyleInit = {}) {
    this.id = init.id ?? 0;
    this.type = init.type ?? "PARA";
    this.name = init.name ?? "바탕글";
    this.engName = init.engName ?? "Normal";
    this.paraPrId = init.paraPrId ?? 0;
    this.charPrId = init.charPrId ?? 0;
    this.nextStyleId = init.nextStyleId ?? null;
    this.langId = init.langId ?? 1042;
    this.lockForm = init.lockForm ?? false;
  }

  toXml(w: XmlWriter): void {
    w.empty("hh:style", {
      id: String(this.id),
      type: this.type,
      name: this.name,
      engName: this.engName,
      paraPrIDRef: String(this.paraPrId),
      charPrIDRef: String(this.charPrId),
      nextStyleIDRef: String(this.nextStyleId !== null ? this.nextStyleId : this.id),
      langId: String(this.langId),
      lockForm: boolToStr(this.lockForm),
    });
  }
}


// ── 기본 스타일 팩토리 ──

/** 기본 FontFace 7개 생성 (맑은 고딕, 함초롬돋움). */
export function createDefaultFontfaces(): FontFace[] {
  const faces: FontFace[] = [];
  for (const lang of LANG_GROUPS) {
    faces.push(new FontFace({
      lang,
      fonts: [
        new Font({ id: 0, face: "맑은 고딕", type: "TTF" }),
        new Font({ id: 1, face: "함초롬돋움", type: "TTF" }),
      ],
    }));
  }
  return faces;
}

/** 기본 내장 스타일 13개 생성. */
export function createDefaultStyles(): Style[] {
  return [
    new Style({ id: 0, name: "바탕글", engName: "Normal" }),
    new Style({ id: 1, name: "제목 1", engName: "Heading 1" }),
    new Style({ id: 2, name: "제목 2", engName: "Heading 2" }),
    new Style({ id: 3, name: "제목 3", engName: "Heading 3" }),
    new Style({ id: 4, name: "제목 4", engName: "Heading 4" }),
    new Style({ id: 5, name: "제목 5", engName: "Heading 5" }),
    new Style({ id: 6, name: "제목 6", engName: "Heading 6" }),
    new Style({ id: 7, name: "제목 7", engName: "Heading 7" }),
    new Style({ id: 8, name: "제목 8", engName: "Heading 8" }),
    new Style({ id: 9, name: "제목 9", engName: "Heading 9" }),
    new Style({ id: 10, name: "제목", engName: "Title" }),
    new Style({ id: 11, name: "부제목", engName: "Subtitle" }),
    new Style({ id: 12, name: "각주", engName: "Footnote Text" }),
  ];
}
