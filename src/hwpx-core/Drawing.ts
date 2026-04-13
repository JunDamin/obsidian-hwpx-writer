/** 그리기 객체(Drawing) -- Rect, Ellipse, Line 등. */

import { boolToStr } from "./utils";
import { XmlWriter } from "./XmlBuilder";
import { Paragraph } from "./Paragraph";

export interface DrawingObjectInit {
  width?: number;
  height?: number;
  treatAsChar?: boolean;
  textWrap?: string;
  textFlow?: string;
  vertRelTo?: string;
  horzRelTo?: string;
  vertAlign?: string;
  horzAlign?: string;
  vertOffset?: number;
  horzOffset?: number;
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: string;
  fillColor?: string;
  zOrder?: number;
  paragraphs?: Paragraph[];
  textMargin?: number;
}

export class DrawingObject {
  width: number;
  height: number;
  treatAsChar: boolean;
  textWrap: string;
  textFlow: string;
  vertRelTo: string;
  horzRelTo: string;
  vertAlign: string;
  horzAlign: string;
  vertOffset: number;
  horzOffset: number;
  lineColor: string;
  lineWidth: number;
  lineStyle: string;
  fillColor: string;
  zOrder: number;
  paragraphs: Paragraph[];
  textMargin: number;
  protected _instId: string;

  constructor(init: DrawingObjectInit = {}) {
    this.width = init.width ?? 14173;       // mm(50)
    this.height = init.height ?? 8504;      // mm(30)
    this.treatAsChar = init.treatAsChar ?? false;
    this.textWrap = init.textWrap ?? "IN_FRONT_OF_TEXT";
    this.textFlow = init.textFlow ?? "BOTH_SIDES";
    this.vertRelTo = init.vertRelTo ?? "PARA";
    this.horzRelTo = init.horzRelTo ?? "PARA";
    this.vertAlign = init.vertAlign ?? "TOP";
    this.horzAlign = init.horzAlign ?? "LEFT";
    this.vertOffset = init.vertOffset ?? 0;
    this.horzOffset = init.horzOffset ?? 0;
    this.lineColor = init.lineColor ?? "#000000";
    this.lineWidth = init.lineWidth ?? 33;    // HWPUNIT (33 ~ 0.12mm)
    this.lineStyle = init.lineStyle ?? "SOLID";
    this.fillColor = init.fillColor ?? "#FFFFFF";
    this.zOrder = init.zOrder ?? 0;
    this.paragraphs = init.paragraphs ?? [];
    this.textMargin = init.textMargin ?? 283;
    this._instId = String(Math.floor(Math.random() * (2147483647 - 100000000)) + 100000000);
  }

