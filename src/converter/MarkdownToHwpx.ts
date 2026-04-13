/**
 * Markdown → HWPX 변환 엔진 (자체 파서, 외부 의존성 없음).
 */

import {
  HwpxDocument, Section, Paragraph,
  CharProperties, ParaProperties, BorderFill, BorderLine, SolidFill,
  Table, Equation, Hyperlink, Footnote,
  pt, mm,
} from "../hwpx-core/index";

import type { HwpxWriterSettings } from "../settings";

export async function convertMarkdownToHwpx(
  markdown: string,
  settings: HwpxWriterSettings,
): Promise<Uint8Array> {
  const doc = new HwpxDocument({ title: "", creator: "Obsidian HWPX Writer" });

  const sec = doc.addSection({
    pageWidth: getPaperWidth(settings.paperSize),
    pageHeight: getPaperHeight(settings.paperSize),
    landscape: settings.landscape,
    marginLeft: mm(settings.marginLeft),
    marginRight: mm(settings.marginRight),
    marginTop: mm(settings.marginTop),
    marginBottom: mm(settings.marginBottom),
    marginHeader: mm(settings.marginHeader),
    marginFooter: mm(settings.marginFooter),
  });

  // 스타일 등록
  const styles = registerStyles(doc, settings);

  // 줄 단위 파싱
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (line.trim() === "") {
      i++;
      continue;
    }

    // YAML frontmatter 스킵
    if (i === 0 && line.trim() === "---") {
      i++;
      while (i < lines.length && lines[i].trim() !== "---") i++;
      i++; // --- 닫는 줄 스킵
      continue;
    }

    // 헤딩 (#, ##, ### ...)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length - 1; // 0-indexed
      const text = headingMatch[2].trim();
      const charPrId = styles.headingCharPrIds[level] || styles.bodyCharPrId;
      const paraPrId = styles.headingParaPrIds[level] || 0;
      const p = new Paragraph(paraPrId);
      addFormattedRuns(p, text, styles);
      // 헤딩은 헤딩 charPr 사용
      if (p.runs.length === 0) p.addRun(text, charPrId);
      else {
        // runs의 charPrId를 헤딩용으로 교체 (bold+크기)
        p.runs = [];
        (p as any).inlineItems = [];
        addFormattedRunsWithBase(p, text, styles, charPrId);
      }
      sec.addParagraph(p);
      i++;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      sec.addParagraph("");
      i++;
      continue;
    }

    // 코드 블록 (```)
    if (line.trim().startsWith("```")) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // ``` 닫는 줄
      const p = new Paragraph();
      p.addRun(codeLines.join("\n"), styles.codeCharPrId);
      sec.addParagraph(p);
      continue;
    }

    // 블록 수식 ($$)
    if (line.trim().startsWith("$$")) {
      i++;
      const mathLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("$$")) {
        mathLines.push(lines[i]);
        i++;
      }
      i++;
      sec.addEquation({ latex: mathLines.join("\n") });
      continue;
    }

    // 인용문 (>)
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith(">") || lines[i].trim() === "")) {
        if (lines[i].trim() === "" && i + 1 < lines.length && !lines[i + 1].startsWith(">")) break;
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const indent = 2000;
      const pp = doc.addParaProperty(new ParaProperties({ marginLeft: indent }));
      const p = new Paragraph(pp);
      addFormattedRuns(p, quoteLines.join(" "), styles);
      sec.addParagraph(p);
      continue;
    }

    // GFM 표
    if (line.includes("|") && i + 1 < lines.length && /^\|?[\s:]*-+[\s:]*/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      buildTable(tableLines, sec, styles, doc, settings);
      continue;
    }

    // 리스트 (- 또는 * 또는 숫자.)
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)/);
    if (listMatch) {
      const items: { indent: number; ordered: boolean; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.+)/);
        if (!m) break;
        const indent = m[1].length;
        const ordered = /\d+\./.test(m[2]);
        items.push({ indent, ordered, text: m[3] });
        i++;
      }
      let counter = 1;
      for (const item of items) {
        const level = Math.floor(item.indent / 2);
        const prefix = item.ordered ? `${counter}. ` : getBulletChar(level);
        const indentVal = 2000 * (level + 1);
        const pp = doc.addParaProperty(new ParaProperties({
          marginLeft: indentVal, indent: -2000,
        }));
        const p = new Paragraph(pp);
        p.addRun(prefix, styles.bodyCharPrId);
        addFormattedRuns(p, item.text, styles);
        sec.addParagraph(p);
        if (item.ordered) counter++;
      }
      continue;
    }

    // 일반 문단
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^#{1,6}\s/) && !lines[i].startsWith("```") && !lines[i].startsWith(">") && !lines[i].match(/^(\s*)([-*]|\d+\.)\s+/)) {
      paraLines.push(lines[i]);
      i++;
    }
    const fullText = paraLines.join(" ");
    const p = new Paragraph();
    addFormattedRuns(p, fullText, styles);
    sec.addParagraph(p);
  }

  return doc.toBytes();
}

// ── 인라인 서식 파싱 ──

function addFormattedRuns(p: Paragraph, text: string, styles: any) {
  addFormattedRunsWithBase(p, text, styles, styles.bodyCharPrId);
}

