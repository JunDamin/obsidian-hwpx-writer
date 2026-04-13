/** 필드(Field) -- Hyperlink, Bookmark, CrossRef, Citation, DateField 등. */

import { xmlEscape, IdCounter } from "./utils";
import { XmlWriter } from "./XmlBuilder";

const fieldIdCounter = new IdCounter(7700000);
const footnoteCounter = new IdCounter(1);

function nextFieldId(): number {
  return fieldIdCounter.next();
}


// ── FieldBase ──

export class FieldBase {
  fieldType = "";
  displayText = "";
  protected _fieldId = 0;

  protected _getParameters(): [string, string, string][] {
    return [];
  }

  toXml(w: XmlWriter, charPrId = 0): void {
    const fid = nextFieldId();
    this._fieldId = fid;

    w.start("hp:ctrl");
    const attrs: Record<string, string> = {
      id: String(fid), type: this.fieldType, name: "",
      editable: "0", dirty: "0", zorder: "-1",
      fieldid: String(fid), metaTag: "",
    };
    const params = this._getParameters();
    if (params.length > 0) {
      w.start("hp:fieldBegin", attrs);
      w.start("hp:parameters", { cnt: String(params.length), name: "" });
      for (const [ptype, pname, pval] of params) {
        if (ptype === "integer") {
          w.textElement("hp:integerParam", pval, { name: pname });
        } else {
          w.textElement("hp:stringParam", pval, { name: pname });
        }
      }
      w.end("hp:parameters");
      w.end("hp:fieldBegin");
    } else {
      w.empty("hp:fieldBegin", attrs);
    }
    w.end("hp:ctrl");
  }

  toXmlEnd(w: XmlWriter): void {
    w.start("hp:ctrl");
    w.empty("hp:fieldEnd", {
      beginIDRef: String(this._fieldId),
      fieldid: String(this._fieldId),
    });
    w.end("hp:ctrl");
  }
}


// ── Hyperlink ──

export class Hyperlink extends FieldBase {
  url: string;

  constructor(url: string, text: string, targetFrame = "") {
    super();
    this.fieldType = "HYPERLINK";
    this.displayText = text;
    this.url = url;
  }

  protected _getParameters(): [string, string, string][] {
    const escapedUrl = this.url.replace(/:/g, "\\:");
    return [
      ["integer", "Prop", "0"],
      ["string", "Command", `${escapedUrl};1;5;-1;`],
      ["string", "Path", this.url],
      ["string", "Category", "HWPHYPERLINK_TYPE_URL"],
      ["string", "TargetType", "HWPHYPERLINK_TARGET_HYPERLINK"],
      ["string", "DocOpenType", "HWPHYPERLINK_JUMP_DONTCARE"],
    ];
  }
}


// ── Bookmark ──

export class Bookmark {
  name: string;
  type: string;
  private _id: number;

  private static _nameToId: Map<string, number> = new Map();

  constructor(name: string, type: "START" | "END" = "START") {
    this.name = name;
    this.type = type;
    if (type === "START") {
      this._id = nextFieldId();
      Bookmark._nameToId.set(name, this._id);
    } else {
      this._id = Bookmark._nameToId.get(name) ?? nextFieldId();
    }
  }

  toXml(w: XmlWriter, charPrId = 0): void {
    if (this.type === "START") {
      w.start("hp:ctrl");
      w.empty("hp:fieldBegin", {
        id: String(this._id), type: "BOOKMARK",
        name: xmlEscape(this.name), editable: "0",
        dirty: "0", zorder: "-1",
        fieldid: String(this._id), metaTag: "",
      });
      w.end("hp:ctrl");
    } else {
      w.start("hp:ctrl");
      w.empty("hp:fieldEnd", {
        beginIDRef: String(this._id), fieldid: String(this._id),
      });
      w.end("hp:ctrl");
    }
  }
}


// ── CrossRef ──

export class CrossRef extends FieldBase {
  refTarget: string;
  refType: string;

  constructor(refTarget: string, refType = "TEXT", displayText = "") {
    super();
    this.fieldType = "CROSSREF";
    this.displayText = displayText;
    this.refTarget = refTarget;
    this.refType = refType;
  }

  protected _getParameters(): [string, string, string][] {
    return [
      ["string", "refTarget", this.refTarget],
      ["string", "refType", this.refType],
    ];
  }
}


// ── Citation ──

export class Citation extends FieldBase {
  citeKey: string;

  constructor(citeKey: string, displayText = "") {
    super();
    this.fieldType = "CITATION";
    this.displayText = displayText;
    this.citeKey = citeKey;
  }

  protected _getParameters(): [string, string, string][] {
    return [["string", "citeKey", this.citeKey]];
  }
}


// ── Bibliography ──

export class Bibliography extends FieldBase {
  citeKey: string;

  constructor(citeKey: string, text = "") {
    super();
    this.fieldType = "BIBLIOGRAPHY";
    this.displayText = text;
    this.citeKey = citeKey;
  }

  protected _getParameters(): [string, string, string][] {
    return [["string", "citeKey", this.citeKey]];
  }
}


// ── DateField ──

