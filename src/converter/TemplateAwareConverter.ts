/**
 * 템플릿 기반 Markdown → HWPX 변환.
 *
 * 핵심 아이디어:
 *   - 템플릿의 header.xml 과 content.hpf 를 그대로 사용 (스타일·폰트·borderFill 보존)
 *   - section0.xml 은 재작성: 템플릿의 secPr(페이지 설정)는 유지, 나머지는 제거하고
 *     marked 토큰으로부터 생성된 문단/표/리스트를 템플릿의 스타일 ID 로 렌더
 *   - 스타일 ID 는 TemplateReader 가 placeholder 들에서 추출한 매핑에서 가져옴
 *     (H1→paraPrId/charPrId, CELL_HEADER_LEFT→셀 스타일 등)
 *
 * hwpx-core 의 Document/Section 빌더를 거치지 않고 XML 을 직접 조립 — 템플릿의
 * 스타일을 하나도 잃지 않도록.
 */

import JSZip from "jszip";
import { lexMarkdown } from "./MarkdownLexer";
import { preprocessObsidianSyntax } from "./ObsidianPreprocessor";
import type {
  TemplateMetadata, ParaStyleRef, CellStyleRef, ListStyleRef,
} from "./TemplateReader";
import type { Token, Tokens } from "marked";
import type { HwpxWriterSettings, TableBorderDesign, BorderLineSpec } from "../settings";
import { defaultBorderDesign } from "../settings";

/** marked token 에 공식 타입이 없는 확장 프로퍼티. */
interface TokenExt { raw?: string; text?: string; tokens?: Token[]; latex?: string; }

// ══ 공개 API ═════════════════════════════════════════════════════════════

/**
 * 템플릿 바이트 + 마크다운 → 최종 HWPX 바이트.
 *
 * @param templateBytes 원본 템플릿 HWPX 의 ZIP 바이트
 * @param templateMeta  readTemplateFromBytes 로 추출한 메타(placeholder 스타일 포함)
 * @param markdown      사용자가 제공한 마크다운 소스
 */
export async function convertWithTemplate(
  templateBytes: Uint8Array,
  templateMeta: TemplateMetadata,
  markdown: string,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes);

  // 1) 템플릿 section0.xml 로부터 secPr(페이지/머리말/각주 설정) 추출
  const origSection = await zip.file("Contents/section0.xml")!.async("string");
  const secPrBlock = extractSecPrBlock(origSection);

  // 2) 마크다운 → 토큰
  const body = preprocessObsidianSyntax(stripFrontmatter(markdown));
  const tokens = lexMarkdown(body);

  // 3) 섹션 XML 재조립
  const newSection = buildSectionXml(secPrBlock, tokens, templateMeta);

  // 4) ZIP 재패키징 — section0.xml 만 교체
  zip.file("Contents/section0.xml", newSection);

  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

// ══ 섹션 XML 빌더 ═════════════════════════════════════════════════════════

/**
 * 템플릿의 첫 문단에 묻힌 `<hp:secPr>...</hp:secPr>` + `<hp:ctrl><hp:colPr/></hp:ctrl>`
 * 블록을 그대로 추출. 새 섹션 XML 의 첫 문단에 그대로 재사용.
 */
function extractSecPrBlock(sectionXml: string): { secPrXml: string; ctrlXml: string } {
  const secPrMatch = /<hp:secPr[\s\S]*?<\/hp:secPr>/.exec(sectionXml);
  const ctrlMatch = /<hp:ctrl>\s*<hp:colPr[^/]*\/>\s*<\/hp:ctrl>/.exec(sectionXml);
  return {
    secPrXml: secPrMatch ? secPrMatch[0] : "",
    ctrlXml: ctrlMatch ? ctrlMatch[0] : "",
  };
}

/**
 * 토큰 트리를 순회하며 문단/표/리스트 XML 조각을 생성하고 최종 section0.xml 을 구성.
 */
