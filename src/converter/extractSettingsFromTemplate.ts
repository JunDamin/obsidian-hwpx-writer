/**
 * 템플릿 HWPX → 사용자 settings 객체 매핑.
 *
 * 목표: 사용자가 템플릿을 선택하면 settings(사이드바 UI가 보여주는 값) 가 실제로
 * 템플릿의 값으로 바뀐다. 변환기는 그냥 settings 를 쓰는 일반 경로를 타므로
 * "사이드바에 표시된 값 = 실제 적용되는 값" 이 항상 일치.
 *
 * 추출 대상(우선순위):
 *   - 폰트: fontHangul, fontLatin
 *   - 본문 크기: bodyFontSize (BODY placeholder 의 charPr.height)
 *   - 줄간격: lineSpacing (BODY placeholder 의 paraPr.lineSpacing)
 *   - 헤딩 H1~H6: fontSize, bold, italic, textColor, pageBreakBefore, spaceBefore/After
 *   - 표 머리행 배경색: tableHeaderBgColor (HEADER_CENTER borderFill 의 fill.faceColor)
 *   - 표 셀 패딩: tableCellPaddingH/V (HEADER_CENTER cellMargin)
 *
 * 7-세그먼트 tableBorderDesign 은 12개 CELL_* 로부터 복원 가능하지만 복잡하므로
 * Phase 1 에서는 "단일 외곽선" 만 추출(HEADER_LEFT.topBorder 등). 추가 정밀화는 후속.
 */

import type { HwpxWriterSettings, HeadingStyle, BorderLineType, BorderLineSpec, TableBorderDesign } from "../settings";
import type { TemplateMetadata } from "./TemplateReader";

export interface ExtractedSettings {
  /** 템플릿에서 추출한 값들. 존재하는 필드만 채워진다 (undefined 는 변경 안 함). */
  patch: Partial<HwpxWriterSettings>;
  /** 디버그/사용자 표시용 요약 라인. */
  summary: string[];
}

/**
 * 템플릿 메타 + header.xml 원문으로부터 settings 패치를 생성.
 * `settings = { ...settings, ...patch }` 형태로 합치는 걸 권장.
 */
export function extractSettingsFromTemplate(
  meta: TemplateMetadata,
  headerXml: string,
): ExtractedSettings {
  const patch: Partial<HwpxWriterSettings> = {};
  const summary: string[] = [];

  // 1) BODY placeholder 의 charPr 로부터 실제 본문 폰트 · 크기 · 색
  //    — 첫번째 HANGUL 폰트 face 는 BODY 본문이 아닐 수 있음 (표지/제목용 폰트일 수도).
  //    — 반드시 BODY 의 fontRef 를 따라가 실제 body 폰트를 얻어야 정확.
  const bodyRef = meta.placeholderStyles.paragraphs.get("BODY");
  if (bodyRef) {
    const bodyChar = parseCharProperty(headerXml, bodyRef.charPrId);
    if (bodyChar) {
      // 폰트: fontHangul 인덱스 → HANGUL fontface 의 해당 id 의 face 이름
      const hangulFont = resolveFontName(headerXml, "HANGUL", bodyChar.fontHangulId ?? 0);
      const latinFont = resolveFontName(headerXml, "LATIN", bodyChar.fontLatinId ?? 0);
      if (hangulFont) {
        patch.fontHangul = hangulFont;
        summary.push(`fontHangul=${hangulFont}`);
      }
      if (latinFont && latinFont !== hangulFont) {
        patch.fontLatin = latinFont;
        summary.push(`fontLatin=${latinFont}`);
      }
      if (bodyChar.fontSize) {
        patch.bodyFontSize = bodyChar.fontSize;
        summary.push(`bodyFontSize=${bodyChar.fontSize}pt`);
      }
    }
    const bodyPara = parseParaProperty(headerXml, bodyRef.paraPrId);
    if (bodyPara?.lineSpacingPercent) {
      patch.lineSpacing = bodyPara.lineSpacingPercent;
      summary.push(`lineSpacing=${bodyPara.lineSpacingPercent}%`);
    }
  } else {
    // BODY placeholder 가 없으면 첫번째 HANGUL 폰트로 폴백 (차선책)
    if (meta.bodyFontHangul) {
      patch.fontHangul = meta.bodyFontHangul;
      summary.push(`fontHangul=${meta.bodyFontHangul} (fallback)`);
    }
    if (meta.bodyFontLatin && meta.bodyFontLatin !== meta.bodyFontHangul) {
      patch.fontLatin = meta.bodyFontLatin;
      summary.push(`fontLatin=${meta.bodyFontLatin} (fallback)`);
    }
  }

  // 3) 헤딩 H1~H6
  const headingPatch: HeadingStyle[] = [];
  for (let i = 1; i <= 6; i++) {
    const hRef = meta.placeholderStyles.paragraphs.get(`H${i}`);
    if (!hRef) continue;
    const hChar = parseCharProperty(headerXml, hRef.charPrId);
    const hPara = parseParaProperty(headerXml, hRef.paraPrId);
    if (!hChar && !hPara) continue;
    headingPatch[i - 1] = {
      fontSize: hChar?.fontSize ?? 12,
      bold: hChar?.bold ?? false,
      italic: hChar?.italic ?? false,
      color: hChar?.textColor ?? "#000000",
      pageBreakBefore: hPara?.pageBreakBefore ?? false,
      spaceBefore: hPara?.spaceBeforeMm ?? 0,
      spaceAfter: hPara?.spaceAfterMm ?? 0,
      blankLinesBefore: 0,
      blankLinesAfter: 0,
      blankLineHeight: 0,
      fontName: "",
    };
  }
  if (headingPatch.filter(Boolean).length > 0) {
    // 기존 headingStyles 와 병합 — 없는 레벨은 기존값 유지
    patch.headingStyles = headingPatch;
    summary.push(`headingStyles=${headingPatch.filter(Boolean).length}개`);
  }

  // 4) 표 — HEADER_CENTER 셀의 fill 색과 margin
  const headerCenterCell = meta.placeholderStyles.cells.get("HEADER_CENTER")
    ?? meta.placeholderStyles.cells.get("HEADER_LEFT");
  if (headerCenterCell) {
    const bfXml = findBorderFillXml(headerXml, headerCenterCell.borderFillId);
    if (bfXml) {
      const faceColor = /faceColor="([^"]+)"/.exec(bfXml)?.[1];
      if (faceColor && faceColor !== "none" && !/^#FFF+FF$/i.test(faceColor)) {
        patch.tableHeaderBgColor = faceColor;
        summary.push(`tableHeaderBgColor=${faceColor}`);
      }
    }
    // cellMargin 은 HWPUNIT → mm
    if (headerCenterCell.marginLeft > 0) {
      patch.tableCellPaddingH = Math.round((headerCenterCell.marginLeft / 283.465) * 10) / 10;
      summary.push(`tableCellPaddingH=${patch.tableCellPaddingH}mm`);
    }
    if (headerCenterCell.marginTop > 0) {
      patch.tableCellPaddingV = Math.round((headerCenterCell.marginTop / 283.465) * 10) / 10;
      summary.push(`tableCellPaddingV=${patch.tableCellPaddingV}mm`);
    }
  }

  // 5) 표 테두리 디자인 — 7 segments
  const borderDesign = extractTableBorderDesign(meta, headerXml);
  if (borderDesign) {
    patch.tableBorderDesign = borderDesign;
    summary.push(`tableBorderDesign=7구간`);
  }

  return { patch, summary };
}

