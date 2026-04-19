/** 섹션(Section) -- 페이지 설정, 본문 컨테이너. */

import { NS } from "./constants";
import { boolToStr } from "./utils";
import { XmlWriter } from "./XmlBuilder";
import { Paragraph } from "./Paragraph";
import { Table } from "./Table";
import { Image } from "./Image";
import { Equation } from "./Equation";
import { Header, Footer, PageNum } from "./HeaderFooter";
import type { DrawingObject } from "./Drawing";

type ContentItem =
  | { type: "para"; item: Paragraph }
  | { type: "table"; item: Table }
  | { type: "image"; item: Image }
  | { type: "equation"; item: Equation }
  | { type: "drawing"; item: DrawingObject };


// ── ColumnSetting ──

export interface ColumnSettingInit {
  colCount?: number;
  type?: string;
  layout?: string;
  sameSize?: boolean;
  sameGap?: number | boolean;
  colSizes?: [number, number][];
  separatorType?: string;
  separatorWidth?: string;
  separatorColor?: string;
}

export class ColumnSetting {
  colCount: number;
  type: string;
  layout: string;
  sameSize: boolean;
  sameGap: number | boolean;
  colSizes: [number, number][] | undefined;
  separatorType: string;
  separatorWidth: string;
  separatorColor: string;

  constructor(init: ColumnSettingInit = {}) {
    this.colCount = init.colCount ?? 1;
    this.type = init.type ?? "NEWSPAPER";
    this.layout = init.layout ?? "LEFT";
    this.sameSize = init.sameSize ?? true;
    this.sameGap = init.sameGap ?? 1134;
    this.colSizes = init.colSizes;
    this.separatorType = init.separatorType ?? "NONE";
    this.separatorWidth = init.separatorWidth ?? "0.1 mm";
    this.separatorColor = init.separatorColor ?? "#000000";
  }

  toXml(w: XmlWriter): void {
    let gapVal: string;
    if (typeof this.sameGap === "boolean") {
      gapVal = this.sameGap ? "1134" : "0";
    } else {
      gapVal = String(this.sameGap);
    }

    const attrs: Record<string, string> = {
      id: "",
      type: this.type,
      layout: this.layout,
      colCount: String(this.colCount),
      sameSz: boolToStr(this.sameSize),
      sameGap: gapVal,
    };

    if (this.separatorType !== "NONE" || (this.colSizes && !this.sameSize)) {
      w.start("hp:colPr", attrs);
      if (this.separatorType !== "NONE") {
        w.empty("hp:colLine", {
          type: this.separatorType,
          width: this.separatorWidth,
          color: this.separatorColor,
        });
      }
      if (this.colSizes && !this.sameSize) {
        for (const [width, gap] of this.colSizes) {
          w.empty("hp:colSz", { width: String(width), gap: String(gap) });
        }
      }
      w.end("hp:colPr");
    } else {
      w.empty("hp:colPr", attrs);
    }
  }
}


// ── Section ──

export interface SectionInit {
  pageWidth?: number;
  pageHeight?: number;
  landscape?: boolean;
  marginLeft?: number;
  marginRight?: number;
  marginTop?: number;
  marginBottom?: number;
  marginHeader?: number;
  marginFooter?: number;
  marginGutter?: number;
  textDirection?: string;
  tabStop?: number;
  columns?: ColumnSetting;
}

export class Section {
  pageWidth: number;
  pageHeight: number;
  landscape: boolean;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  marginHeader: number;
  marginFooter: number;
  marginGutter: number;
  textDirection: string;
  tabStop: number;
  columns: ColumnSetting | undefined;

  private _paragraphs: Paragraph[] = [];
  private _contentItems: ContentItem[] = [];
  private _header: Header | undefined;
  private _footer: Footer | undefined;

  /** Back-reference to document for convenience API (set by Document). */
  _document: {
    _getOrCreateCharPr(opts: {
      bold?: boolean; italic?: boolean; fontSize?: number;
      textColor?: string; underline?: boolean;
    }): number;
    _getOrCreateParaPr(opts: { align?: string }): number;
  } | null = null;

  constructor(init: SectionInit = {}) {
    this.pageWidth = init.pageWidth ?? 59530;     // A4
    this.pageHeight = init.pageHeight ?? 84190;   // A4
    this.landscape = init.landscape ?? false;
    this.marginLeft = init.marginLeft ?? 5670;    // mm(20)
    this.marginRight = init.marginRight ?? 4252;  // mm(15)
    this.marginTop = init.marginTop ?? 4252;
    this.marginBottom = init.marginBottom ?? 4252;
    this.marginHeader = init.marginHeader ?? 4252;
    this.marginFooter = init.marginFooter ?? 4252;
    this.marginGutter = init.marginGutter ?? 0;
    this.textDirection = init.textDirection ?? "HORIZONTAL";
    this.tabStop = init.tabStop ?? 8000;
    this.columns = init.columns;
  }