function buildSectionXml(
  secPr: { secPrXml: string; ctrlXml: string },
  tokens: Token[],
  meta: TemplateMetadata,
): string {
  const parts: string[] = [];

  // XML 선언 + hs:sec 루트 (템플릿 원본과 동일 네임스페이스 세트)
  parts.push(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>` +
    `<hs:sec xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"` +
    ` xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"` +
    ` xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"` +
    ` xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"` +
    ` xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"` +
    ` xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version"` +
    ` xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page"` +
    ` xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history"` +
    ` xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph"` +
    ` xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"` +
    ` xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">`,
  );

  // 1) 첫 문단: secPr + ctrl 만 포함 (템플릿 구조 따름)
  parts.push(
    `<hp:p paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="0">` +
    secPr.secPrXml +
    secPr.ctrlXml +
    `</hp:run></hp:p>`,
  );

  // 2) 본문 — 토큰별 에미션
  const ctx: EmitContext = {
    meta,
    parts,
    atPageStart: true,
    quoteDepth: 0,
  };
  for (const tok of tokens) {
    emitToken(tok, ctx);
  }

  parts.push(`</hs:sec>`);
  return parts.join("");
}

interface EmitContext {
  meta: TemplateMetadata;
  parts: string[];
  atPageStart: boolean;
  quoteDepth: number;
}

// ══ 토큰 → XML 에미션 ════════════════════════════════════════════════════

function emitToken(tok: Token, ctx: EmitContext): void {
  const t = tok.type;
  if (t === "space") return;

  if (t === "heading") {
    const h = tok as Tokens.Heading;
    const level = Math.min(Math.max(h.depth, 1), 9);
    const ref = ctx.meta.placeholderStyles.paragraphs.get(`H${level}`)
      ?? ctx.meta.placeholderStyles.paragraphs.get("BODY")
      ?? defaultParaRef();
    emitParagraphXml(ctx, ref, h.tokens || [], ref.charPrId);
    ctx.atPageStart = false;
    return;
  }

  if (t === "paragraph") {
    const p = tok as Tokens.Paragraph;
    const ref = ctx.meta.placeholderStyles.paragraphs.get("BODY") ?? defaultParaRef();
    emitParagraphXml(ctx, ref, p.tokens || [], ref.charPrId);
    ctx.atPageStart = false;
    return;
  }

  if (t === "code") {
    const c = tok as Tokens.Code;
    const ref = ctx.meta.placeholderStyles.paragraphs.get("CODE")
      ?? ctx.meta.placeholderStyles.paragraphs.get("BODY")
      ?? defaultParaRef();
    // 코드 블록은 줄바꿈 유지 — 단일 run 의 텍스트에 \n 포함
    emitSimpleParagraph(ctx, ref, c.text);
    ctx.atPageStart = false;
    return;
  }

  if (t === "blockquote") {
    const bq = tok as Tokens.Blockquote;
    const nested = { ...ctx, quoteDepth: ctx.quoteDepth + 1 };
    for (const child of bq.tokens || []) emitToken(child, nested);
    ctx.atPageStart = nested.atPageStart;
    return;
  }

  if (t === "list") {
    emitList(tok as Tokens.List, ctx, 0);
    return;
  }

  if (t === "table") {
    emitTable(tok as Tokens.Table, ctx);
    return;
  }

  if (t === "hr") {
    if (!ctx.atPageStart) {
      const ref = ctx.meta.placeholderStyles.paragraphs.get("BODY") ?? defaultParaRef();
      emitSimpleParagraph(ctx, ref, "");
      ctx.atPageStart = false;
    }
    return;
  }

  if (t === "mathBlock") {
    // 수식은 일단 텍스트로 (향후 확장: equation 요소)
    const ref = ctx.meta.placeholderStyles.paragraphs.get("BODY") ?? defaultParaRef();
    emitSimpleParagraph(ctx, ref, (tok as TokenExt).latex ?? "");
    ctx.atPageStart = false;
    return;
  }

  // 모르는 토큰 — raw 텍스트 fallback
  const raw = (tok as TokenExt).raw;
  if (typeof raw === "string" && raw.trim()) {
    const ref = ctx.meta.placeholderStyles.paragraphs.get("BODY") ?? defaultParaRef();
    emitSimpleParagraph(ctx, ref, raw.trim());
    ctx.atPageStart = false;
  }
}