// ══ header.xml 헬퍼 ═════════════════════════════════════════════════════

interface CharProperty {
  fontSize?: number;       // pt (template 의 HWPUNIT/100)
  bold?: boolean;
  italic?: boolean;
  textColor?: string;      // "#RRGGBB"
  fontHangulId?: number;   // hh:fontRef hangul="N"
  fontLatinId?: number;    // hh:fontRef latin="N"
}

function parseCharProperty(headerXml: string, id: number): CharProperty | null {
  // <hh:charPr id="N" ... height="H" textColor="#..." ...> ... <hh:bold/>? <hh:italic/>? ...
  const blockRe = new RegExp(
    `<hh:charPr\\s+[^>]*\\bid="${id}"[\\s\\S]*?</hh:charPr>`,
  );
  const m = blockRe.exec(headerXml);
  if (!m) return null;
  const block = m[0];

  const heightAttr = /height="(\d+)"/.exec(block)?.[1];
  const height = heightAttr ? parseInt(heightAttr, 10) : undefined;  // HWPUNIT

  const textColor = /textColor="([^"]+)"/.exec(block)?.[1];

  // hh:fontRef 에서 hangul / latin 인덱스 추출
  const fontRefMatch = /<hh:fontRef\s+([^/]*)\/>/.exec(block);
  let fontHangulId: number | undefined;
  let fontLatinId: number | undefined;
  if (fontRefMatch) {
    const attrs = fontRefMatch[1];
    const h = /hangul="(\d+)"/.exec(attrs)?.[1];
    const l = /latin="(\d+)"/.exec(attrs)?.[1];
    fontHangulId = h !== undefined ? parseInt(h, 10) : undefined;
    fontLatinId = l !== undefined ? parseInt(l, 10) : undefined;
  }

  return {
    fontSize: height ? height / 100 : undefined,
    bold: /<hh:bold\s*\/>/.test(block),
    italic: /<hh:italic\s*\/>/.test(block),
    textColor: textColor && textColor !== "none" ? textColor : undefined,
    fontHangulId,
    fontLatinId,
  };
}

/**
 * `<hh:fontface lang="HANGUL" ...>` 블록에서 `id="N"` 인 폰트의 face 이름을 반환.
 * 자식 <hh:substFont> 의 face 와 혼동하지 않도록 최상위 hh:font 만 탐색.
 */
function resolveFontName(headerXml: string, lang: string, id: number): string | null {
  const blockRe = new RegExp(
    `<hh:fontface\\s+lang="${lang}"[^>]*>([\\s\\S]*?)</hh:fontface>`,
  );
  const block = blockRe.exec(headerXml)?.[1];
  if (!block) return null;
  const fontRe = new RegExp(`<hh:font\\s+id="${id}"\\s+face="([^"]+)"`);
  return fontRe.exec(block)?.[1] ?? null;
}

