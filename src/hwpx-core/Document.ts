/** HwpxDocument -- 최상위 문서 객체. 모든 XML/ZIP 조립을 담당. */

import { NS } from "./constants";
import { pt } from "./units";
import { IdCounter, xmlEscape } from "./utils";
import { XmlWriter } from "./XmlBuilder";
import { HwpxZipPackager } from "./ZipPackager";
import {
  CharProperties, ParaProperties, BorderFill, Style,
  FontFace, Font, SolidFill,
  createDefaultFontfaces, createDefaultStyles,
} from "./Styles";
import { Section } from "./Section";
import { Paragraph } from "./Paragraph";
import type { Image } from "./Image";

export interface HwpxDocumentInit {
  title?: string;
  creator?: string;
  subject?: string;
  description?: string;
  keywords?: string;
  language?: string;
}

export class HwpxDocument {
  title: string;
  creator: string;
  subject: string;
  description: string;
  keywords: string;
  language: string;

  private _sections: Section[] = [];
  private _fontfaces: FontFace[];
  private _charProperties: CharProperties[];
  private _paraProperties: ParaProperties[];
  private _borderFills: BorderFill[];
  private _styles: Style[];

  private _charPrCounter: IdCounter;
  private _paraPrCounter: IdCounter;
  private _borderFillCounter: IdCounter;
  private _styleCounter: IdCounter;

  constructor(init: HwpxDocumentInit = {}) {
    this.title = init.title ?? "";
    this.creator = init.creator ?? "";
    this.subject = init.subject ?? "";
    this.description = init.description ?? "";
    this.keywords = init.keywords ?? "";
    this.language = init.language ?? "ko";

    this._fontfaces = createDefaultFontfaces();
    this._charProperties = [new CharProperties({ id: 0 })];
    this._paraProperties = [new ParaProperties({ id: 0 })];
    this._borderFills = [new BorderFill({ id: 1, fill: new SolidFill() })];
    this._styles = createDefaultStyles();

    this._charPrCounter = new IdCounter(1);
    this._paraPrCounter = new IdCounter(1);
    this._borderFillCounter = new IdCounter(2);
    this._styleCounter = new IdCounter(13);
  }

  /** 폰트 목록 교체 (한글/영문 폰트 커스텀용). */
  setFontfaces(fontfaces: FontFace[]): void {
    this._fontfaces = fontfaces;
  }

  // -- Section management --

  addSection(init: ConstructorParameters<typeof Section>[0] = {}): Section {
    const sec = new Section(init);
    sec._document = this;
    this._sections.push(sec);
    return sec;
  }

  getSection(index: number): Section {
    return this._sections[index];
  }

  // -- Style registration --

  addCharProperty(charPr: CharProperties): number {
    charPr.id = this._charPrCounter.next();
    this._charProperties.push(charPr);
    return charPr.id;
  }

  addParaProperty(paraPr: ParaProperties): number {
    paraPr.id = this._paraPrCounter.next();
    this._paraProperties.push(paraPr);
    return paraPr.id;
  }

  addBorderFill(bf: BorderFill): number {
    bf.id = this._borderFillCounter.next();
    this._borderFills.push(bf);
    return bf.id;
  }

  addStyle(style: Style): number {
    style.id = this._styleCounter.next();
    this._styles.push(style);
    return style.id;
  }

  // -- Convenience: auto-register charPr --

  _getOrCreateCharPr(opts: {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    textColor?: string;
    underline?: boolean;
    strikeout?: boolean;
    superscript?: boolean;
    subscript?: boolean;
  } = {}): number {
    if (!opts.bold && !opts.italic && !opts.fontSize && !opts.textColor &&
        !opts.underline && !opts.strikeout && !opts.superscript && !opts.subscript) {
      return 0;
    }

    const cp = new CharProperties({
      height: opts.fontSize ?? pt(10),
      bold: opts.bold,
      italic: opts.italic,
      textColor: opts.textColor ?? "#000000",
      underlineType: opts.underline ? "BOTTOM" : "NONE",
      strikeoutShape: opts.strikeout ? "SOLID" : "NONE",
      superscript: opts.superscript,
      subscript: opts.subscript,
    });
    return this.addCharProperty(cp);
  }

  _getOrCreateParaPr(opts: { align?: string } = {}): number {
    if (!opts.align) return 0;
    const pp = new ParaProperties({ alignHorizontal: opts.align });
    return this.addParaProperty(pp);
  }

  private _collectImages(): Image[] {
    const images: Image[] = [];
    for (const sec of this._sections) {
      images.push(...sec.images);
    }
    return images;
  }

  // -- XML generation --

