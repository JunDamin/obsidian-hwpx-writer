/**
 * 현재 settings → 완전한 md2hwpx-convention HWPX 템플릿 생성.
 *
 * 왜 필요:
 *   - 사용자가 여러 템플릿 실험 후 "내 원래 설정" 으로 복귀하려면 별도 복원 수단 필요
 *   - 설정을 템플릿 파일로 저장하면 드롭다운에서 "내 스타일" 선택해 언제든 복원
 *   - 한컴에서 열어 시각적으로 편집 가능
 *
 * 생성되는 placeholder (md2hwpx 컨벤션):
 *   - H1~H6 (문단)
 *   - BODY, CODE, LINK (문단·인라인)
 *   - CELL_{HEADER,TOP,MIDDLE,BOTTOM}_{LEFT,CENTER,RIGHT} (12개 표 셀)
 *   - LIST_BULLET_1~4, LIST_ORDERED_1~4 (8개 리스트 항목)
 *
 * 각 placeholder 의 charPr/paraPr/borderFill 은 settings 값에 맞게 구성된다.
 * TemplateReader.parsePlaceholderStyles 가 이걸 정확히 역추출할 수 있어야 함.
 */

import {
  HwpxDocument, Paragraph, TableCell,
  CharProperties, ParaProperties,
  BorderFill, BorderLine, SolidFill,
  Font, FontFace,
  pt, mm,
} from "../hwpx-core/index";
import type { HwpxWriterSettings, TableBorderDesign, BorderLineSpec } from "../settings";
import { defaultBorderDesign } from "../settings";

/**
 * settings 로부터 템플릿 HWPX 바이트 생성.
 */