function addFormattedRunsWithBase(p: Paragraph, text: string, styles: any, baseCharPrId: number) {
  // 간단한 인라인 서식 파서
  // **bold**, *italic*, ~~strike~~, `code`, [link](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`(.+?)`|\[(.+?)\]\((.+?)\))/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 매치 전 텍스트
    if (match.index > lastIndex) {
      p.addRun(text.slice(lastIndex, match.index), baseCharPrId);
    }

    if (match[2]) {
      // **bold**
      p.addRun(match[2], styles.boldCharPrId);
    } else if (match[3]) {
      // *italic*
      p.addRun(match[3], styles.italicCharPrId);
    } else if (match[4]) {
      // ~~strike~~
      p.addRun(match[4], styles.strikeCharPrId);
    } else if (match[5]) {
      // `code`
      p.addRun(match[5], styles.codeCharPrId);
    } else if (match[6] && match[7]) {
      // [text](url)
      p.addField(new Hyperlink(match[7], match[6]));
    }

    lastIndex = match.index + match[0].length;
  }

  // 나머지 텍스트
  if (lastIndex < text.length) {
    p.addRun(text.slice(lastIndex), baseCharPrId);
  }

  // 아무것도 없으면 빈 런
  if (lastIndex === 0 && text.length === 0) {
    p.addRun("", baseCharPrId);
  }
}

// ── 표 빌더 ──

function buildTable(
  lines: string[],
  sec: Section,
  styles: any,
  doc: HwpxDocument,
  settings: HwpxWriterSettings,
) {
  // 구분선(---|---) 제거
  const dataLines = lines.filter(l => !/^\|?[\s:]*-+/.test(l));
  if (dataLines.length === 0) return;

  const parseRow = (line: string): string[] =>
    line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);

  const rows = dataLines.map(parseRow);
  const rowCount = rows.length;
  const colCount = rows[0]?.length || 1;

  const tbl = sec.addTable({ rows: rowCount, cols: colCount });

  // 머리행
  if (rowCount > 0) {
    tbl.setHeaderRow(rows[0], {
      charPrId: styles.boldCharPrId,
      paraPrId: styles.centerParaPrId,
      headerBorderFillId: styles.headerBfId,
    });
  }

  // 본문행
  for (let r = 1; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const text = rows[r]?.[c] || "";
      const cell = tbl.setCell(r, c, text, styles.bodyCharPrId);
      cell.borderFillId = styles.bodyBfId;
    }
  }
}

// ── 유틸리티 ──

function registerStyles(doc: HwpxDocument, settings: HwpxWriterSettings) {
  const bodyCharPrId = doc.addCharProperty(new CharProperties({ height: pt(settings.bodyFontSize) }));
  const headingCharPrIds: number[] = [];
  const headingParaPrIds: number[] = [];
  for (let i = 0; i < 6; i++) {
    const hs = settings.headingStyles[i] || { fontSize: 10, bold: true, pageBreakBefore: false };
    headingCharPrIds.push(doc.addCharProperty(new CharProperties({ height: pt(hs.fontSize), bold: hs.bold })));
    headingParaPrIds.push(doc.addParaProperty(new ParaProperties({ pageBreakBefore: hs.pageBreakBefore })));
  }
  const boldCharPrId = doc.addCharProperty(new CharProperties({ height: pt(settings.bodyFontSize), bold: true }));
  const italicCharPrId = doc.addCharProperty(new CharProperties({ height: pt(settings.bodyFontSize), italic: true }));
  const strikeCharPrId = doc.addCharProperty(new CharProperties({ height: pt(settings.bodyFontSize), strikeoutShape: "SOLID" }));
  const codeCharPrId = doc.addCharProperty(new CharProperties({ height: pt(settings.bodyFontSize) }));
  const linkCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), textColor: settings.linkColor,
    underlineType: "BOTTOM", underlineShape: "SOLID", underlineColor: settings.linkColor,
  }));
  const centerParaPrId = doc.addParaProperty(new ParaProperties({ alignHorizontal: "CENTER" }));
  const headerBfId = doc.addBorderFill(new BorderFill({
    fill: new SolidFill({ faceColor: settings.tableHeaderBgColor }),
    leftBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
    rightBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
    topBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
    bottomBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
  }));
  const bodyBfId = doc.addBorderFill(new BorderFill({
    leftBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
    rightBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
    topBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
    bottomBorder: new BorderLine({ type: "SOLID", width: "0.12 mm" }),
  }));
  return {
    bodyCharPrId, headingCharPrIds, headingParaPrIds,
    boldCharPrId, italicCharPrId, strikeCharPrId, codeCharPrId, linkCharPrId,
    centerParaPrId, headerBfId, bodyBfId,
  };
}

function getBulletChar(level: number): string {
  return ["ㅇ ", "- ", "∙ ", "● "][level % 4];
}

function getPaperWidth(size: string): number {
  return size === "B5" ? 49951 : size === "Letter" ? 61200 : 59530;
}

function getPaperHeight(size: string): number {
  return size === "B5" ? 70866 : size === "Letter" ? 79200 : 84190;
}