interface ParaProperty {
  lineSpacingPercent?: number;
  pageBreakBefore?: boolean;
  spaceBeforeMm?: number;
  spaceAfterMm?: number;
}

function parseParaProperty(headerXml: string, id: number): ParaProperty | null {
  const blockRe = new RegExp(
    `<hh:paraPr\\s+[^>]*\\bid="${id}"[\\s\\S]*?</hh:paraPr>`,
  );
  const m = blockRe.exec(headerXml);
  if (!m) return null;
  const block = m[0];

  const lsType = /type="PERCENT"\s+value="(\d+)"/.exec(block)?.[1];
  const pageBreak = /pageBreakBefore="1"/.test(block);

  // margin: <hc:prev value="N" unit="HWPUNIT"/> (spacingBefore), <hc:next .../> (After)
  const prev = /<hc:prev\s+value="(\d+)"/.exec(block)?.[1];
  const next = /<hc:next\s+value="(\d+)"/.exec(block)?.[1];
  const hwpunitToMm = (n: number) => Math.round((n / 283.465) * 10) / 10;

  return {
    lineSpacingPercent: lsType ? parseInt(lsType, 10) : undefined,
    pageBreakBefore: pageBreak,
    spaceBeforeMm: prev ? hwpunitToMm(parseInt(prev, 10)) : undefined,
    spaceAfterMm: next ? hwpunitToMm(parseInt(next, 10)) : undefined,
  };
}

/** borderFill id 에 해당하는 `<hh:borderFill>...</hh:borderFill>` 블록 XML 반환. */
function findBorderFillXml(headerXml: string, id: number): string | null {
  const re = new RegExp(
    `<hh:borderFill\\s+[^>]*\\bid="${id}"[\\s\\S]*?</hh:borderFill>`,
  );
  return re.exec(headerXml)?.[0] ?? null;
}

/** borderFill 의 특정 변(top/bottom/left/right) 스펙 읽기. */
function parseBorderSide(bfXml: string, side: "top" | "bottom" | "left" | "right"): BorderLineSpec | null {
  const tag = `hh:${side}Border`;
  const m = new RegExp(`<${tag}\\s+([^/]*)/>`).exec(bfXml);
  if (!m) return null;
  const attrs = m[1];
  const type = (/type="([^"]+)"/.exec(attrs)?.[1] ?? "SOLID") as BorderLineType;
  const color = /color="([^"]+)"/.exec(attrs)?.[1] ?? "#000000";
  const width = /width="([^"]+)"/.exec(attrs)?.[1] ?? "0.12 mm";
  return { type, color, width };
}

/**
 * 12개 CELL_* placeholder 로부터 7-세그먼트 tableBorderDesign 을 복원.
 * 각 세그먼트는 대표 셀의 대응 변에서 읽는다:
 *   - outerTop   ← HEADER_CENTER.top
 *   - outerLeft  ← HEADER_LEFT.left
 *   - outerRight ← HEADER_RIGHT.right
 *   - outerBottom ← BOTTOM_CENTER.bottom
 *   - headerBottom ← HEADER_CENTER.bottom  (= TOP_CENTER.top 과 동일해야 함)
 *   - innerH     ← MIDDLE_CENTER.top (또는 bottom)
 *   - innerV     ← MIDDLE_CENTER.left (또는 right)
 *
 * 복원에 필요한 셀이 하나라도 누락되면 null (기존 design 유지).
 */
function extractTableBorderDesign(
  meta: TemplateMetadata,
  headerXml: string,
): TableBorderDesign | null {
  const getBf = (cellKey: string) => {
    const cell = meta.placeholderStyles.cells.get(cellKey);
    if (!cell) return null;
    return findBorderFillXml(headerXml, cell.borderFillId);
  };

  const headerCenter = getBf("HEADER_CENTER");
  const headerLeft = getBf("HEADER_LEFT");
  const headerRight = getBf("HEADER_RIGHT");
  const middleCenter = getBf("MIDDLE_CENTER") ?? getBf("TOP_CENTER");
  const bottomCenter = getBf("BOTTOM_CENTER");

  if (!headerCenter || !headerLeft || !headerRight || !middleCenter || !bottomCenter) {
    return null;
  }

  const def: BorderLineSpec = { type: "SOLID", color: "#000000", width: "0.12 mm" };

  return {
    outerTop: parseBorderSide(headerCenter, "top") ?? def,
    outerLeft: parseBorderSide(headerLeft, "left") ?? def,
    outerRight: parseBorderSide(headerRight, "right") ?? def,
    outerBottom: parseBorderSide(bottomCenter, "bottom") ?? def,
    headerBottom: parseBorderSide(headerCenter, "bottom") ?? def,
    innerH: parseBorderSide(middleCenter, "top") ?? def,
    innerV: parseBorderSide(middleCenter, "left") ?? def,
  };
}
