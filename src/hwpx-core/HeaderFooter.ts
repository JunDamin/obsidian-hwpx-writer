/** 머리말(Header) / 꼬리말(Footer) / 쪽번호(PageNum). */

import { XmlWriter } from "./XmlBuilder";
import { Paragraph } from "./Paragraph";

export interface HeaderInit {
  type?: string;
  paragraphs?: Paragraph[];
}

export class Header {
  type: string;
  paragraphs: Paragraph[];

  constructor(init: HeaderInit = {}) {
    this.type = init.type ?? "BOTH";  // "BOTH" | "EVEN" | "ODD"
    this.paragraphs = init.paragraphs ?? [];
  }

  toXml(w: XmlWriter, textWidth = 48190, textHeight = 4251): void {
    w.start("hp:ctrl");
    w.start("hp:header", { id: "0", applyPageType: this.type });
    w.start("hp:subList", {
      id: "", textDirection: "HORIZONTAL", lineWrap: "BREAK",
      vertAlign: "TOP", linkListIDRef: "0", linkListNextIDRef: "0",
      textWidth: String(textWidth), textHeight: String(textHeight),
      hasTextRef: "0", hasNumRef: "0",
    });
    if (this.paragraphs.length > 0) {
      for (const p of this.paragraphs) {
        p.toXml(w);
      }
    } else {
      const empty = new Paragraph();
      empty.toXml(w);
    }
    w.end("hp:subList");
    w.end("hp:header");
    w.end("hp:ctrl");
  }
}


export interface FooterInit {
  type?: string;
  paragraphs?: Paragraph[];
}

export class Footer {
  type: string;
  paragraphs: Paragraph[];

  constructor(init: FooterInit = {}) {
    this.type = init.type ?? "BOTH";
    this.paragraphs = init.paragraphs ?? [];
  }

  toXml(w: XmlWriter, textWidth = 48190, textHeight = 4251): void {
    w.start("hp:ctrl");
    w.start("hp:footer", { id: "0", applyPageType: this.type });
    w.start("hp:subList", {
      id: "", textDirection: "HORIZONTAL", lineWrap: "BREAK",
      vertAlign: "TOP", linkListIDRef: "0", linkListNextIDRef: "0",
      textWidth: String(textWidth), textHeight: String(textHeight),
      hasTextRef: "0", hasNumRef: "0",
    });
    if (this.paragraphs.length > 0) {
      for (const p of this.paragraphs) {
        p.toXml(w);
      }
    } else {
      const empty = new Paragraph();
      empty.toXml(w);
    }
    w.end("hp:subList");
    w.end("hp:footer");
    w.end("hp:ctrl");
  }
}


export interface PageNumInit {
  pos?: string;
  formatType?: string;
  sideChar?: string;
}

export class PageNum {
  pos: string;
  formatType: string;
  sideChar: string;

  constructor(init: PageNumInit = {}) {
    this.pos = init.pos ?? "BOTTOM_CENTER";
    this.formatType = init.formatType ?? "DIGIT";
    this.sideChar = init.sideChar ?? "-";
  }

  toXml(w: XmlWriter): void {
    w.start("hp:ctrl");
    w.empty("hp:pageNum", {
      pos: this.pos,
      formatType: this.formatType,
      sideChar: this.sideChar,
    });
    w.end("hp:ctrl");
  }
}