  private _buildHeaderXml(): string {
    const w = new XmlWriter();
    w.decl();

    const secCnt = Math.max(this._sections.length, 1);
    const headerNs: Record<string, string> = {};
    for (const p of ["hh", "hc", "hp", "hp10", "hwpunitchar"]) {
      headerNs[`xmlns:${p}`] = NS[p];
    }
    headerNs["version"] = "1.5";
    headerNs["secCnt"] = String(secCnt);
    w.start("hh:head", headerNs);

    // beginNum
    w.empty("hh:beginNum", {
      page: "1", footnote: "1", endnote: "1",
      pic: "1", tbl: "1", equation: "1",
    });

    // refList
    w.start("hh:refList");

    // fontfaces
    w.start("hh:fontfaces", { itemCnt: String(this._fontfaces.length) });
    for (const ff of this._fontfaces) {
      ff.toXml(w);
    }
    w.end("hh:fontfaces");

    // borderFills
    w.start("hh:borderFills", { itemCnt: String(this._borderFills.length) });
    for (const bf of this._borderFills) {
      bf.toXml(w);
    }
    w.end("hh:borderFills");

    // charProperties
    w.start("hh:charProperties", { itemCnt: String(this._charProperties.length) });
    for (const cp of this._charProperties) {
      cp.toXml(w);
    }
    w.end("hh:charProperties");

    // paraProperties
    w.start("hh:paraProperties", { itemCnt: String(this._paraProperties.length) });
    for (const pp of this._paraProperties) {
      pp.toXml(w);
    }
    w.end("hh:paraProperties");

    // styles
    w.start("hh:styles", { itemCnt: String(this._styles.length) });
    for (const s of this._styles) {
      s.toXml(w);
    }
    w.end("hh:styles");

    // binData (when images exist)
    const images = this._collectImages();
    if (images.length > 0) {
      w.start("hh:binDataStorages");
      for (const img of images) {
        w.empty("hh:binDataStorage", {
          itemId: img.binItemId,
          format: img.ext.toUpperCase(),
          href: img.binDataPath,
        });
      }
      w.end("hh:binDataStorages");
    }

    w.end("hh:refList");

    // compatibleDocument
    w.start("hh:compatibleDocument", { targetProgram: "HWP201X" });
    w.empty("hh:layoutCompatibility");
    w.end("hh:compatibleDocument");

    w.end("hh:head");
    return w.toString();
  }

  private _buildContentHpf(): string {
    const w = new XmlWriter();
    w.decl();
    w.start("opf:package", {
      "xmlns:opf": NS["opf"],
      version: "",
      "unique-identifier": "",
      id: "",
    });

    // metadata
    w.start("opf:metadata");
    w.textElement("opf:title", xmlEscape(this.title));
    w.textElement("opf:language", this.language);
    if (this.creator) {
      w.empty("opf:meta", { name: "creator", content: xmlEscape(this.creator) });
    }
    if (this.subject) {
      w.empty("opf:meta", { name: "subject", content: xmlEscape(this.subject) });
    }
    if (this.description) {
      w.empty("opf:meta", { name: "description", content: xmlEscape(this.description) });
    }
    if (this.keywords) {
      w.empty("opf:meta", { name: "keyword", content: xmlEscape(this.keywords) });
    }
    w.end("opf:metadata");

    // manifest
    w.start("opf:manifest");
    w.empty("opf:item", { id: "header", href: "Contents/header.xml", "media-type": "application/xml" });
    const secCount = Math.max(this._sections.length, 1);
    for (let i = 0; i < secCount; i++) {
      w.empty("opf:item", { id: `section${i}`, href: `Contents/section${i}.xml`, "media-type": "application/xml" });
    }
    w.empty("opf:item", { id: "settings", href: "settings.xml", "media-type": "application/xml" });
    // image items
    for (const img of this._collectImages()) {
      w.empty("opf:item", {
        id: img.binItemId,
        href: img.binDataPath,
        "media-type": img.mediaType,
        isEmbeded: "1",
      });
    }
    w.end("opf:manifest");

    // spine
    w.start("opf:spine");
    w.empty("opf:itemref", { idref: "header", linear: "yes" });
    for (let i = 0; i < secCount; i++) {
      w.empty("opf:itemref", { idref: `section${i}`, linear: "yes" });
    }
    w.end("opf:spine");

    w.end("opf:package");
    return w.toString();
  }

  private _buildContainerXml(): string {
    const w = new XmlWriter();
    w.decl();
    w.start("ocf:container", {
      "xmlns:ocf": NS["ocf"],
      "xmlns:hpf": NS["hpf"],
    });
    w.start("ocf:rootfiles");
    w.empty("ocf:rootfile", { "full-path": "Contents/content.hpf", "media-type": "application/hwpml-package+xml" });
    w.empty("ocf:rootfile", { "full-path": "Preview/PrvText.txt", "media-type": "text/plain" });
    w.empty("ocf:rootfile", { "full-path": "META-INF/container.rdf", "media-type": "application/rdf+xml" });
    w.end("ocf:rootfiles");
    w.end("ocf:container");
    return w.toString();
  }

