/**
 * Markdown → HWPX 변환 엔진.
 *
 * remark로 Markdown을 AST로 파싱하고, AST를 순회하면서
 * hwpx-core의 Document/Section/Paragraph/Table 등을 조립한다.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Root, Content, Heading, Paragraph as MdParagraph, Text, Strong, Emphasis, Delete, Link, InlineCode, Code, Table as MdTable, TableRow, TableCell, List, ListItem, ThematicBreak, Blockquote, Image as MdImage, FootnoteDefinition, FootnoteReference, Math as MdMath, InlineMath } from "mdast";

import {
  HwpxDocument, Section, Paragraph, TextRun, Table, TableCell as HwpxTableCell,
  CharProperties, ParaProperties, BorderFill, BorderLine, SolidFill,
  Equation, Hyperlink, Footnote,
  pt, mm,
} from "../hwpx-core/index";

import type { HwpxWriterSettings } from "../settings";

export interface ConvertResult {
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * Markdown 텍스트를 HWPX 바이트로 변환.
 */
export async function convertMarkdownToHwpx(
  markdown: string,
  settings: HwpxWriterSettings,
  resolveImage?: (src: string) => Promise<Uint8Array | null>,
): Promise<Uint8Array> {
  // 1. Markdown → AST
  const ast = parseMarkdown(markdown);

  // 2. AST → HwpxDocument
  const doc = buildHwpxDocument(ast, settings, resolveImage);

  // 3. HwpxDocument → bytes
  return doc.toBytes();
}

/**
 * Markdown 텍스트를 remark AST로 파싱.
 */
function parseMarkdown(markdown: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath);

  return processor.parse(markdown) as Root;
}

/**
 * remark AST를 HwpxDocument로 변환.
 */
function buildHwpxDocument(
  ast: Root,
  settings: HwpxWriterSettings,
  resolveImage?: (src: string) => Promise<Uint8Array | null>,
): HwpxDocument {
  const doc = new HwpxDocument({ title: "", creator: "Obsidian HWPX Writer" });

  // 페이지 설정
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

  // 각주 수집
  const footnotes = collectFootnotes(ast);

  // 블록 처리
  let isFirstBlock = true;
  for (const node of ast.children) {
    processBlock(node, doc, sec, styles, settings, footnotes, isFirstBlock);
    isFirstBlock = false;
  }

  return doc;
}

// ── 스타일 등록 ──

interface RegisteredStyles {
  bodyCharPrId: number;
  bodyParaPrId: number;
  headingCharPrIds: number[];
  headingParaPrIds: number[];
  boldCharPrId: number;
  italicCharPrId: number;
  boldItalicCharPrId: number;
  strikeCharPrId: number;
  codeCharPrId: number;
  linkCharPrId: number;
  centerParaPrId: number;
  headerBfId: number;
  bodyBfId: number;
}

function registerStyles(doc: HwpxDocument, settings: HwpxWriterSettings): RegisteredStyles {
  // 본문 charPr
  const bodyCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize),
  }));

  // 본문 paraPr (기본 정렬)
  const bodyParaPrId = 0; // 기본값 사용

  // 헤딩 charPr/paraPr
  const headingCharPrIds: number[] = [];
  const headingParaPrIds: number[] = [];
  for (let i = 0; i < 6; i++) {
    const hs = settings.headingStyles[i] || { fontSize: 10, bold: true, pageBreakBefore: false };
    headingCharPrIds.push(doc.addCharProperty(new CharProperties({
      height: pt(hs.fontSize),
      bold: hs.bold,
    })));
    headingParaPrIds.push(doc.addParaProperty(new ParaProperties({
      alignHorizontal: i === 0 ? "CENTER" : "JUSTIFY",
      pageBreakBefore: hs.pageBreakBefore,
    })));
  }

  // 서식 charPr
  const boldCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), bold: true,
  }));
  const italicCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), italic: true,
  }));
  const boldItalicCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), bold: true, italic: true,
  }));
  const strikeCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), strikeoutShape: "SOLID",
  }));
  const codeCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize),
  }));
  const linkCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize),
    textColor: settings.linkColor,
    underlineType: "BOTTOM", underlineShape: "SOLID",
    underlineColor: settings.linkColor,
  }));

  const centerParaPrId = doc.addParaProperty(new ParaProperties({
    alignHorizontal: "CENTER",
  }));

  // 표 BorderFill
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
    bodyCharPrId, bodyParaPrId, headingCharPrIds, headingParaPrIds,
    boldCharPrId, italicCharPrId, boldItalicCharPrId,
    strikeCharPrId, codeCharPrId, linkCharPrId,
    centerParaPrId, headerBfId, bodyBfId,
  };
}