  protected writeCommonBefore(w: XmlWriter): void {
    const W = String(this.width);
    const H = String(this.height);
    const cx = String(Math.floor(this.width / 2));
    const cy = String(Math.floor(this.height / 2));

    w.empty("hp:offset", { x: "0", y: "0" });
    w.empty("hp:orgSz", { width: W, height: H });
    w.empty("hp:curSz", { width: "0", height: "0" });
    w.empty("hp:flip", { horizontal: "0", vertical: "0" });
    w.empty("hp:rotationInfo", { angle: "0", centerX: cx, centerY: cy, rotateimage: "1" });

    w.start("hp:renderingInfo");
    w.empty("hc:transMatrix", { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
    w.empty("hc:scaMatrix", { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
    w.empty("hc:rotMatrix", { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
    w.end("hp:renderingInfo");

    // lineShape
    w.empty("hp:lineShape", {
      color: this.lineColor, width: String(this.lineWidth),
      style: this.lineStyle, endCap: "FLAT",
      headStyle: "NORMAL", tailStyle: "NORMAL",
      headfill: "1", tailfill: "1",
      headSz: "MEDIUM_MEDIUM", tailSz: "MEDIUM_MEDIUM",
      outlineStyle: "NORMAL", alpha: "0",
    });

    // fillBrush
    w.start("hc:fillBrush");
    w.empty("hc:winBrush", {
      faceColor: this.fillColor, hatchColor: "#000000", alpha: "0",
    });
    w.end("hc:fillBrush");

    // shadow
    w.empty("hp:shadow", {
      type: "NONE", color: "#B2B2B2",
      offsetX: "0", offsetY: "0", alpha: "0",
    });
  }

  protected writeDrawText(w: XmlWriter): void {
    if (this.paragraphs.length === 0) return;

    w.start("hp:drawText", { lastWidth: String(this.width), name: "", editable: "0" });
    w.start("hp:subList", {
      id: "", textDirection: "HORIZONTAL", lineWrap: "BREAK",
      vertAlign: "CENTER", linkListIDRef: "0", linkListNextIDRef: "0",
      textWidth: "0", textHeight: "0", hasTextRef: "0", hasNumRef: "0",
    });
    for (const p of this.paragraphs) {
      w.start("hp:p", {
        id: "0",
        paraPrIDRef: String(p.paraPrId),
        styleIDRef: String(p.styleId),
        pageBreak: "0", columnBreak: "0", merged: "0",
      });
      for (const run of p.runs) {
        run.toXml(w);
      }
      if (p.runs.length === 0) {
        w.start("hp:run", { charPrIDRef: "0" });
        w.inlineElement("hp:t", "");
        w.end("hp:run");
      }
      // linesegarray (required by Hancom)
      w.start("hp:linesegarray");
      w.empty("hp:lineseg", {
        textpos: "0", vertpos: "0",
        vertsize: "1000", textheight: "1000",
        baseline: "850", spacing: "600",
        horzpos: "0", horzsize: String(this.width),
        flags: "393216",
      });
      w.end("hp:linesegarray");
      w.end("hp:p");
    }
    w.end("hp:subList");
    const m = String(this.textMargin);
    w.empty("hp:textMargin", { left: m, right: m, top: m, bottom: m });
    w.end("hp:drawText");
  }

  protected writeCommonAfter(w: XmlWriter): void {
    const W = String(this.width);
    const H = String(this.height);

    // vertex coordinates
    w.empty("hc:pt0", { x: "0", y: "0" });
    w.empty("hc:pt1", { x: W, y: "0" });
    w.empty("hc:pt2", { x: W, y: H });
    w.empty("hc:pt3", { x: "0", y: H });

    w.empty("hp:sz", {
      width: W, widthRelTo: "ABSOLUTE",
      height: H, heightRelTo: "ABSOLUTE", protect: "0",
    });
    w.empty("hp:pos", {
      treatAsChar: boolToStr(this.treatAsChar),
      affectLSpacing: "0", flowWithText: "1", allowOverlap: "1",
      holdAnchorAndSO: "0",
      vertRelTo: this.vertRelTo, horzRelTo: this.horzRelTo,
      vertAlign: this.vertAlign, horzAlign: this.horzAlign,
      vertOffset: String(this.vertOffset), horzOffset: String(this.horzOffset),
    });
    w.empty("hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });
  }

  toXml(w: XmlWriter): void {
    // Base class -- subclasses override
  }
}


// ── Rect ──

export interface RectInit extends DrawingObjectInit {
  ratio?: number;
}

export class Rect extends DrawingObject {
  ratio: number;

  constructor(init: RectInit = {}) {
    super(init);
    this.ratio = init.ratio ?? 0;
  }

  toXml(w: XmlWriter): void {
    w.start("hp:rect", {
      id: this._instId, zOrder: String(this.zOrder),
      numberingType: "PICTURE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None",
      href: "", groupLevel: "0", instid: this._instId,
      ratio: String(this.ratio),
    });
    this.writeCommonBefore(w);
    this.writeDrawText(w);
    this.writeCommonAfter(w);
    w.textElement("hp:shapeComment", "");
    w.end("hp:rect");
  }
}


// ── Ellipse ──

export interface EllipseInit extends DrawingObjectInit {
  arcType?: string;
}

export class Ellipse extends DrawingObject {
  arcType: string;

  constructor(init: EllipseInit = {}) {
    super(init);
    this.arcType = init.arcType ?? "NORMAL";
  }

  toXml(w: XmlWriter): void {
    const W = String(this.width);
    const H = String(this.height);
    const cx = String(Math.floor(this.width / 2));
    const cy = String(Math.floor(this.height / 2));

    w.start("hp:ellipse", {
      id: this._instId, zOrder: String(this.zOrder),
      numberingType: "PICTURE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None",
      href: "", groupLevel: "0", instid: this._instId,
      intervalDirty: "0", hasArcPr: "0", arcType: this.arcType,
    });
    this.writeCommonBefore(w);
    this.writeDrawText(w);

    // ellipse-specific coordinates (center/ax instead of pt0-pt3)
    w.empty("hc:center", { x: cx, y: cy });
    w.empty("hc:ax1", { x: W, y: cy });
    w.empty("hc:ax2", { x: cx, y: "0" });
    w.empty("hc:start1", { x: "0", y: "0" });
    w.empty("hc:end1", { x: "0", y: "0" });
    w.empty("hc:start2", { x: "0", y: "0" });
    w.empty("hc:end2", { x: "0", y: "0" });

    // sz, pos, outMargin (no pt0-pt3)
    w.empty("hp:sz", {
      width: W, widthRelTo: "ABSOLUTE",
      height: H, heightRelTo: "ABSOLUTE", protect: "0",
    });
    w.empty("hp:pos", {
      treatAsChar: boolToStr(this.treatAsChar),
      affectLSpacing: "0", flowWithText: "1", allowOverlap: "1",
      holdAnchorAndSO: "0",
      vertRelTo: this.vertRelTo, horzRelTo: this.horzRelTo,
      vertAlign: this.vertAlign, horzAlign: this.horzAlign,
      vertOffset: String(this.vertOffset), horzOffset: String(this.horzOffset),
    });
    w.empty("hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });

    w.textElement("hp:shapeComment", "");
    w.end("hp:ellipse");
  }
}


// ── Line ──

export interface LineInit extends DrawingObjectInit {
  isReverseHV?: boolean;
}

export class Line extends DrawingObject {
  isReverseHV: boolean;

  constructor(init: LineInit = {}) {
    super(init);
    this.isReverseHV = init.isReverseHV ?? false;
  }

  toXml(w: XmlWriter): void {
    w.start("hp:line", {
      id: this._instId, zOrder: String(this.zOrder),
      numberingType: "PICTURE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None",
      href: "", groupLevel: "0", instid: this._instId,
      isReverseHV: boolToStr(this.isReverseHV),
    });
    this.writeCommonBefore(w);
    this.writeCommonAfter(w);
    w.textElement("hp:shapeComment", "");
    w.end("hp:line");
  }
}


// TextBox = Rect with paragraphs
export const TextBox = Rect;

// Arc = Ellipse
export const Arc = Ellipse;


// ── Polygon ──

export interface PolygonInit extends DrawingObjectInit {
  points?: [number, number][];
}

export class Polygon extends DrawingObject {
  points: [number, number][];

  constructor(init: PolygonInit = {}) {
    super(init);
    this.points = init.points ?? [];
  }

  toXml(w: XmlWriter): void {
    w.start("hp:polygon", {
      id: this._instId, zOrder: String(this.zOrder),
      numberingType: "PICTURE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None",
      href: "", groupLevel: "0", instid: this._instId,
    });
    this.writeCommonBefore(w);
    this.writeDrawText(w);
    this.writeCommonAfter(w);
    w.textElement("hp:shapeComment", "");
    w.end("hp:polygon");
  }
}


// ── Curve ──

export class Curve extends DrawingObject {
  toXml(w: XmlWriter): void {
    w.start("hp:curve", {
      id: this._instId, zOrder: String(this.zOrder),
      numberingType: "PICTURE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None",
      href: "", groupLevel: "0", instid: this._instId,
    });
    this.writeCommonBefore(w);
    this.writeCommonAfter(w);
    w.textElement("hp:shapeComment", "");
    w.end("hp:curve");
  }
}


// ── ConnectLine ──

export class ConnectLine extends DrawingObject {
  toXml(w: XmlWriter): void {
    w.start("hp:connectLine", {
      id: this._instId, zOrder: String(this.zOrder),
      numberingType: "PICTURE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None",
      href: "", groupLevel: "0", instid: this._instId,
    });
    this.writeCommonBefore(w);
    this.writeCommonAfter(w);
    w.textElement("hp:shapeComment", "");
    w.end("hp:connectLine");
  }
}