function emitParagraphXml(
  ctx: EmitContext,
  ref: ParaStyleRef,
  inlineTokens: Token[],
  baseCharPrId: number,
): void {
  const runs = renderInlineRuns(inlineTokens, baseCharPrId, ctx.meta);
  ctx.parts.push(
    `<hp:p paraPrIDRef="${ref.paraPrId}" styleIDRef="${ref.styleId}" ` +
    `pageBreak="0" columnBreak="0" merged="0">${runs}</hp:p>`,
  );
}

function emitSimpleParagraph(ctx: EmitContext, ref: ParaStyleRef, text: string): void {
  const runXml = `<hp:run charPrIDRef="${ref.charPrId}"><hp:t>${xmlEscape(text)}</hp:t></hp:run>`;
  ctx.parts.push(
    `<hp:p paraPrIDRef="${ref.paraPrId}" styleIDRef="${ref.styleId}" ` +
    `pageBreak="0" columnBreak="0" merged="0">${runXml}</hp:p>`,
  );
}

function emitList(list: Tokens.List, ctx: EmitContext, level: number): void {
  const levelKey = Math.min(Math.max(level + 1, 1), 7);
  const listKey = list.ordered ? `ORDERED_${levelKey}` : `BULLET_${levelKey}`;
  const ref = ctx.meta.placeholderStyles.lists.get(listKey)
    ?? fallbackListRef(ctx.meta, list.ordered);

  let counter = typeof list.start === "number" ? list.start : 1;
  for (const item of list.items) {
    emitListItem(item, ctx, level, list.ordered, counter, ref);
    if (list.ordered) counter++;
  }
  ctx.atPageStart = false;
}

function emitListItem(
  item: Tokens.ListItem,
  ctx: EmitContext,
  level: number,
  ordered: boolean,
  counter: number,
  ref: ListStyleRef,
): void {
  // 프리픽스: 템플릿 리스트 ref 에 prefix 가 있으면 그대로 사용, 없으면 기본 기호
  let prefix = ref.prefix ?? "";
  if (!prefix) {
    if (item.task) prefix = item.checked ? "☑ " : "☐ ";
    else if (ordered) prefix = `${counter}. `;
    else prefix = "● ";
  } else if (ordered) {
    // ordered 리스트는 prefix 에 숫자를 보정
    prefix = `${counter}. `;
  }

  // 아이템의 첫 블록은 프리픽스와 함께 하나의 문단으로
  const tokens = item.tokens || [];
  let firstEmitted = false;
  for (const child of tokens) {
    if (!firstEmitted && (child.type === "text" || child.type === "paragraph")) {
      const inline = (child as TokenExt).tokens || [{ type: "text", text: (child as TokenExt).text || "" }];
      const runs = renderInlineWithPrefix(prefix, inline, ref.charPrId, ctx.meta);
      ctx.parts.push(
        `<hp:p paraPrIDRef="${ref.paraPrId}" styleIDRef="${ref.styleId}" ` +
        `pageBreak="0" columnBreak="0" merged="0">${runs}</hp:p>`,
      );
      firstEmitted = true;
      continue;
    }
    if (child.type === "list") {
      emitList(child as Tokens.List, ctx, level + 1);
      continue;
    }
    // 코드 블록 등 기타는 일반 경로
    emitToken(child, ctx);
  }

  if (!firstEmitted) {
    emitSimpleParagraph(ctx, ref, prefix.trim());
  }
}