  addParagraph(
    textOrPara?: string | Paragraph,
    opts: {
      paraPrId?: number;
      styleId?: number;
      charPrId?: number;
      bold?: boolean;
      italic?: boolean;
      fontSize?: number;
      textColor?: string;
      underline?: boolean;
      align?: string;
    } = {},
  ): Paragraph {
    if (textOrPara instanceof Paragraph) {
      this._paragraphs.push(textOrPara);
      this._contentItems.push({ type: "para", item: textOrPara });
      return textOrPara;
    }

    let charPrId = opts.charPrId ?? 0;
    let paraPrId = opts.paraPrId ?? 0;
    const styleId = opts.styleId ?? 0;

    // Convenience options: auto-register charPr/paraPr via document reference
    if (this._document && (opts.bold || opts.italic || opts.fontSize || opts.textColor || opts.underline)) {
      charPrId = this._document._getOrCreateCharPr({
        bold: opts.bold, italic: opts.italic,
        fontSize: opts.fontSize, textColor: opts.textColor,
        underline: opts.underline,
      });
    }
    if (this._document && opts.align) {
      paraPrId = this._document._getOrCreateParaPr({ align: opts.align });
    }

    const p = new Paragraph(paraPrId, styleId);
    if (textOrPara && typeof textOrPara === "string") {
      p.addRun(textOrPara, charPrId);
    }
    this._paragraphs.push(p);
    this._contentItems.push({ type: "para", item: p });
    return p;
  }

  addTable(opts: {
    rows: number;
    cols: number;
    colWidths?: number[];
    totalWidth?: number;
    [key: string]: unknown;
  }): Table {
    const totalWidth = opts.totalWidth ?? (this.pageWidth - this.marginLeft - this.marginRight);
    const tbl = new Table({ ...opts, totalWidth });
    this._contentItems.push({ type: "table", item: tbl });
    return tbl;
  }

  addImage(init: ConstructorParameters<typeof Image>[0]): Image {
    const img = new Image(init);
    this._contentItems.push({ type: "image", item: img });
    return img;
  }

  setHeader(header: Header): void {
    this._header = header;
  }

  setFooter(footer: Footer): void {
    this._footer = footer;
  }

  addEquation(init: ConstructorParameters<typeof Equation>[0] = {}): Equation {
    const eq = new Equation(init);
    this._contentItems.push({ type: "equation", item: eq });
    return eq;
  }

  addDrawing(drawing: DrawingObject): DrawingObject {
    this._contentItems.push({ type: "drawing", item: drawing });
    return drawing;
  }

  addPageBreak(): Paragraph {
    const p = new Paragraph(0, 0, true, false);
    this._contentItems.push({ type: "para", item: p });
    this._paragraphs.push(p);
    return p;
  }

  addColumnBreak(): Paragraph {
    const p = new Paragraph(0, 0, false, true);
    this._contentItems.push({ type: "para", item: p });
    this._paragraphs.push(p);
    return p;
  }

  get paragraphs(): Paragraph[] {
    return this._paragraphs;
  }

  get images(): Image[] {
    return this._contentItems
      .filter((ci): ci is { type: "image"; item: Image } => ci.type === "image")
      .map(ci => ci.item);
  }

  buildSecPrXml(): string {
    const w = new XmlWriter();

    const landscapeVal = this.landscape ? "NARROWLY" : "WIDELY";
    const width = this.pageWidth;
    const height = this.pageHeight;

    w.start("hp:secPr", {
      id: "",
      textDirection: this.textDirection,
      spaceColumns: "1134",
      tabStop: String(this.tabStop),
      tabStopVal: "4000",
      tabStopUnit: "HWPUNIT",
      outlineShapeIDRef: "1",
      memoShapeIDRef: "1",
      textVerticalWidthHead: "0",
      masterPageCnt: "0",
    });

    // grid
    w.empty("hp:grid", { lineGrid: "0", charGrid: "0", wonggojiFormat: "0" });

    // startNum
    w.empty("hp:startNum", {
      pageStartsOn: "BOTH", page: "0", pic: "0", tbl: "0", equation: "0",
    });

    // visibility
    w.empty("hp:visibility", {
      hideFirstHeader: "0", hideFirstFooter: "0", hideFirstMasterPage: "0",
      border: "SHOW_ALL", fill: "SHOW_ALL", hideFirstPageNum: "0",
      hideFirstEmptyLine: "0", showLineNumber: "0",
    });

    // lineNumberShape
    w.empty("hp:lineNumberShape", {
      restartType: "0", countBy: "0", distance: "0", startNumber: "0",
    });

    w.start("hp:pagePr", {
      landscape: landscapeVal,
      width: String(width),
      height: String(height),
      gutterType: "LEFT_ONLY",
    });
    w.empty("hp:margin", {
      header: String(this.marginHeader),
      footer: String(this.marginFooter),
      left: String(this.marginLeft),
      right: String(this.marginRight),
      top: String(this.marginTop),
      bottom: String(this.marginBottom),
      gutter: String(this.marginGutter),
    });
    w.end("hp:pagePr");

    // footnoteShape
    w.start("hp:footNotePr");
    w.empty("hp:autoNumFormat", {
      type: "DIGIT", userChar: "", prefixChar: "", suffixChar: ")", supscript: "1",
    });
    w.empty("hp:noteLine", { length: "-1", type: "SOLID", width: "0.25 mm", color: "#000000" });
    w.empty("hp:noteSpacing", { betweenNotes: "283", belowLine: "0", aboveLine: "1000" });
    w.empty("hp:numbering", { type: "CONTINUOUS", newNum: "1" });
    w.empty("hp:placement", { place: "EACH_COLUMN", beneathText: "0" });
    w.end("hp:footNotePr");

    // endnoteShape
    w.start("hp:endNotePr");
    w.empty("hp:autoNumFormat", {
      type: "ROMAN_SMALL", userChar: "", prefixChar: "", suffixChar: ")", supscript: "1",
    });
    w.empty("hp:noteLine", { length: "14692344", type: "SOLID", width: "0.25 mm", color: "#000000" });
    w.empty("hp:noteSpacing", { betweenNotes: "0", belowLine: "0", aboveLine: "1000" });
    w.empty("hp:numbering", { type: "CONTINUOUS", newNum: "1" });
    w.empty("hp:placement", { place: "END_OF_DOCUMENT", beneathText: "0" });
    w.end("hp:endNotePr");

    w.end("hp:secPr");
    return w.toString();
  }

