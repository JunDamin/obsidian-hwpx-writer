/**
 * CharProperties — 문자 속성 (글꼴 크기, 폰트 참조, 굵게/기울임, 밑줄, 취소선 등).
 *
 * header.xml의 `<hh:charProperties>` 하위로 들어가며, Paragraph/Run의 charPrIDRef가 참조한다.
 * 7개 언어 그룹 각각에 대해 fontRef/ratio/spacing/relSize/offset을 독립적으로 가짐.
 */

import { XmlWriter } from "./XmlBuilder";
import { boolToStr, colorToHwpx } from "./utils";

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