function emitTable(tok: Tokens.Table, ctx: EmitContext): void {
  const rowCount = tok.rows.length + 1;
  const colCount = tok.header.length;
  if (colCount === 0) return;

  // 컬럼 너비 — 템플릿 원본 표 너비가 있으면 그걸 사용, 아니면 균등
  // (간단히) 각 컬럼 균등 분배 — 템플릿의 실제 표 너비 참조는 향후
  const totalWidth = 49609;  // 기본값 (템플릿 원본을 보고 향후 세분화)
  const colWidths: number[] = [];
  const base = Math.floor(totalWidth / colCount);
  for (let c = 0; c < colCount; c++) colWidths.push(base);
  colWidths[colCount - 1] += totalWidth - base * colCount;

  // 셀 스타일 선택 함수
  const cellStyle = (row: number, col: number): CellStyleRef => {
    const rowKey = row === 0 ? "HEADER" :
                   row === 1 ? "TOP" :
                   row === rowCount - 1 ? "BOTTOM" : "MIDDLE";
    const colKey = col === 0 ? "LEFT" :
                   col === colCount - 1 ? "RIGHT" : "CENTER";
    return ctx.meta.placeholderStyles.cells.get(`${rowKey}_${colKey}`)
        ?? ctx.meta.placeholderStyles.cells.get("MIDDLE_CENTER")
        ?? fallbackCellRef();
  };

  // 표 감싸는 hp:p (빈 문단 안에 hp:tbl)
  const outerParaRef = ctx.meta.placeholderStyles.paragraphs.get("BODY") ?? defaultParaRef();

  const rowHeight = 2268;
  const totalHeight = rowHeight * rowCount;

  const tblParts: string[] = [];
  tblParts.push(
    `<hp:p paraPrIDRef="${outerParaRef.paraPrId}" styleIDRef="${outerParaRef.styleId}" ` +
    `pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${outerParaRef.charPrId}">` +
    `<hp:tbl id="" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" ` +
    `textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" ` +
    `repeatHeader="1" rowCnt="${rowCount}" colCnt="${colCount}" cellSpacing="0" ` +
    `borderFillIDRef="1" noAdjust="0">` +
    `<hp:sz width="${totalWidth}" widthRelTo="ABSOLUTE" height="${totalHeight}" ` +
    `heightRelTo="ABSOLUTE" protect="0" />` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" ` +
    `holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" ` +
    `horzAlign="LEFT" vertOffset="0" horzOffset="0" />` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0" />` +
    `<hp:inMargin left="0" right="0" top="0" bottom="0" />`,
  );

  // 각 행
  const emitRow = (rowIdx: number, cellTexts: string[]) => {
    tblParts.push(`<hp:tr>`);
    for (let c = 0; c < colCount; c++) {
      const text = cellTexts[c] ?? "";
      const style = cellStyle(rowIdx, c);
      const isHeader = rowIdx === 0;
      tblParts.push(
        `<hp:tc name="" header="${isHeader ? 1 : 0}" hasMargin="1" protect="0" ` +
        `editable="0" dirty="0" borderFillIDRef="${style.borderFillId}">` +
        `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" ` +
        `linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" ` +
        `hasTextRef="0" hasNumRef="0">` +
        `<hp:p paraPrIDRef="${style.paraPrId}" styleIDRef="${style.styleId}" ` +
        `pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${style.charPrId}"><hp:t>${xmlEscape(text)}</hp:t></hp:run>` +
        `</hp:p>` +
        `</hp:subList>` +
        `<hp:cellAddr colAddr="${c}" rowAddr="${rowIdx}" />` +
        `<hp:cellSpan colSpan="1" rowSpan="1" />` +
        `<hp:cellSz width="${colWidths[c]}" height="${rowHeight}" />` +
        `<hp:cellMargin left="${style.marginLeft}" right="${style.marginRight}" ` +
        `top="${style.marginTop}" bottom="${style.marginBottom}" />` +
        `</hp:tc>`,
      );
    }
    tblParts.push(`</hp:tr>`);
  };

  // 머리행
  emitRow(0, tok.header.map(c => c.text));
  // 본문
  for (let r = 0; r < tok.rows.length; r++) {
    emitRow(r + 1, tok.rows[r].map(c => c.text));
  }

  tblParts.push(`</hp:tbl></hp:run></hp:p>`);
  ctx.parts.push(tblParts.join(""));
  ctx.atPageStart = false;
}

// ══ 인라인 토큰 → run XML ═══════════════════════════════════════════════

/** 인라인 토큰 배열을 run XML 문자열들로 변환해 이어 붙인다. */
function renderInlineRuns(
  tokens: Token[],
  baseCharPrId: number,
  meta: TemplateMetadata,
): string {
  if (!tokens.length) {
    return `<hp:run charPrIDRef="${baseCharPrId}"><hp:t></hp:t></hp:run>`;
  }
  return tokens.map(t => renderInlineToken(t, baseCharPrId, meta)).join("");
}