export class DateField extends FieldBase {
  format: string;

  constructor(format = "yyyy-MM-dd", country = "KOR") {
    super();
    this.fieldType = "DATE";
    this.displayText = "";
    this.format = format;
  }

  protected _getParameters(): [string, string, string][] {
    return [["string", "Format", this.format]];
  }
}


// ── DocInfoField ──

export class DocInfoField extends FieldBase {
  infoType: string;

  constructor(infoType: string) {
    super();
    this.fieldType = "USE_INFO";
    this.displayText = "";
    this.infoType = infoType;
  }

  protected _getParameters(): [string, string, string][] {
    return [["string", "InfoType", this.infoType]];
  }
}


// ── ClickHere ──

export class ClickHere extends FieldBase {
  direction: string;
  helpState: string;

  constructor(direction = "", helpState = "") {
    super();
    this.fieldType = "CLICK_HERE";
    this.displayText = direction;
    this.direction = direction;
    this.helpState = helpState;
  }

  protected _getParameters(): [string, string, string][] {
    return [
      ["string", "Direction", this.direction],
      ["string", "HelpState", this.helpState],
    ];
  }
}


// ── Memo ──

export class Memo extends FieldBase {
  content: string;

  constructor(content = "") {
    super();
    this.fieldType = "MEMO";
    this.displayText = "";
    this.content = content;
  }

  protected _getParameters(): [string, string, string][] {
    return [["string", "Content", this.content]];
  }
}


// ── Footnote ──

export class Footnote {
  numType: string;
  private _contentText: string;

  constructor(content?: string, numType = "DIGIT") {
    this.numType = numType;
    this._contentText = typeof content === "string" ? content : "";
  }

  toXml(w: XmlWriter, charPrId = 0): void {
    const num = footnoteCounter.next();
    const instId = String(Math.floor(Math.random() * (2147483647 - 1000000000)) + 1000000000);

    w.start("hp:ctrl");
    w.start("hp:footNote", {
      number: String(num),
      suffixChar: "41",  // ')' ASCII
      instId,
    });
    w.start("hp:subList", {
      id: "", textDirection: "HORIZONTAL", lineWrap: "BREAK",
      vertAlign: "TOP", linkListIDRef: "0", linkListNextIDRef: "0",
      textWidth: "0", textHeight: "0", hasTextRef: "0", hasNumRef: "0",
    });
    w.start("hp:p", {
      paraPrIDRef: "0", styleIDRef: "0",
      pageBreak: "0", columnBreak: "0", merged: "0",
    });
    w.start("hp:run", { charPrIDRef: "0" });
    // autoNum (inside hp:ctrl)
    w.start("hp:ctrl");
    w.start("hp:autoNum", { num: String(num), numType: "FOOTNOTE" });
    w.empty("hp:autoNumFormat", {
      type: this.numType,
      userChar: "", prefixChar: "", suffixChar: ")",
      supscript: "0",
    });
    w.end("hp:autoNum");
    w.end("hp:ctrl");
    // text
    if (this._contentText) {
      w.inlineElement("hp:t", " " + xmlEscape(this._contentText));
    } else {
      w.empty("hp:t");
    }
    w.end("hp:run");
    w.end("hp:p");
    w.end("hp:subList");
    w.end("hp:footNote");
    w.end("hp:ctrl");
  }
}


// ── Endnote ──

export class Endnote {
  numType: string;
  private _contentText: string;

  constructor(content?: string, numType = "ROMAN_SMALL") {
    this.numType = numType;
    this._contentText = typeof content === "string" ? content : "";
  }

  toXml(w: XmlWriter, charPrId = 0): void {
    const num = footnoteCounter.next();
    const instId = String(Math.floor(Math.random() * (2147483647 - 1000000000)) + 1000000000);

    w.start("hp:ctrl");
    w.start("hp:endNote", {
      number: String(num),
      suffixChar: "41",
      instId,
    });
    w.start("hp:subList", {
      id: "", textDirection: "HORIZONTAL", lineWrap: "BREAK",
      vertAlign: "TOP", linkListIDRef: "0", linkListNextIDRef: "0",
      textWidth: "0", textHeight: "0", hasTextRef: "0", hasNumRef: "0",
    });
    w.start("hp:p", {
      paraPrIDRef: "0", styleIDRef: "0",
      pageBreak: "0", columnBreak: "0", merged: "0",
    });
    w.start("hp:run", { charPrIDRef: "0" });
    w.start("hp:ctrl");
    w.start("hp:autoNum", { num: String(num), numType: "ENDNOTE" });
    w.empty("hp:autoNumFormat", {
      type: this.numType,
      userChar: "", prefixChar: "", suffixChar: ")",
      supscript: "0",
    });
    w.end("hp:autoNum");
    w.end("hp:ctrl");
    if (this._contentText) {
      w.inlineElement("hp:t", " " + xmlEscape(this._contentText));
    } else {
      w.empty("hp:t");
    }
    w.end("hp:run");
    w.end("hp:p");
    w.end("hp:subList");
    w.end("hp:endNote");
    w.end("hp:ctrl");
  }
}
