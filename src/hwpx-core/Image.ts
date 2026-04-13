/** 이미지(Image) -- BinData 패키징, 위치 설정. */

import * as path from "path";
import * as fs from "fs";
import { boolToStr, generateBinId } from "./utils";
import { XmlWriter } from "./XmlBuilder";
import { mm } from "./units";

export interface CaptionInit {
  text?: string;
  side?: string;
  fullSize?: boolean;
  width?: number;
  gap?: number;
}

export class Caption {
  text: string;
  side: string;
  fullSize: boolean;
  width: number | undefined;
  gap: number;

  constructor(init: CaptionInit = {}) {
    this.text = init.text ?? "";
    this.side = init.side ?? "BOTTOM";
    this.fullSize = init.fullSize ?? false;
    this.width = init.width;
    this.gap = init.gap ?? 850;
  }
}

export interface ImageInit {
  filePath?: string;
  data?: Uint8Array;
  filename?: string;
  width?: number;
  height?: number;
  keepRatio?: boolean;
  treatAsChar?: boolean;
  textWrap?: string;
  textFlow?: string;
  vertRelTo?: string;
  horzRelTo?: string;
  vertAlign?: string;
  horzAlign?: string;
  vertOffset?: number;
  horzOffset?: number;
  bright?: number;
  contrast?: number;
  effect?: string;
  alpha?: number;
  caption?: Caption;
}

export class Image {
  width: number;
  height: number;
  keepRatio: boolean;
  treatAsChar: boolean;
  textWrap: string;
  textFlow: string;
  vertRelTo: string;
  horzRelTo: string;
  vertAlign: string;
  horzAlign: string;
  vertOffset: number;
  horzOffset: number;
  bright: number;
  contrast: number;
  effect: string;
  alpha: number;
  caption: Caption | undefined;

  private _binId: string;
  private _instId: string;
  private _filename: string;
  private _data: Uint8Array;
  private _ext: string;
  private _mediaType: string;

  constructor(init: ImageInit = {}) {
    this.width = init.width ?? mm(50);
    this.height = init.height ?? mm(30);
    this.keepRatio = init.keepRatio ?? true;
    this.treatAsChar = init.treatAsChar ?? true;
    this.textWrap = init.textWrap ?? "TOP_AND_BOTTOM";
    this.textFlow = init.textFlow ?? "BOTH_SIDES";
    this.vertRelTo = init.vertRelTo ?? "PARA";
    this.horzRelTo = init.horzRelTo ?? "PARA";
    this.vertAlign = init.vertAlign ?? "TOP";
    this.horzAlign = init.horzAlign ?? "LEFT";
    this.vertOffset = init.vertOffset ?? 0;
    this.horzOffset = init.horzOffset ?? 0;
    this.bright = init.bright ?? 0;
    this.contrast = init.contrast ?? 0;
    this.effect = init.effect ?? "REAL_PIC";
    this.alpha = init.alpha ?? 0;
    this.caption = init.caption;

    this._binId = generateBinId();
    this._instId = String(Math.floor(Math.random() * (2147483647 - 100000000)) + 100000000);

    if (init.filePath) {
      this._filename = path.basename(init.filePath);
      this._data = new Uint8Array(fs.readFileSync(init.filePath));
    } else if (init.data) {
      this._filename = init.filename ?? `${this._binId}.png`;
      this._data = init.data;
    } else {
      throw new Error("filePath or data must be provided");
    }

    const dotIdx = this._filename.lastIndexOf(".");
    this._ext = dotIdx >= 0 ? this._filename.slice(dotIdx + 1).toLowerCase() : "png";

    const mediaMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", bmp: "image/bmp", tiff: "image/tiff",
      wmf: "image/x-wmf", emf: "image/x-emf",
    };
    this._mediaType = mediaMap[this._ext] ?? "image/png";
  }

  get binDataPath(): string {
    return `BinData/${this._binId}.${this._ext}`;
  }

  get binItemId(): string {
    return this._binId;
  }

  get imageData(): Uint8Array {
    return this._data;
  }

  get mediaType(): string {
    return this._mediaType;
  }

  get ext(): string {
    return this._ext;
  }

  toXml(w: XmlWriter, binItemIdRef = ""): void {
    const ref = binItemIdRef || this._binId;
    const W = String(this.width);
    const H = String(this.height);
    const cx = String(Math.floor(this.width / 2));
    const cy = String(Math.floor(this.height / 2));

    w.start("hp:pic", {
      id: this._instId,
      zOrder: "0",
      numberingType: "PICTURE",
      textWrap: this.textWrap,
      textFlow: this.textFlow,
      lock: "0",
      dropcapstyle: "None",
      href: "",
      groupLevel: "0",
      instid: this._instId,
      reverse: "0",
    });

    // 위치/크기 메타
    w.empty("hp:offset", { x: "0", y: "0" });
    w.empty("hp:orgSz", { width: W, height: H });
    w.empty("hp:curSz", { width: "0", height: "0" });
    w.empty("hp:flip", { horizontal: "0", vertical: "0" });
    w.empty("hp:rotationInfo", { angle: "0", centerX: cx, centerY: cy, rotateimage: "1" });

    // renderingInfo
    w.start("hp:renderingInfo");
    w.empty("hc:transMatrix", { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
    w.empty("hc:scaMatrix", { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
    w.empty("hc:rotMatrix", { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" });
    w.end("hp:renderingInfo");

    // img (hc: namespace)
    w.empty("hc:img", {
      binaryItemIDRef: ref,
      bright: String(this.bright),
      contrast: String(this.contrast),
      effect: this.effect,
      alpha: String(this.alpha),
    });

    // imgRect (hc:pt0~pt3)
    w.start("hp:imgRect");
    w.empty("hc:pt0", { x: "0", y: "0" });
    w.empty("hc:pt1", { x: W, y: "0" });
    w.empty("hc:pt2", { x: W, y: H });
    w.empty("hc:pt3", { x: "0", y: H });
    w.end("hp:imgRect");

    // imgClip, inMargin, imgDim
    w.empty("hp:imgClip", { left: "0", right: "0", top: "0", bottom: "0" });
    w.empty("hp:inMargin", { left: "0", right: "0", top: "0", bottom: "0" });
    w.empty("hp:imgDim", { dimwidth: W, dimheight: H });

    // effects (empty element)
    w.empty("hp:effects");

    // sz
    w.empty("hp:sz", {
      width: W, widthRelTo: "ABSOLUTE",
      height: H, heightRelTo: "ABSOLUTE",
      protect: "0",
    });

    // pos
    w.empty("hp:pos", {
      treatAsChar: boolToStr(this.treatAsChar),
      affectLSpacing: "0",
      flowWithText: "1",
      allowOverlap: "0",
      holdAnchorAndSO: "0",
      vertRelTo: this.vertRelTo,
      horzRelTo: this.horzRelTo,
      vertAlign: this.vertAlign,
      horzAlign: this.horzAlign,
      vertOffset: String(this.vertOffset),
      horzOffset: String(this.horzOffset),
    });

    // outMargin
    w.empty("hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });

    w.end("hp:pic");
  }
}
