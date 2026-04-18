/**
 * 템플릿 HWPX 파서 — ZIP 열어 `Contents/header.xml` 로부터 필요한 메타데이터 추출.
 *
 * Phase 3 MVP 범위:
 *   - 언어별 FontFace에서 첫 폰트 이름 추출 (한글/영문)
 *   - 전체 폰트 풀 이름 목록 (디버그·UI 표시용)
 *   - 스타일 이름 목록 (한컴: "바탕글", "본문", "개요 1"…)
 *   - 원본 header.xml 보존 (향후 확장용)
 *
 * 파싱 방식: 간이 정규식.
 *   - 한컴 출력물의 XML 스키마가 고정적이고 이스케이프가 예측 가능.
 *   - DOMParser 는 Node 테스트 환경에 없어서 이식성 문제.
 *   - 구조가 복잡해지면 `@xmldom/xmldom` 도입 고려.
 */

import JSZip from "jszip";
import { log } from "../logger";
import * as fs from "fs";

/** 문단 placeholder 의 스타일 참조. */
export interface ParaStyleRef {
  paraPrId: number;    // paraPrIDRef
  charPrId: number;    // 해당 placeholder run 의 charPrIDRef
  styleId: number;     // 문단 styleIDRef (0 이면 기본)
}

/** 표 셀 placeholder 의 스타일 참조 + 테두리 + 여백. */
export interface CellStyleRef extends ParaStyleRef {
  borderFillId: number;
  marginLeft: number;    // HWPUNIT
  marginRight: number;
  marginTop: number;
  marginBottom: number;
}

/** 리스트 placeholder 의 스타일 참조. */
export interface ListStyleRef extends ParaStyleRef {
  /** prefix 문자(글머리표 등). 있으면 markdown 렌더 시 앞에 붙임. */
  prefix: string | null;
}

export interface PlaceholderStyles {
  /** 문단: "H1".."H9", "BODY", "CODE", "LINK" 등 */
  paragraphs: Map<string, ParaStyleRef>;
  /** 셀: "HEADER_LEFT", "TOP_CENTER", "MIDDLE_RIGHT", "BOTTOM_LEFT" 등 */
  cells: Map<string, CellStyleRef>;
  /** 리스트: "BULLET_1".."BULLET_7", "ORDERED_1".."ORDERED_7" */
  lists: Map<string, ListStyleRef>;
}

export interface TemplateMetadata {
  /** HANGUL lang의 첫 폰트 (보통 본문 폰트). null이면 파싱 실패. */
  bodyFontHangul: string | null;
  /** LATIN lang의 첫 폰트. */
  bodyFontLatin: string | null;
  /** HANGUL lang의 모든 폰트 이름 (UI 표시용). */
  hangulFonts: string[];
  /** LATIN lang의 모든 폰트 이름. */
  latinFonts: string[];
  /** 모든 문단/문자 스타일 이름 (향후 name-match 병합용). */
  styleNames: string[];
  /** 원본 header.xml 내용. */
  rawHeaderXml: string;
  /** 원본 section0.xml 내용 (template-aware 변환에서 사용). */
  rawSectionXml: string;
  /** 추출된 placeholder → 스타일 ID 매핑. */
  placeholderStyles: PlaceholderStyles;
}

function emptyMetadata(): TemplateMetadata {
  return {
    bodyFontHangul: null,
    bodyFontLatin: null,
    hangulFonts: [],
    latinFonts: [],
    styleNames: [],
    rawHeaderXml: "",
    rawSectionXml: "",
    placeholderStyles: {
      paragraphs: new Map(),
      cells: new Map(),
      lists: new Map(),
    },
  };
}

/**
 * 템플릿 파일의 OS 절대 경로를 받아 메타데이터를 반환.
 *
 * 에러 시 빈 TemplateMetadata 를 돌려주어 (null 아님) 호출 측이 분기 없이 안전하게 사용 가능.
 * 구체 에러는 console 에만 기록한다.
 */
export async function readTemplate(absPath: string): Promise<TemplateMetadata> {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(absPath);
  } catch (e) {
    log.warn("[TemplateReader] read failed:", absPath, e);
    return emptyMetadata();
  }
  return readTemplateFromBytes(new Uint8Array(bytes));
}

/**
 * 바이트 배열로 템플릿 파싱 — 번들된 샘플, 테스트 등에서 사용.
 */
export async function readTemplateFromBytes(bytes: Uint8Array): Promise<TemplateMetadata> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (e) {
    log.warn("[TemplateReader] not a valid ZIP:", e);
    return emptyMetadata();
  }

  const headerEntry = zip.file("Contents/header.xml");
  if (!headerEntry) {
    log.warn("[TemplateReader] Contents/header.xml not found");
    return emptyMetadata();
  }
  const headerXml = await headerEntry.async("string");

  // section0.xml 도 선택적으로 — 없으면 placeholder 추출 스킵
  const sectionEntry = zip.file("Contents/section0.xml");
  const sectionXml = sectionEntry ? await sectionEntry.async("string") : "";

  const meta = parseHeaderXml(headerXml);
  meta.rawSectionXml = sectionXml;
  if (sectionXml) {
    meta.placeholderStyles = parsePlaceholderStyles(sectionXml);
  }
  return meta;
}