  toXml(): string {
    const w = new XmlWriter();
    w.decl();

    // root: hs:sec with all namespace declarations
    const nsAttrs: Record<string, string> = {};
    for (const [prefix, uri] of Object.entries(NS)) {
      nsAttrs[`xmlns:${prefix}`] = uri;
    }
    w.start("hs:sec", nsAttrs);

    // first paragraph (secPr + header/footer)
    const secPrXml = this.buildSecPrXml();
    const textWidth = this.pageWidth - this.marginLeft - this.marginRight;

    w.start("hp:p", {
      paraPrIDRef: "0", styleIDRef: "0",
      pageBreak: "0", columnBreak: "0", merged: "0",
    });

    // secPr run (secPr + colPr)
    w.start("hp:run", { charPrIDRef: "0" });
    w.raw(secPrXml);
    // column setting
    const col = this.columns ?? new ColumnSetting();
    w.start("hp:ctrl");
    col.toXml(w);
    w.end("hp:ctrl");
    w.end("hp:run");

    // header/footer/pageNum in a separate run
    if (this._header || this._footer) {
      w.start("hp:run", { charPrIDRef: "0" });
      if (this._footer) {
        const pageNum = new PageNum();
        pageNum.toXml(w);
      }
      if (this._header) {
        this._header.toXml(w, textWidth, this.marginHeader);
      }
      if (this._footer) {
        this._footer.toXml(w, textWidth, this.marginFooter);
      }
      // empty hp:t at end of run
      w.empty("hp:t");
      w.end("hp:run");
    }

    w.end("hp:p");

    // content items (paragraphs, tables, images, equations, drawings)
    for (const ci of this._contentItems) {
      if (ci.type === "para") {
        ci.item.toXml(w);
      } else if (ci.type === "table") {
        w.start("hp:p", {
          paraPrIDRef: "0", styleIDRef: "0",
          pageBreak: "0", columnBreak: "0", merged: "0",
        });
        w.start("hp:run", { charPrIDRef: "0" });
        ci.item.toXml(w);
        w.end("hp:run");
        w.end("hp:p");
      } else if (ci.type === "image") {
        w.start("hp:p", {
          paraPrIDRef: "0", styleIDRef: "0",
          pageBreak: "0", columnBreak: "0", merged: "0",
        });
        w.start("hp:run", { charPrIDRef: "0" });
        ci.item.toXml(w, ci.item.binItemId);
        w.end("hp:run");
        w.end("hp:p");
      } else if (ci.type === "equation") {
        w.start("hp:p", {
          paraPrIDRef: "0", styleIDRef: "0",
          pageBreak: "0", columnBreak: "0", merged: "0",
        });
        w.start("hp:run", { charPrIDRef: "0" });
        ci.item.toXml(w);
        w.end("hp:run");
        w.end("hp:p");
      } else if (ci.type === "drawing") {
        w.start("hp:p", {
          id: "0", paraPrIDRef: "0", styleIDRef: "0",
          pageBreak: "0", columnBreak: "0", merged: "0",
        });
        w.start("hp:run", { charPrIDRef: "0" });
        ci.item.toXml(w);
        w.empty("hp:t");
        w.end("hp:run");
        // linesegarray (required by Hancom)
        w.start("hp:linesegarray");
        w.empty("hp:lineseg", {
          textpos: "0", vertpos: "0",
          vertsize: "1000", textheight: "1000",
          baseline: "850", spacing: "600",
          horzpos: "0", horzsize: "48188",
          flags: "393216",
        });
        w.end("hp:linesegarray");
        w.end("hp:p");
      }
    }

    w.end("hs:sec");
    return w.toString();
  }
}