// ── 블록 핸들러 ──

function processBlock(
  node: Content,
  doc: HwpxDocument,
  sec: Section,
  styles: RegisteredStyles,
  settings: HwpxWriterSettings,
  footnotes: Map<string, Content[]>,
  isFirstBlock: boolean,
) {
  switch (node.type) {
    case "heading":
      handleHeading(node as Heading, sec, styles, isFirstBlock);
      break;
    case "paragraph":
      handleParagraph(node as MdParagraph, sec, styles, doc, footnotes);
      break;
    case "table":
      handleTable(node as MdTable, sec, styles, doc);
      break;
    case "list":
      handleList(node as List, sec, styles, doc, footnotes, 0);
      break;
    case "code":
      handleCodeBlock(node as Code, sec, styles);
      break;
    case "blockquote":
      handleBlockquote(node as Blockquote, doc, sec, styles, settings, footnotes);
      break;
    case "thematicBreak":
      sec.addParagraph("");
      sec.addParagraph("");
      break;
    case "math":
      handleMathBlock(node as MdMath, sec, doc);
      break;
    case "footnoteDefinition":
      // 이미 collectFootnotes에서 처리됨
      break;
    default:
      // 알 수 없는 블록은 무시
      break;
  }
}

function handleHeading(node: Heading, sec: Section, styles: RegisteredStyles, isFirstBlock: boolean) {
  const level = Math.min(node.depth, 6) - 1; // 0-indexed
  const charPrId = styles.headingCharPrIds[level] || 0;
  const paraPrId = styles.headingParaPrIds[level] || 0;

  const p = new Paragraph(paraPrId);
  processInlines(node.children, p, styles, charPrId);
  sec.addParagraph(p);
}

function handleParagraph(
  node: MdParagraph,
  sec: Section,
  styles: RegisteredStyles,
  doc: HwpxDocument,
  footnotes: Map<string, Content[]>,
) {
  const p = new Paragraph(styles.bodyParaPrId);
  processInlines(node.children, p, styles, styles.bodyCharPrId, doc, footnotes);
  sec.addParagraph(p);
}

function handleTable(node: MdTable, sec: Section, styles: RegisteredStyles, doc: HwpxDocument) {
  const rows = node.children.length;
  const cols = node.children[0]?.children.length || 1;

  const tbl = sec.addTable({ rows, cols });

  // 머리행
  if (rows > 0) {
    const headerTexts = node.children[0].children.map((cell: TableCell) =>
      getPlainText(cell.children)
    );
    tbl.setHeaderRow(headerTexts, {
      charPrId: styles.boldCharPrId,
      paraPrId: styles.centerParaPrId,
      headerBorderFillId: styles.headerBfId,
    });
  }

  // 본문행
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellNode = node.children[r]?.children[c];
      if (cellNode) {
        const text = getPlainText(cellNode.children);
        const cell = tbl.setCell(r, c, text, styles.bodyCharPrId);
        cell.borderFillId = styles.bodyBfId;
      }
    }
  }
}

function handleList(
  node: List,
  sec: Section,
  styles: RegisteredStyles,
  doc: HwpxDocument,
  footnotes: Map<string, Content[]>,
  level: number,
) {
  const isOrdered = node.ordered ?? false;
  let counter = node.start ?? 1;

  for (const item of node.children) {
    if (item.type !== "listItem") continue;

    // 리스트 아이템의 첫 번째 문단
    for (const child of item.children) {
      if (child.type === "paragraph") {
        const prefix = isOrdered ? `${counter}. ` : getBulletChar(level);
        const indent = 2000 * (level + 1); // HWPUNIT

        const pp = doc.addParaProperty(new ParaProperties({
          marginLeft: indent,
          indent: -2000,
        }));

        const p = new Paragraph(pp);
        p.addRun(prefix, styles.bodyCharPrId);
        processInlines((child as MdParagraph).children, p, styles, styles.bodyCharPrId, doc, footnotes);
        sec.addParagraph(p);
      } else if (child.type === "list") {
        handleList(child as List, sec, styles, doc, footnotes, level + 1);
      }
    }
    counter++;
  }
}