/**
 * header.xml 문자열을 파싱해 메타데이터를 추출.
 *
 * 순수 함수로 분리 — 테스트에서 ZIP 생성 없이 문자열만으로 검증 가능.
 */
export function parseHeaderXml(xml: string): TemplateMetadata {
  const result = emptyMetadata();
  result.rawHeaderXml = xml;

  // 각 lang 블록(<hh:fontface lang="HANGUL" ...> ... </hh:fontface>)에서 폰트 face 추출.
  // 주의: 중첩된 <hh:substFont face="..."> 가 있으므로 최상위 hh:font 만 집는다 —
  // 자식 hh:substFont 의 face 와 섞이지 않도록 "id=" 가 있는 엔트리만 매칭.
  const extractFontsForLang = (lang: string): string[] => {
    const blockRe = new RegExp(
      `<hh:fontface\\s+lang="${lang}"[^>]*>([\\s\\S]*?)</hh:fontface>`,
    );
    const m = blockRe.exec(xml);
    if (!m) return [];
    const block = m[1];
    // 최상위 hh:font — id 속성이 있고 face 도 있는 것. 자식 hh:substFont 에는 id 가 없다.
    const fontRe = /<hh:font\s+id="\d+"\s+face="([^"]+)"/g;
    const names: string[] = [];
    let fm;
    while ((fm = fontRe.exec(block)) !== null) {
      names.push(fm[1]);
    }
    return names;
  };

  result.hangulFonts = extractFontsForLang("HANGUL");
  result.latinFonts = extractFontsForLang("LATIN");
  result.bodyFontHangul = result.hangulFonts[0] ?? null;
  result.bodyFontLatin = result.latinFonts[0] ?? null;

  // 스타일 이름 — <hh:style ... name="..." ...>
  const styleRe = /<hh:style\s+[^>]*\bname="([^"]+)"/g;
  const names: string[] = [];
  let sm;
  while ((sm = styleRe.exec(xml)) !== null) {
    names.push(sm[1]);
  }
  result.styleNames = names;

  return result;
}

// ══ Placeholder 추출 ═════════════════════════════════════════════════════

/**
 * section0.xml 에서 `{{NAME}}` 플레이스홀더가 있는 문단·셀을 스캔해 스타일 ID 를 추출.
 *
 * md2hwpx 컨벤션을 따른다:
 *   - `{{H1}}` ~ `{{H9}}`, `{{BODY}}`, `{{CODE}}`, `{{LINK}}` → paragraphs map
 *   - `{{CELL_HEADER_LEFT}}`, `{{CELL_TOP_CENTER}}`, `{{CELL_MIDDLE_RIGHT}}`,
 *     `{{CELL_BOTTOM_*}}` → cells map (셀 이름에서 `CELL_` 접두어 제거)
 *   - `{{LIST_BULLET_1}}` ~ `{{LIST_BULLET_7}}`, `{{LIST_ORDERED_1}}` ~ → lists map
 *     (리스트 이름에서 `LIST_` 접두어 제거)
 *
 * 각 placeholder 는 자신을 포함한 문단/셀의 IDRef 들(paraPrIDRef/charPrIDRef/styleIDRef +
 * 셀의 경우 borderFillIDRef, cellMargin) 을 갖는다. 변환기는 이 ID 들을 사용해
 * 해당 유형의 마크다운 요소를 렌더할 때 템플릿과 같은 스타일을 얻는다.
 */
export function parsePlaceholderStyles(sectionXml: string): PlaceholderStyles {
  const result: PlaceholderStyles = {
    paragraphs: new Map(),
    cells: new Map(),
    lists: new Map(),
  };

  // 1) 표 안의 셀 placeholder
  extractCellPlaceholders(sectionXml, result);

  // 2) 일반 문단 placeholder (표 밖)
  extractParagraphPlaceholders(sectionXml, result);

  return result;
}

