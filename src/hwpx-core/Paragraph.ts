/** 문단(Paragraph)과 텍스트 런(TextRun). */

import { XmlWriter } from "./XmlBuilder";
import { xmlEscape, boolToStr } from "./utils";

export class TextRun {
  text: string;
  charPrId: number;

  constructor(text = "", charPrId = 0) {
    this.text = text;
    this.charPrId = charPrId;
  }

  toXml(w: XmlWriter): void {
    w.start("hp:run", { charPrIDRef: String(this.charPrId) });
    w.inlineElement("hp:t", xmlEscape(this.text));
    w.end("hp:run");
  }
}

export type InlineItem = {
  type: "run" | "field" | "bookmark" | "footnote" | "endnote" | "equation";
  item: any;
};

export class Paragraph {
  paraPrId: number;
  styleId: number;
  pageBreak: boolean;
  columnBreak: boolean;
  runs: TextRun[] = [];
  private inlineItems: InlineItem[] = [];
  private secPrXml: string | null = null;

  constructor(paraPrId = 0, styleId = 0, pageBreak = false, columnBreak = false) {
    this.paraPrId = paraPrId;
    this.styleId = styleId;
    this.pageBreak = pageBreak;
    this.columnBreak = columnBreak;
  }

  addRun(text = "", charPrId = 0): TextRun {
    const run = new TextRun(text, charPrId);
    this.runs.push(run);
    this.inlineItems.push({ type: "run", item: run });
    return run;
  }

  addField(field: any): void {
    this.inlineItems.push({ type: "field", item: field });
  }

  addFootnote(note: any): void {
    this.inlineItems.push({ type: "footnote", item: note });
  }

  addEndnote(note: any): void {
    this.inlineItems.push({ type: "endnote", item: note });
  }

  addBookmark(bm: any): void {
    this.inlineItems.push({ type: "bookmark", item: bm });
  }

  addEquation(eq: any): void {
    this.inlineItems.push({ type: "equation", item: eq });
  }

  setSecPr(secPrXml: string): void {
    this.secPrXml = secPrXml;
  }

  toXml(w: XmlWriter): void {
    w.start("hp:p", {
      paraPrIDRef: String(this.paraPrId),
      styleIDRef: String(this.styleId),
      pageBreak: boolToStr(this.pageBreak),
      columnBreak: boolToStr(this.columnBreak),
      merged: "0",
    });

    if (this.secPrXml) {
      w.start("hp:run", { charPrIDRef: "0" });
      w.raw(this.secPrXml);
      w.end("hp:run");
    }

    if (this.inlineItems.length > 0) {
      for (const { type, item } of this.inlineItems) {
        if (type === "run") {
          item.toXml(w);
        } else if (type === "field") {
          w.start("hp:run", { charPrIDRef: "0" });
          item.toXml(w);
          w.end("hp:run");
          if (item.displayText) {
            w.start("hp:run", { charPrIDRef: "0" });
            w.inlineElement("hp:t", xmlEscape(item.displayText));
            w.end("hp:run");
          }
          if (item.toXmlEnd) {
            w.start("hp:run", { charPrIDRef: "0" });
            item.toXmlEnd(w);
            w.end("hp:run");
          }
        } else if (type === "bookmark") {
          w.start("hp:run", { charPrIDRef: "0" });
          item.toXml(w);
          w.end("hp:run");
        } else if (type === "footnote" || type === "endnote") {
          w.start("hp:run", { charPrIDRef: "0" });
          item.toXml(w);
          w.empty("hp:t");
          w.end("hp:run");
        } else if (type === "equation") {
          w.start("hp:run", { charPrIDRef: "0" });
          item.toXml(w);
          w.end("hp:run");
        }
      }
    } else if (!this.secPrXml) {
      w.start("hp:run", { charPrIDRef: "0" });
      w.inlineElement("hp:t", "");
      w.end("hp:run");
    }

    w.end("hp:p");
  }
}
