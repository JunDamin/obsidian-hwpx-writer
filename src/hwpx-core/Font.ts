/**
 * Font / FontFace — header.xml의 `<hh:fontfaces>` 하위 요소.
 *
 * LANG_GROUPS(HANGUL/LATIN/HANJA/JAPANESE/OTHER/SYMBOL/USER) 별로 FontFace 하나씩
 * 존재해야 한다. CharProperties의 fontRef는 해당 FontFace 내의 Font.id를 참조.
 */

import { XmlWriter } from "./XmlBuilder";
import { boolToStr } from "./utils";

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