function handleCodeBlock(node: Code, sec: Section, styles: RegisteredStyles) {
  const p = new Paragraph();
  p.addRun(node.value, styles.codeCharPrId);
  sec.addParagraph(p);
}

function handleBlockquote(
  node: Blockquote,
  doc: HwpxDocument,
  sec: Section,
  styles: RegisteredStyles,
  settings: HwpxWriterSettings,
  footnotes: Map<string, Content[]>,
) {
  // 인용문은 왼쪽 들여쓰기로 처리
  const indent = 2000; // ~7mm
  for (const child of node.children) {
    if (child.type === "paragraph") {
      const pp = doc.addParaProperty(new ParaProperties({ marginLeft: indent }));
      const p = new Paragraph(pp);
      processInlines((child as MdParagraph).children, p, styles, styles.bodyCharPrId, doc, footnotes);
      sec.addParagraph(p);
    }
  }
}

function handleMathBlock(node: MdMath, sec: Section, doc: HwpxDocument) {
  sec.addEquation({ latex: node.value });
}

// ── 인라인 핸들러 ──

function processInlines(
  nodes: Content[],
  p: Paragraph,
  styles: RegisteredStyles,
  defaultCharPrId: number,
  doc?: HwpxDocument,
  footnotes?: Map<string, Content[]>,
) {
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        p.addRun((node as Text).value, defaultCharPrId);
        break;
      case "strong":
        processInlines((node as Strong).children, p, styles, styles.boldCharPrId, doc, footnotes);
        break;
      case "emphasis":
        processInlines((node as Emphasis).children, p, styles, styles.italicCharPrId, doc, footnotes);
        break;
      case "delete":
        processInlines((node as Delete).children, p, styles, styles.strikeCharPrId, doc, footnotes);
        break;
      case "link": {
        const link = node as Link;
        const text = getPlainText(link.children);
        p.addField(new Hyperlink(link.url, text));
        break;
      }
      case "inlineCode":
        p.addRun((node as InlineCode).value, styles.codeCharPrId);
        break;
      case "inlineMath":
        // 인라인 수식은 텍스트로 표시 (Phase 2에서 개선)
        p.addRun(`$${(node as InlineMath).value}$`, styles.italicCharPrId);
        break;
      case "break":
        p.addRun("\n", defaultCharPrId);
        break;
      case "footnoteReference": {
        const ref = node as FootnoteReference;
        if (footnotes) {
          const content = footnotes.get(ref.identifier);
          if (content) {
            const text = getPlainText(content);
            p.addFootnote(new Footnote(text));
          }
        }
        break;
      }
      default:
        // 알 수 없는 인라인은 텍스트로 출력
        if ("value" in node) {
          p.addRun(String((node as any).value), defaultCharPrId);
        } else if ("children" in node) {
          processInlines((node as any).children, p, styles, defaultCharPrId, doc, footnotes);
        }
        break;
    }
  }
}

// ── 유틸리티 ──

function getPlainText(nodes: Content[]): string {
  return nodes.map((n) => {
    if ("value" in n) return String((n as any).value);
    if ("children" in n) return getPlainText((n as any).children);
    return "";
  }).join("");
}

function collectFootnotes(ast: Root): Map<string, Content[]> {
  const map = new Map<string, Content[]>();
  for (const node of ast.children) {
    if (node.type === "footnoteDefinition") {
      const fn = node as FootnoteDefinition;
      map.set(fn.identifier, fn.children);
    }
  }
  return map;
}

function getBulletChar(level: number): string {
  const chars = ["ㅇ ", "- ", "∙ ", "● ", "○ ", "■ ", "● "];
  return chars[level % chars.length];
}

function getPaperWidth(size: string): number {
  switch (size) {
    case "B5": return 49951;
    case "Letter": return 61200;
    default: return 59530; // A4
  }
}

function getPaperHeight(size: string): number {
  switch (size) {
    case "B5": return 70866;
    case "Letter": return 79200;
    default: return 84190; // A4
  }
}