/** `<hp:tc>...</hp:tc>` 블록 안에서 CELL_* placeholder 를 찾는다. */
function extractCellPlaceholders(sectionXml: string, out: PlaceholderStyles): void {
  // 각 <hp:tc> 블록과 그 속성 추출
  const tcRe = /<hp:tc\s+([^>]*?)>([\s\S]*?)<\/hp:tc>/g;
  let m;
  while ((m = tcRe.exec(sectionXml)) !== null) {
    const tcAttrs = m[1];
    const tcBody = m[2];

    // 셀의 borderFillIDRef 추출
    const bfMatch = /borderFillIDRef="(\d+)"/.exec(tcAttrs);
    const borderFillId = bfMatch ? parseInt(bfMatch[1], 10) : 1;

    // 셀 여백
    const cmMatch = /<hp:cellMargin\s+([^/]*)\/>/.exec(tcBody);
    let marginLeft = 0, marginRight = 0, marginTop = 0, marginBottom = 0;
    if (cmMatch) {
      marginLeft = +(/left="(\d+)"/.exec(cmMatch[1])?.[1] ?? "0");
      marginRight = +(/right="(\d+)"/.exec(cmMatch[1])?.[1] ?? "0");
      marginTop = +(/top="(\d+)"/.exec(cmMatch[1])?.[1] ?? "0");
      marginBottom = +(/bottom="(\d+)"/.exec(cmMatch[1])?.[1] ?? "0");
    }

    // 셀 내부의 placeholder 텍스트 + 포함 run/para
    forEachPlaceholderInContext(tcBody, (name, ctx) => {
      // CELL_* 이름만 이 경로에서 처리
      if (!name.startsWith("CELL_")) {
        // H1/BODY 등이 셀 안에 있을 수도 있음 → paragraphs 에 등록
        // 단 일반 문단 추출기도 같은 걸 잡으므로 중복 방지 위해 여기선 스킵
        return;
      }
      const cellKey = name.slice("CELL_".length);
      out.cells.set(cellKey, {
        paraPrId: ctx.paraPrId,
        charPrId: ctx.charPrId,
        styleId: ctx.styleId,
        borderFillId,
        marginLeft, marginRight, marginTop, marginBottom,
      });
    });
  }
}

/** 섹션 전체에서 문단용 placeholder(H1~9 / BODY / CODE / LINK / LIST_*) 를 찾는다. */
function extractParagraphPlaceholders(sectionXml: string, out: PlaceholderStyles): void {
  forEachPlaceholderInContext(sectionXml, (name, ctx) => {
    if (name.startsWith("CELL_")) return;  // 셀 파서가 담당

    if (name.startsWith("LIST_")) {
      const key = name.slice("LIST_".length);  // "BULLET_1" 등
      out.lists.set(key, {
        paraPrId: ctx.paraPrId,
        charPrId: ctx.charPrId,
        styleId: ctx.styleId,
        prefix: ctx.prefix,
      });
      return;
    }

    // 일반 문단용 (H1~H9, BODY, CODE, LINK, TITLE 등)
    out.paragraphs.set(name, {
      paraPrId: ctx.paraPrId,
      charPrId: ctx.charPrId,
      styleId: ctx.styleId,
    });
  });
}

interface PlaceholderContext {
  paraPrId: number;
  charPrId: number;
  styleId: number;
  prefix: string | null;   // 같은 run 또는 앞선 run 의 텍스트(글머리표 등)
}

/**
 * XML 문자열에서 `{{NAME}}` placeholder 를 순회하며 그 위치의 컨텍스트를 콜백에 넘긴다.
 *
 * 각 placeholder 는 `<hp:p paraPrIDRef="P" styleIDRef="S" ...>
 *   <hp:run charPrIDRef="C">...<hp:t>...{{NAME}}...</hp:t></hp:run>
 * </hp:p>` 형태. prefix 는 같은 run 의 `<hp:t>` 에서 placeholder 앞 텍스트 또는
 * 같은 문단의 이전 run 의 텍스트.
 */
function forEachPlaceholderInContext(
  xml: string,
  cb: (name: string, ctx: PlaceholderContext) => void,
): void {
  // 각 <hp:p ...>...</hp:p> 블록 순회
  const pRe = /<hp:p\s+([^>]*?)>([\s\S]*?)<\/hp:p>/g;
  let pm;
  while ((pm = pRe.exec(xml)) !== null) {
    const pAttrs = pm[1];
    const pBody = pm[2];

    const paraPrId = +(/paraPrIDRef="(\d+)"/.exec(pAttrs)?.[1] ?? "0");
    const styleId = +(/styleIDRef="(\d+)"/.exec(pAttrs)?.[1] ?? "0");

    // 문단 내의 run 들을 순서대로 추출 — 앞선 run 의 텍스트를 누적해 prefix 로 사용
    const runRe = /<hp:run\s+([^>]*?)>([\s\S]*?)<\/hp:run>/g;
    let accumulatedPrefix = "";
    let rm;
    while ((rm = runRe.exec(pBody)) !== null) {
      const rAttrs = rm[1];
      const rBody = rm[2];
      const charPrId = +(/charPrIDRef="(\d+)"/.exec(rAttrs)?.[1] ?? "0");

      // run 안의 <hp:t>...</hp:t> 텍스트
      const tRe = /<hp:t>([^<]*)<\/hp:t>/g;
      let tm;
      while ((tm = tRe.exec(rBody)) !== null) {
        const text = tm[1];
        if (!text) continue;
        const phMatch = /\{\{([A-Z0-9_]+)\}\}/.exec(text);
        if (phMatch) {
          const name = phMatch[1];
          // placeholder 앞의 같은-run 텍스트 또는 이전 run 들의 텍스트
          const sameRunPrefix = text.slice(0, phMatch.index);
          const fullPrefix = accumulatedPrefix + sameRunPrefix;
          cb(name, {
            paraPrId,
            charPrId,
            styleId,
            prefix: fullPrefix || null,
          });
        } else {
          accumulatedPrefix += text;
        }
      }
    }
  }
}