function renderInlineWithPrefix(
  prefix: string,
  inline: Token[],
  baseCharPrId: number,
  meta: TemplateMetadata,
): string {
  const prefixRun = prefix
    ? `<hp:run charPrIDRef="${baseCharPrId}"><hp:t>${xmlEscape(prefix)}</hp:t></hp:run>`
    : "";
  return prefixRun + renderInlineRuns(inline, baseCharPrId, meta);
}

function renderInlineToken(tok: Token, baseCharPrId: number, meta: TemplateMetadata): string {
  switch (tok.type) {
    case "text": {
      const tt = tok as Tokens.Text;
      if (tt.tokens?.length) {
        return tt.tokens.map(t => renderInlineToken(t, baseCharPrId, meta)).join("");
      }
      return `<hp:run charPrIDRef="${baseCharPrId}"><hp:t>${xmlEscape(decodeEntities(tt.text || ""))}</hp:t></hp:run>`;
    }
    case "codespan": {
      // CODE placeholder 의 charPrId 사용 (있으면), 없으면 기본
      const codeRef = meta.placeholderStyles.paragraphs.get("CODE");
      const cpId = codeRef?.charPrId ?? baseCharPrId;
      return `<hp:run charPrIDRef="${cpId}"><hp:t>${xmlEscape(decodeEntities((tok as Tokens.Codespan).text))}</hp:t></hp:run>`;
    }
    case "strong":
    case "em":
    case "del": {
      // 굵게/기울임/취소선은 템플릿에 해당 스타일이 없으면 base 로 fallback
      // (향후: BOLD/ITALIC/STRIKE placeholder 지원)
      const t = tok as TokenExt;
      if (t.tokens?.length) {
        return t.tokens.map((c: Token) => renderInlineToken(c, baseCharPrId, meta)).join("");
      }
      return `<hp:run charPrIDRef="${baseCharPrId}"><hp:t>${xmlEscape(t.text || "")}</hp:t></hp:run>`;
    }
    case "link": {
      const lk = tok as Tokens.Link;
      // LINK placeholder 가 있으면 그 charPrId 사용
      const linkRef = meta.placeholderStyles.paragraphs.get("LINK");
      const cpId = linkRef?.charPrId ?? baseCharPrId;
      // Hyperlink 필드는 복잡하므로 일단 텍스트만 스타일링 (향후 실제 hp:fieldBegin/End)
      return `<hp:run charPrIDRef="${cpId}"><hp:t>${xmlEscape(decodeEntities(lk.text))}</hp:t></hp:run>`;
    }
    case "image": {
      const im = tok as Tokens.Image;
      return `<hp:run charPrIDRef="${baseCharPrId}"><hp:t>${xmlEscape(`[이미지: ${im.text || im.href}]`)}</hp:t></hp:run>`;
    }
    case "br": {
      return `<hp:run charPrIDRef="${baseCharPrId}"><hp:t> </hp:t></hp:run>`;
    }
    case "escape": {
      return `<hp:run charPrIDRef="${baseCharPrId}"><hp:t>${xmlEscape((tok as Tokens.Escape).text)}</hp:t></hp:run>`;
    }
    default: {
      const raw = (tok as TokenExt).text ?? (tok as TokenExt).raw ?? "";
      return raw
        ? `<hp:run charPrIDRef="${baseCharPrId}"><hp:t>${xmlEscape(raw)}</hp:t></hp:run>`
        : "";
    }
  }
}

// ══ 유틸 ══════════════════════════════════════════════════════════════════

function defaultParaRef(): ParaStyleRef {
  return { paraPrId: 0, charPrId: 0, styleId: 0 };
}

function fallbackCellRef(): CellStyleRef {
  return {
    paraPrId: 0, charPrId: 0, styleId: 0,
    borderFillId: 1,
    marginLeft: 510, marginRight: 510, marginTop: 141, marginBottom: 141,
  };
}

function fallbackListRef(meta: TemplateMetadata, _ordered: boolean): ListStyleRef {
  const body = meta.placeholderStyles.paragraphs.get("BODY") ?? defaultParaRef();
  return {
    paraPrId: body.paraPrId,
    charPrId: body.charPrId,
    styleId: body.styleId,
    prefix: null,
  };
}

function xmlEscape(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripFrontmatter(md: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  return m ? md.slice(m[0].length) : md;
}