export async function buildTemplateFromSettings(
  settings: HwpxWriterSettings,
): Promise<Uint8Array> {
  const doc = new HwpxDocument({ title: "현재 설정 스냅샷", creator: "Obsidian HWPX Writer" });

  // ─ 폰트 풀 ──────────────────────────────────────────────────────────
  // 설정의 모든 폰트를 한 풀에 모아 7개 LANG_GROUP 에 동일 순서로 등록
  const fontPool: string[] = (() => {
    const seen = new Set<string>();
    const pool: string[] = [];
    const add = (n?: string | null) => {
      if (!n || seen.has(n)) return;
      seen.add(n); pool.push(n);
    };
    add(settings.fontHangul || "맑은 고딕");
    add(settings.fontLatin || settings.fontHangul);
    add(settings.codeFontName);
    for (const h of settings.headingStyles || []) add(h?.fontName);
    for (const l of settings.listLevelStyles || []) add(l?.fontName);
    return pool;
  })();
  const idOf = (name?: string | null) => {
    if (!name) return 0;
    const i = fontPool.indexOf(name);
    return i >= 0 ? i : 0;
  };
  const LANG_GROUPS = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
  doc.setFontfaces(LANG_GROUPS.map(lang =>
    new FontFace({
      lang,
      fonts: fontPool.map((face, id) => new Font({ id, face, type: "TTF" })),
    }),
  ));

  const hangulId = idOf(settings.fontHangul);
  const latinId = idOf(settings.fontLatin || settings.fontHangul);
  const fontRefBase = (hId: number, lId: number) => ({
    fontHangul: hId, fontLatin: lId, fontHanja: hId, fontJapanese: hId,
    fontOther: hId, fontSymbol: hId, fontUser: hId,
  });
  const bodyRefs = fontRefBase(hangulId, latinId);

  // ─ charProperties ────────────────────────────────────────────────────
  const bodyCharPr = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), ...bodyRefs,
  }));
  const codeRefs = settings.codeFontName
    ? fontRefBase(idOf(settings.codeFontName), idOf(settings.codeFontName))
    : bodyRefs;
  const codeCharPr = doc.addCharProperty(new CharProperties({
    height: pt(settings.codeFontSize), ...codeRefs,
  }));
  const linkCharPr = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize),
    textColor: settings.linkColor,
    underlineType: "BOTTOM", underlineShape: "SOLID", underlineColor: settings.linkColor,
    ...bodyRefs,
  }));

  // H1~H6 charPrIds
  const headingCharPrs: number[] = [];
  for (let i = 0; i < 6; i++) {
    const hs = settings.headingStyles[i];
    if (!hs) { headingCharPrs.push(bodyCharPr); continue; }
    const hRefs = hs.fontName
      ? fontRefBase(idOf(hs.fontName), idOf(hs.fontName))
      : bodyRefs;
    headingCharPrs.push(doc.addCharProperty(new CharProperties({
      height: pt(hs.fontSize),
      bold: hs.bold,
      italic: hs.italic,
      textColor: hs.color || "#000000",
      ...hRefs,
    })));
  }

  // ─ paraProperties ────────────────────────────────────────────────────
  const bodyParaPr = doc.addParaProperty(new ParaProperties({
    lineSpacingType: "PERCENT", lineSpacingValue: settings.lineSpacing || 160,
  }));
  const headingParaPrs: number[] = [];
  for (let i = 0; i < 6; i++) {
    const hs = settings.headingStyles[i];
    if (!hs) { headingParaPrs.push(bodyParaPr); continue; }
    headingParaPrs.push(doc.addParaProperty(new ParaProperties({
      spacingBefore: mm(hs.spaceBefore || 0),
      spacingAfter: mm(hs.spaceAfter || 0),
      pageBreakBefore: !!hs.pageBreakBefore,
      lineSpacingType: "PERCENT", lineSpacingValue: settings.lineSpacing || 160,
    })));
  }

  // 리스트 4 레벨용 paraPr (들여쓰기)
  const listIndentMm = settings.listIndentPerLevel || 7;
  const listParaPrs: number[] = [];
  for (let lvl = 0; lvl < 4; lvl++) {
    listParaPrs.push(doc.addParaProperty(new ParaProperties({
      marginLeft: mm(listIndentMm) * (lvl + 1),
      indent: -mm(listIndentMm),
      lineSpacingType: "PERCENT", lineSpacingValue: settings.lineSpacing || 160,
    })));
  }

  // ─ 표 borderFill — 12개 셀 위치별 ─────────────────────────────────────
  const design: TableBorderDesign = settings.tableBorderDesign || defaultBorderDesign();
  const makeLine = (spec: BorderLineSpec) =>
    new BorderLine({ type: spec.type, width: spec.width, color: spec.color });

  const cellBf = (top: BorderLineSpec, bottom: BorderLineSpec, left: BorderLineSpec, right: BorderLineSpec, headerFill: boolean) =>
    doc.addBorderFill(new BorderFill({
      fill: headerFill ? new SolidFill({ faceColor: settings.tableHeaderBgColor }) : null,
      topBorder: makeLine(top), bottomBorder: makeLine(bottom),
      leftBorder: makeLine(left), rightBorder: makeLine(right),
    }));

  // 각 셀 위치(4행 × 3열)의 4면 구성
  // 행: 0=HEADER, 1=TOP, 2=MIDDLE, 3=BOTTOM (rowCount=4 전제)
  // 열: 0=LEFT, 1=CENTER, 2=RIGHT
  const cellBfIds: Record<string, number> = {};
  const ROW_KEYS = ["HEADER", "TOP", "MIDDLE", "BOTTOM"];
  const COL_KEYS = ["LEFT", "CENTER", "RIGHT"];
  const TOTAL_ROWS = 4;
  const TOTAL_COLS = 3;
  for (let r = 0; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < TOTAL_COLS; c++) {
      const top =
        r === 0 ? design.outerTop :
        r === 1 ? design.headerBottom :
        design.innerH;
      const bottom =
        r === TOTAL_ROWS - 1 ? design.outerBottom :
        r === 0 ? design.headerBottom :
        design.innerH;
      const left = c === 0 ? design.outerLeft : design.innerV;
      const right = c === TOTAL_COLS - 1 ? design.outerRight : design.innerV;
      const isHeader = r === 0;
      cellBfIds[`${ROW_KEYS[r]}_${COL_KEYS[c]}`] = cellBf(top, bottom, left, right, isHeader);
    }
  }

  // ─ 섹션 & 본문 ───────────────────────────────────────────────────────
  const sec = doc.addSection({
    pageWidth: paperWidth(settings.paperSize),
    pageHeight: paperHeight(settings.paperSize),
    landscape: settings.landscape,
    marginLeft: mm(settings.marginLeft),
    marginRight: mm(settings.marginRight),
    marginTop: mm(settings.marginTop),
    marginBottom: mm(settings.marginBottom),
    marginHeader: mm(settings.marginHeader),
    marginFooter: mm(settings.marginFooter),
  });

  // 문서 제목 설명 (placeholder 아님, 그냥 안내)
  const intro = new Paragraph(bodyParaPr);
  intro.addRun("이 문서는 현재 설정값의 스타일 견본입니다. 아래 placeholder 들이 Obsidian HWPX Writer 의 변환에 사용됩니다.", bodyCharPr);
  sec.addParagraph(intro);
  sec.addParagraph("");

  // H1~H6 placeholders
  for (let i = 0; i < 6; i++) {
    const p = new Paragraph(headingParaPrs[i]);
    p.addRun(`{{H${i + 1}}}`, headingCharPrs[i]);
    sec.addParagraph(p);
  }
  sec.addParagraph("");

  // BODY placeholder
  const bodyP = new Paragraph(bodyParaPr);
  bodyP.addRun("{{BODY}}", bodyCharPr);
  sec.addParagraph(bodyP);
  sec.addParagraph("");

  // LINK placeholder
  const linkP = new Paragraph(bodyParaPr);
  linkP.addRun("링크 견본: ", bodyCharPr);
  linkP.addRun("{{LINK}}", linkCharPr);
  sec.addParagraph(linkP);
  sec.addParagraph("");

  // CODE placeholder
  const codeP = new Paragraph(bodyParaPr);
  codeP.addRun("{{CODE}}", codeCharPr);
  sec.addParagraph(codeP);
  sec.addParagraph("");

  // ─ 표 (4행 × 3열) placeholder ────────────────────────────────────────
  const tbl = sec.addTable({ rows: TOTAL_ROWS, cols: TOTAL_COLS, repeatHeader: !!settings.tableRepeatHeader });
  const padH = settings.tableCellPaddingH ? mm(settings.tableCellPaddingH) : undefined;
  const padV = settings.tableCellPaddingV ? mm(settings.tableCellPaddingV) : undefined;
  const applyPadding = (cell: TableCell) => {
    if (padH !== undefined) { cell.marginLeft = padH; cell.marginRight = padH; }
    if (padV !== undefined) { cell.marginTop = padV; cell.marginBottom = padV; }
  };
  for (let r = 0; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < TOTAL_COLS; c++) {
      const key = `${ROW_KEYS[r]}_${COL_KEYS[c]}`;
      const text = `{{CELL_${key}}}`;
      const charPrId = r === 0 ? headingCharPrs[0] : bodyCharPr;  // 헤더는 H1 charPr
      if (r === 0) {
        // 머리행은 setHeaderRow 가 header=1 을 설정하지만 개별 셀 접근으로 text·style 지정
        const cell = tbl.getCell(0, c);
        cell.header = true;
        cell.paragraphs = [];
        cell.addParagraph(text, charPrId, bodyParaPr);
      } else {
        tbl.setCell(r, c, text, charPrId, bodyParaPr);
      }
      const cell = tbl.getCell(r, c);
      cell.borderFillId = cellBfIds[key];
      applyPadding(cell);
    }
  }
  sec.addParagraph("");

  // ─ 리스트 placeholder (BULLET_1~4, ORDERED_1~4) ──────────────────────
  for (let lvl = 0; lvl < 4; lvl++) {
    const p = new Paragraph(listParaPrs[lvl]);
    p.addRun(`{{LIST_BULLET_${lvl + 1}}}`, bodyCharPr);
    sec.addParagraph(p);
  }
  sec.addParagraph("");
  for (let lvl = 0; lvl < 4; lvl++) {
    const p = new Paragraph(listParaPrs[lvl]);
    p.addRun(`{{LIST_ORDERED_${lvl + 1}}}`, bodyCharPr);
    sec.addParagraph(p);
  }

  return await doc.toBytes();
}

function paperWidth(size: string): number {
  return size === "B5" ? 49951 : size === "Letter" ? 61200 : 59530;
}
function paperHeight(size: string): number {
  return size === "B5" ? 70866 : size === "Letter" ? 79200 : 84190;
}
