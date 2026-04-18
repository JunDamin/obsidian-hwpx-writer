/**
 * Style — 이름이 있는 스타일 정의 ("바탕글", "제목 1" 등).
 *
 * paraPrId + charPrId 조합을 사용자가 참조할 수 있게 이름을 부여한 것.
 * 한컴오피스 UI의 "스타일 목록"에 노출된다.
 *
 * 기본 13개 스타일 팩토리(`createDefaultStyles`)와 기본 FontFace 팩토리
 * (`createDefaultFontfaces`)가 함께 제공된다.
 */

import { XmlWriter } from "./XmlBuilder";
import { boolToStr } from "./utils";
import { LANG_GROUPS } from "./constants";
import { Font, FontFace } from "./Font";

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