  private _buildContainerRdf(): string {
    const w = new XmlWriter();
    w.decl();
    w.start("rdf:RDF", {
      "xmlns:rdf": NS["rdf"],
      "xmlns:ns0": "http://www.hancom.co.kr/hwpml/2016/meta/pkg#",
    });

    // Document root
    w.start("rdf:Description", { "rdf:about": "" });
    w.empty("ns0:hasPart", { "rdf:resource": "Contents/header.xml" });
    const secCount = Math.max(this._sections.length, 1);
    for (let i = 0; i < secCount; i++) {
      w.empty("ns0:hasPart", { "rdf:resource": `Contents/section${i}.xml` });
    }
    w.end("rdf:Description");

    // header type
    w.start("rdf:Description", { "rdf:about": "Contents/header.xml" });
    w.empty("rdf:type", { "rdf:resource": "http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile" });
    w.end("rdf:Description");

    // section types
    for (let i = 0; i < secCount; i++) {
      w.start("rdf:Description", { "rdf:about": `Contents/section${i}.xml` });
      w.empty("rdf:type", { "rdf:resource": "http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile" });
      w.end("rdf:Description");
    }

    // document type
    w.start("rdf:Description", { "rdf:about": "" });
    w.empty("rdf:type", { "rdf:resource": "http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document" });
    w.end("rdf:Description");

    w.end("rdf:RDF");
    return w.toString();
  }

  private _buildSettingsXml(): string {
    const w = new XmlWriter();
    w.decl();
    w.start("ha:HWPApplicationSetting", {
      "xmlns:ha": NS["ha"],
      "xmlns:config": NS["config"],
    });
    w.empty("ha:CaretPosition", { listIDRef: "0", paraIDRef: "0", pos: "0" });
    w.start("config:config-item-set", { "config:name": "PrintInfo" });
    const items: [string, string, string][] = [
      ["PrintAutoFootNote", "boolean", "false"],
      ["PrintAutoHeadNote", "boolean", "false"],
      ["PrintCropMark", "short", "0"],
      ["BinderHoleType", "short", "0"],
      ["ZoomX", "short", "100"],
      ["ZoomY", "short", "100"],
    ];
    for (const [name, ctype, val] of items) {
      w.textElement("config:config-item", val, { "config:name": name, "config:type": ctype });
    }
    w.end("config:config-item-set");
    w.end("ha:HWPApplicationSetting");
    return w.toString();
  }

  private _buildManifestXml(): string {
    const w = new XmlWriter();
    w.decl();
    w.start("manifest:manifest", {
      "xmlns:manifest": "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0",
    });
    w.end("manifest:manifest");
    return w.toString();
  }

  // -- Convenience API --

  addParagraphToSection(opts: {
    sectionIndex?: number;
    text?: string;
    align?: string;
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    textColor?: string;
    underline?: boolean;
    strikeout?: boolean;
    superscript?: boolean;
    subscript?: boolean;
    styleId?: number;
  } = {}): Paragraph {
    if (this._sections.length === 0) {
      this.addSection();
    }

    const charPrId = this._getOrCreateCharPr({
      bold: opts.bold, italic: opts.italic,
      fontSize: opts.fontSize, textColor: opts.textColor,
      underline: opts.underline, strikeout: opts.strikeout,
      superscript: opts.superscript, subscript: opts.subscript,
    });
    const paraPrId = this._getOrCreateParaPr({ align: opts.align });

    const sec = this._sections[opts.sectionIndex ?? 0];
    return sec.addParagraph(opts.text, {
      paraPrId, styleId: opts.styleId ?? 0, charPrId,
    });
  }

  // -- Save --

  async toBytes(): Promise<Uint8Array> {
    if (this._sections.length === 0) {
      this.addSection();
    }

    const packager = new HwpxZipPackager();

    // 1. mimetype (first, STORED)
    packager.addMimetype();

    // 2. version.xml (STORED)
    packager.addVersionXml();

    // 3. META-INF/
    packager.addXml("META-INF/container.xml", this._buildContainerXml());
    packager.addXml("META-INF/manifest.xml", this._buildManifestXml());
    packager.addXml("META-INF/container.rdf", this._buildContainerRdf());

    // 4. Contents/
    packager.addXml("Contents/content.hpf", this._buildContentHpf());
    packager.addXml("Contents/header.xml", this._buildHeaderXml());

    for (let i = 0; i < this._sections.length; i++) {
      packager.addXml(`Contents/section${i}.xml`, this._sections[i].toXml());
    }

    // 5. settings.xml
    packager.addXml("settings.xml", this._buildSettingsXml());

    // 6. BinData (images, STORED)
    for (const img of this._collectImages()) {
      packager.addBinary(img.binDataPath, img.imageData);
    }

    return packager.toBytes();
  }

  async save(filepath: string): Promise<void> {
    const data = await this.toBytes();
    const fs = await import("fs");
    fs.writeFileSync(filepath, data);
  }
}
