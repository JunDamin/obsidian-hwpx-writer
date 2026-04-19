/**
 * Markdown → HWPX 변환 엔진.
 *
 * 파싱: `marked` v18 의 lexer 를 사용. `MarkdownLexer.ts` 에서 수식 블록 확장 추가.
 * 에미션: 이 파일의 `emitTokens()` 가 토큰 트리를 받아 HWPX 노드로 변환.
 *
 * 기존 자체 파서(~280줄)의 주요 버그를 해결:
 *   - 중첩 강조 `**굵은 *기울임***`
 *   - 순서 리스트 중첩 카운터 리셋
 *   - 인용문 내부 문단 경계
 *   - 표 직전 문단이 표를 삼키는 문제
 *   - 이스케이프 `\*`, `\[`
 *   - 태스크 리스트, 추가 GFM 기능
 */

import { log } from "../logger";
import {
  HwpxDocument, Section, Paragraph,
  CharProperties, ParaProperties, BorderFill, BorderLine, SolidFill,
  TableCell, Hyperlink,
  Font, FontFace,
  pt, mm,
} from "../hwpx-core/index";
import { type TemplateMetadata } from "./TemplateReader";
import { lexMarkdown } from "./MarkdownLexer";
import { preprocessObsidianSyntax } from "./ObsidianPreprocessor";
import type { Token, Tokens } from "marked";

import type { HwpxWriterSettings } from "../settings";

/** marked token 에 공식 타입이 없는 확장 프로퍼티. */
interface TokenExt { raw?: string; text?: string; tokens?: Token[]; }

export interface ConvertOptions {
  /** 참조 템플릿 HWPX 파일의 OS 절대 경로. 지정 시 템플릿 폰트를 승계한다. */
  templatePath?: string | null;
}

/** 템플릿 메타데이터로부터 유효 폰트를 결정. 템플릿 우선, 없으면 settings. */
function resolveFonts(
  settings: HwpxWriterSettings,
  template: TemplateMetadata | null,
): { hangul: string; latin: string; templateFonts: string[] } {
  const hangul = template?.bodyFontHangul || settings.fontHangul || "맑은 고딕";
  const latin = template?.bodyFontLatin || settings.fontLatin || hangul;
  // UI/디버그용: 템플릿이 쓰는 모든 폰트를 풀에 포함시키면 한컴에서 열었을 때
  // 스타일 전환이 자연스럽다.
  const templateFonts: string[] = [];
  if (template) {
    for (const f of template.hangulFonts) if (!templateFonts.includes(f)) templateFonts.push(f);
    for (const f of template.latinFonts) if (!templateFonts.includes(f)) templateFonts.push(f);
  }
  return { hangul, latin, templateFonts };
}

export async function convertMarkdownToHwpx(
  markdown: string,
  settings: HwpxWriterSettings,
  options: ConvertOptions = {},
): Promise<Uint8Array> {
  const t0 = Date.now();

  // 빈 마크다운 방어
  if (!markdown || markdown.trim().length === 0) {
    log.warn("Empty markdown — generating blank document");
  }

  // ── 템플릿 경로 ──────────────────────────────────────────────────────
  // 템플릿의 스타일은 "settings 적용" 시점에 이미 사용자 settings 로 복사되었다.
  // (HwpxSidebarView.applyTemplateToSettings 참조)
  // 따라서 여기서는 템플릿 파일을 다시 읽을 필요가 없고, 그냥 settings 를 쓴다.
  // templatePath 는 호환을 위해 파라미터로 남겨두되 현재는 무시.
  let template: TemplateMetadata | null = null;
  log.info("convertMarkdownToHwpx: using settings-based path (template values already in settings)");

  // 리스트 레벨별 글머리표 설정
  if (settings.listLevelStyles?.length) {
    setListLevelStyles(settings.listLevelStyles);
  } else {
    // DEFAULT_SETTINGS에는 항상 listLevelStyles가 있으므로 여기 오면 비정상. 기본값 사용.
    setListLevelStyles([
      { bulletChar: "ㅇ", fontSize: 10, fontName: "" },
      { bulletChar: "-", fontSize: 10, fontName: "" },
      { bulletChar: "∙", fontSize: 10, fontName: "" },
      { bulletChar: "●", fontSize: 9, fontName: "" },
    ]);
  }

  const doc = new HwpxDocument({ title: "", creator: "Obsidian HWPX Writer" });

  // 폰트 설정 적용 — 템플릿 활성 시 해당 템플릿의 본문 폰트를 우선.
  const fonts = resolveFonts(settings, template);
  const hangulFont = fonts.hangul;
  const latinFont = fonts.latin;
  const fontPool: string[] = (() => {
    const seen = new Set<string>();
    const pool: string[] = [];
    const add = (name: string | undefined | null) => {
      if (!name) return;
      if (seen.has(name)) return;
      seen.add(name);
      pool.push(name);
    };
    add(hangulFont);
    add(latinFont);
    // 템플릿이 제공하는 폰트도 풀에 추가 — 한컴에서 스타일 전환 시 폰트 부재 방지
    for (const f of fonts.templateFonts) add(f);
    for (const hs of settings.headingStyles || []) add(hs?.fontName);
    for (const ls of settings.listLevelStyles || []) add(ls?.fontName);
    add(settings.codeFontName);
    return pool;
  })();
  const getFontId = (name: string | undefined | null): number => {
    if (!name) return 0;
    const idx = fontPool.indexOf(name);
    return idx < 0 ? 0 : idx;
  };
  const LANG_GROUPS = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
  const customFontfaces = LANG_GROUPS.map(lang =>
    new FontFace({
      lang,
      fonts: fontPool.map((name, idx) => new Font({ id: idx, face: name, type: "TTF" })),
    }),
  );
  doc.setFontfaces(customFontfaces);

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
  const styles = registerStyles(doc, settings, { hangulFont, latinFont, getFontId });

  // 전처리 파이프라인:
  //   1) YAML frontmatter 제거 (marked 는 이걸 모름)
  //   2) Obsidian 전용 문법 → 표준 markdown 변환 (위키링크/콜아웃/하이라이트)
  const stripped = stripFrontmatter(markdown);
  const body = preprocessObsidianSyntax(stripped);

  // 토큰 트리로 변환 후 에미션
  const tokens = lexMarkdown(body);
  const ctx: EmitContext = {
    doc, sec, styles, settings,
    atPageStart: true,
    quoteDepth: 0,
  };
  emitTokens(tokens, ctx);

  const elapsed = Date.now() - t0;
  log.info(`Conversion done in ${elapsed}ms`);
  return doc.toBytes();
}

// ══ 토큰 에미션 ═══════════════════════════════════════════════════════

type RegisteredStyles = ReturnType<typeof registerStyles>;

interface EmitContext {
  doc: HwpxDocument;
  sec: Section;
  styles: RegisteredStyles;
  settings: HwpxWriterSettings;
  /** 페이지 맨 앞 위치 — 이 상태일 때 페이지 나누기/빈 줄/HR 생략 */
  atPageStart: boolean;
  /** 인용문 중첩 깊이 — 들여쓰기 계산에 사용 */
  quoteDepth: number;
}

function emitTokens(tokens: Token[], ctx: EmitContext): void {
  for (const tok of tokens) {
    emitToken(tok, ctx);
  }
}

function emitToken(tok: Token, ctx: EmitContext): void {
  const t = tok.type;

  if (t === "space") {
    // 토큰 간 공백 — 아무 것도 하지 않음 (atPageStart 유지)
    return;
  }

  if (t === "heading") {
    emitHeading(tok as Tokens.Heading, ctx);
    return;
  }

  if (t === "paragraph") {
    emitParagraph(tok as Tokens.Paragraph, ctx);
    return;
  }

  if (t === "list") {
    emitList(tok as Tokens.List, ctx, 0);
    return;
  }

  if (t === "code") {
    emitCodeBlock(tok as Tokens.Code, ctx);
    return;
  }

  if (t === "blockquote") {
    emitBlockquote(tok as Tokens.Blockquote, ctx);
    return;
  }

  if (t === "table") {
    emitTable(tok as Tokens.Table, ctx);
    return;
  }

  if (t === "hr") {
    if (!ctx.atPageStart) {
      ctx.sec.addParagraph("");
      ctx.atPageStart = false;
    }
    return;
  }

  // 커스텀 mathBlock (MarkdownLexer.ts 에서 등록)
  if (t === "mathBlock") {
    const mb = tok as unknown as { latex: string };
    ctx.sec.addEquation({ latex: mb.latex });
    ctx.atPageStart = false;
    return;
  }

  // html 블록 — 텍스트로 평탄화
  if (t === "html") {
    const html = (tok as Tokens.HTML).raw;
    if (html && html.trim()) {
      const p = new Paragraph();
      p.addRun(html.trim(), ctx.styles.bodyCharPrId);
      ctx.sec.addParagraph(p);
      ctx.atPageStart = false;
    }
    return;
  }

  // 알 수 없는 토큰 — raw 를 문단으로
  const raw = (tok as TokenExt).raw;
  if (typeof raw === "string" && raw.trim()) {
    const p = new Paragraph();
    p.addRun(raw.trim(), ctx.styles.bodyCharPrId);
    ctx.sec.addParagraph(p);
    ctx.atPageStart = false;
  }
}

function emitHeading(tok: Tokens.Heading, ctx: EmitContext): void {
  const level = tok.depth - 1; // 0-indexed
  const charPrId = ctx.styles.headingCharPrIds[level] || ctx.styles.bodyCharPrId;
  const hs = ctx.settings.headingStyles[level];

  // 페이지 나누기: 맨 앞 위치에서는 생략
  const applyPageBreak = !!hs?.pageBreakBefore && !ctx.atPageStart;
  const paraPrId = applyPageBreak
    ? (ctx.styles.headingParaPrIds[level] || 0)
    : (ctx.styles.headingParaPrNoBrIds[level] || 0);

  // 빈 줄 삽입 (앞)
  if (!ctx.atPageStart && !applyPageBreak && hs?.blankLinesBefore) {
    insertBlankLines(ctx, hs.blankLinesBefore, hs.blankLineHeight);
  }

  // 헤딩 문단 — 인라인 토큰을 그대로 사용 (헤딩 내 code 등도 헤딩 크기 유지하려면
  // baseCharPrId 전달)
  const p = new Paragraph(paraPrId);
  addInlineTokens(p, tok.tokens || [], ctx.styles, charPrId);
  ctx.sec.addParagraph(p);

  // 빈 줄 삽입 (뒤)
  if (hs?.blankLinesAfter) {
    insertBlankLines(ctx, hs.blankLinesAfter, hs.blankLineHeight);
  }

  ctx.atPageStart = false;
}

function emitParagraph(tok: Tokens.Paragraph, ctx: EmitContext): void {
  // 인용문 내부 문단은 들여쓰기 유지
  let paraPrId: number | undefined;
  if (ctx.quoteDepth > 0) {
    paraPrId = ctx.doc.addParaProperty(new ParaProperties({
      marginLeft: 2000 * ctx.quoteDepth,
    }));
  }
  const p = new Paragraph(paraPrId);
  addInlineTokens(p, tok.tokens || [], ctx.styles, ctx.styles.bodyCharPrId);
  ctx.sec.addParagraph(p);
  ctx.atPageStart = false;
}

function emitCodeBlock(tok: Tokens.Code, ctx: EmitContext): void {
  const p = new Paragraph();
  p.addRun(tok.text, ctx.styles.codeCharPrId);
  ctx.sec.addParagraph(p);
  ctx.atPageStart = false;
}

function emitBlockquote(tok: Tokens.Blockquote, ctx: EmitContext): void {
  const nested: EmitContext = { ...ctx, quoteDepth: ctx.quoteDepth + 1 };
  emitTokens(tok.tokens || [], nested);
  // 중첩 컨텍스트의 atPageStart 변화를 외부로 전파
  ctx.atPageStart = nested.atPageStart;
}

function emitList(tok: Tokens.List, ctx: EmitContext, level: number): void {
  let counter = typeof tok.start === "number" ? tok.start : 1;
  for (const item of tok.items) {
    emitListItem(item, ctx, level, tok.ordered, counter);
    if (tok.ordered) counter++;
  }
  ctx.atPageStart = false;
}

function emitListItem(
  item: Tokens.ListItem,
  ctx: EmitContext,
  level: number,
  ordered: boolean,
  counter: number,
): void {
  // 프리픽스 결정
  let prefix: string;
  if (item.task) {
    prefix = item.checked ? "☑ " : "☐ ";
  } else if (ordered) {
    prefix = `${counter}. `;
  } else {
    prefix = getBulletChar(level);
  }

  const indentMm = ctx.settings.listIndentPerLevel || 7;
  const indentVal = mm(indentMm) * (level + 1);
  const pp = ctx.doc.addParaProperty(new ParaProperties({
    marginLeft: indentVal, indent: -mm(indentMm),
  }));
  const listCpId = ctx.styles.listCharPrIds[level] || ctx.styles.bodyCharPrId;

  // 첫 블록은 프리픽스 + 인라인 내용을 한 문단으로, 이후 블록은 별도 문단으로
  const itemTokens = item.tokens || [];
  let firstEmitted = false;

  for (const child of itemTokens) {
    if (!firstEmitted && (child.type === "text" || child.type === "paragraph")) {
      const p = new Paragraph(pp);
      p.addRun(prefix, listCpId);
      const inlineTokens = (child as TokenExt).tokens || [{ type: "text", text: (child as TokenExt).text || "" }];
      addInlineTokens(p, inlineTokens, ctx.styles, listCpId);
      ctx.sec.addParagraph(p);
      firstEmitted = true;
      continue;
    }

    if (child.type === "list") {
      // 중첩 리스트
      emitList(child as Tokens.List, ctx, level + 1);
      continue;
    }

    // 기타(코드블록 등)는 일반 emit — 단, 들여쓰기가 리스트에 맞게는 안 됨
    emitToken(child, ctx);
  }

  // item 이 완전히 비었으면 프리픽스만 있는 문단이라도 추가
  if (!firstEmitted) {
    const p = new Paragraph(pp);
    p.addRun(prefix, listCpId);
    ctx.sec.addParagraph(p);
  }

  ctx.atPageStart = false;
}

function emitTable(tok: Tokens.Table, ctx: EmitContext): void {
  const rowCount = tok.rows.length + 1; // +1 for header
  const colCount = tok.header.length;
  if (colCount === 0) return;

  // 컬럼 너비 자동 산출
  const totalWidth = ctx.sec.pageWidth - ctx.sec.marginLeft - ctx.sec.marginRight;
  const colWidths = computeAutoColWidths(tok, totalWidth);

  const tbl = ctx.sec.addTable({
    rows: rowCount, cols: colCount,
    repeatHeader: !!ctx.settings.tableRepeatHeader,
    colWidths,
  });

  const padH = ctx.settings.tableCellPaddingH ? mm(ctx.settings.tableCellPaddingH) : undefined;
  const padV = ctx.settings.tableCellPaddingV ? mm(ctx.settings.tableCellPaddingV) : undefined;
  const applyPadding = (cell: TableCell) => {
    if (padH !== undefined) { cell.marginLeft = padH; cell.marginRight = padH; }
    if (padV !== undefined) { cell.marginTop = padV; cell.marginBottom = padV; }
  };

  // 위치별 borderFill 팩토리 — (r, c, isHeader) → borderFillId
  //   each cell's 4 sides depend on whether they face the table's outer edge
  //   or an interior gap. Lazy 캐시로 중복 등록 방지.
  const borderAt = makeCellBorderFactory(ctx.doc, ctx.settings, rowCount, colCount);

  // 머리행
  const headerTexts = tok.header.map(c => c.text);
  tbl.setHeaderRow(headerTexts, {
    charPrId: ctx.styles.boldCharPrId,
    paraPrId: ctx.styles.headerParaPrId,
    headerBorderFillId: borderAt(0, 0, true), // 자리 잡이 — 아래 루프에서 각 셀별로 덮어씀
  });
  for (let c = 0; c < colCount; c++) {
    const cell = tbl.getCell(0, c);
    cell.borderFillId = borderAt(0, c, true);
    applyPadding(cell);
  }

  // 본문행
  for (let r = 0; r < tok.rows.length; r++) {
    const row = tok.rows[r];
    for (let c = 0; c < colCount; c++) {
      const cell = tbl.setCell(r + 1, c, row[c]?.text || "", ctx.styles.bodyCharPrId);
      cell.borderFillId = borderAt(r + 1, c, false);
      applyPadding(cell);
    }
  }
  ctx.atPageStart = false;
}

/**
 * 셀 위치 → borderFillId 팩토리.
 *
 * 표 테두리는 `settings.tableBorderDesign` 의 7개 독립 구간(외곽 4 + headerBottom
 * + innerH + innerV) 각각의 {type, color, width} 를 셀 위치에 맞게 4면에 배정한다.
 * 동일한 4면 조합은 같은 borderFillId 공유(lazy 캐시).
 *
 * 위치 → 구간 매핑:
 *   - top:    r===0 → outerTop, r===1 → headerBottom, else → innerH
 *   - bottom: r===0 → headerBottom (헤더 1행 전제), r===last → outerBottom, else → innerH
 *   - left:   c===0 → outerLeft, else → innerV
 *   - right:  c===last → outerRight, else → innerV
 *
 * 단, rowCount===1 (헤더만) 특수 케이스: r===0 의 bottom 은 outerBottom 이어야 함.
 */
function makeCellBorderFactory(
  doc: HwpxDocument,
  settings: HwpxWriterSettings,
  rowCount: number,
  colCount: number,
): (r: number, c: number, isHeader: boolean) => number {
  const d = settings.tableBorderDesign;
  const makeLine = (spec: { type: string; color: string; width: string }) =>
    new BorderLine({ type: spec.type, width: spec.width, color: spec.color });

  const headerFill = () => new SolidFill({ faceColor: settings.tableHeaderBgColor });
  const cache = new Map<string, number>();

  const specKey = (s: { type: string; color: string; width: string }) =>
    `${s.type}:${s.color}:${s.width}`;

  return (r: number, c: number, isHeader: boolean): number => {
    // 위치 → 구간
    const topSpec = r === 0
      ? d.outerTop
      : (r === 1 ? d.headerBottom : d.innerH);
    const bottomSpec = r === rowCount - 1
      ? d.outerBottom
      : (r === 0 ? d.headerBottom : d.innerH);
    const leftSpec = c === 0 ? d.outerLeft : d.innerV;
    const rightSpec = c === colCount - 1 ? d.outerRight : d.innerV;

    const key = `${isHeader ? "H" : "B"}|${specKey(topSpec)}|${specKey(bottomSpec)}|${specKey(leftSpec)}|${specKey(rightSpec)}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const bf = new BorderFill({
      fill: isHeader ? headerFill() : null,
      topBorder: makeLine(topSpec),
      bottomBorder: makeLine(bottomSpec),
      leftBorder: makeLine(leftSpec),
      rightBorder: makeLine(rightSpec),
    });
    const id = doc.addBorderFill(bf);
    cache.set(key, id);
    return id;
  };
}

function insertBlankLines(ctx: EmitContext, n: number, heightPt: number | undefined): void {
  const blankHeight = heightPt ? pt(heightPt) : pt(ctx.settings.bodyFontSize);
  const blankPpId = ctx.doc.addParaProperty(new ParaProperties({
    lineSpacingType: "FIXED", lineSpacingValue: blankHeight,
  }));
  for (let b = 0; b < n; b++) {
    ctx.sec.addParagraph("", { paraPrId: blankPpId });
  }
}

// ══ 인라인 토큰 처리 ════════════════════════════════════════════════════

/**
 * marked 인라인 토큰 배열을 Paragraph 에 run 들로 추가.
 *
 * 핵심 개선:
 *   - 중첩 강조가 자연스럽게 동작 (marked 가 이미 AST 로 분리함)
 *   - 이스케이프 `\*` 등 처리됨
 *   - 링크 안의 코드도 올바르게 분리
 *
 * baseCharPrId 는 "이 문단의 기본 스타일" (헤딩 안의 일반 텍스트용, 리스트 안의 일반 텍스트용).
 */
function addInlineTokens(
  p: Paragraph,
  tokens: Token[],
  styles: RegisteredStyles,
  baseCharPrId: number,
): void {
  if (!tokens.length) {
    p.addRun("", baseCharPrId);
    return;
  }
  for (const t of tokens) {
    emitInline(p, t, styles, baseCharPrId);
  }
}

function emitInline(p: Paragraph, tok: Token, styles: RegisteredStyles, baseCharPrId: number): void {
  switch (tok.type) {
    case "text": {
      const tt = tok as Tokens.Text;
      // text 토큰이 내부에 inline 토큰을 가질 수 있음 (escape 처리 후)
      if (tt.tokens?.length) {
        for (const ct of tt.tokens) emitInline(p, ct, styles, baseCharPrId);
      } else {
        p.addRun(decodeEntities(tt.text || ""), baseCharPrId);
      }
      return;
    }
    case "strong": {
      const st = tok as Tokens.Strong;
      // 중첩 지원: strong 안에 em 등이 있을 수 있음 → 자식 토큰을 bold 스타일로 재귀
      if (st.tokens?.length) {
        for (const ct of st.tokens) emitInline(p, ct, styles, styles.boldCharPrId);
      } else {
        p.addRun(st.text, styles.boldCharPrId);
      }
      return;
    }
    case "em": {
      const et = tok as Tokens.Em;
      if (et.tokens?.length) {
        for (const ct of et.tokens) emitInline(p, ct, styles, styles.italicCharPrId);
      } else {
        p.addRun(et.text, styles.italicCharPrId);
      }
      return;
    }
    case "del": {
      const dt = tok as Tokens.Del;
      if (dt.tokens?.length) {
        for (const ct of dt.tokens) emitInline(p, ct, styles, styles.strikeCharPrId);
      } else {
        p.addRun(dt.text, styles.strikeCharPrId);
      }
      return;
    }
    case "codespan": {
      p.addRun(decodeEntities((tok as Tokens.Codespan).text), styles.codeCharPrId);
      return;
    }
    case "link": {
      const lk = tok as Tokens.Link;
      p.addField(new Hyperlink(lk.href, lk.text));
      return;
    }
    case "image": {
      // 이미지는 별도 처리가 필요 — 일단 alt 텍스트만 표시
      const im = tok as Tokens.Image;
      p.addRun(`[이미지: ${im.text || im.href}]`, baseCharPrId);
      return;
    }
    case "br": {
      // HWPX 에서 줄바꿈은 새 Paragraph 여야 하지만 인라인 맥락에서는 공백으로 처리
      p.addRun(" ", baseCharPrId);
      return;
    }
    case "html": {
      p.addRun(decodeEntities((tok as Tokens.HTML).raw), baseCharPrId);
      return;
    }
    case "escape": {
      p.addRun((tok as Tokens.Escape).text, baseCharPrId);
      return;
    }
    default: {
      // 알 수 없는 인라인 — raw 로
      const raw = (tok as TokenExt).text ?? (tok as TokenExt).raw ?? "";
      if (raw) p.addRun(raw, baseCharPrId);
    }
  }
}

/** marked 가 텍스트 토큰에 &amp; 등의 엔티티를 남기는 경우가 있어 복구. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/** YAML frontmatter 를 제거. marked 는 이걸 모르므로 호출 전 수동 제거. */
function stripFrontmatter(md: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
  return m ? md.slice(m[0].length) : md;
}

// ══ 표 컬럼 너비 자동 산출 ══════════════════════════════════════════════

/**
 * 인라인 토큰 트리에서 "가시 텍스트"만 평탄화해 추출.
 * `**굵은**` → "굵은" (별표 제외). 컬럼 폭 계산에 사용.
 */
function extractVisibleText(tokens: Token[] | undefined): string {
  if (!tokens || !tokens.length) return "";
  let out = "";
  for (const t of tokens) {
    const tt = t as TokenExt;
    if (Array.isArray(tt.tokens) && tt.tokens.length > 0) {
      out += extractVisibleText(tt.tokens);
    } else if (typeof tt.text === "string") {
      out += tt.text;
    } else if (typeof tt.raw === "string") {
      out += tt.raw;
    }
  }
  return out;
}

/**
 * 시각 폭 계산 — CJK(한글/한자/가나)와 전각 기호는 2, 그 외는 1.
 *
 * 한컴 기본 폰트에서 한글 한 글자가 영문보다 대략 1.5~2배 넓다. 2:1 로 근사하는 건
 * 평균 대비 약간 과대 추정이지만, 한글 컬럼이 좁아서 줄바꿈되는 것보다 안전.
 */
function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide =
      (cp >= 0x1100 && cp <= 0x115F) ||  // Hangul Jamo
      (cp >= 0x2E80 && cp <= 0x303E) ||  // CJK Radicals / Kangxi
      (cp >= 0x3041 && cp <= 0x33FF) ||  // Hiragana / Katakana / CJK symbols
      (cp >= 0x3400 && cp <= 0x4DBF) ||  // CJK Ext A
      (cp >= 0x4E00 && cp <= 0x9FFF) ||  // CJK Unified
      (cp >= 0xA000 && cp <= 0xA4CF) ||  // Yi
      (cp >= 0xAC00 && cp <= 0xD7A3) ||  // Hangul Syllables
      (cp >= 0xF900 && cp <= 0xFAFF) ||  // CJK Compat
      (cp >= 0xFE30 && cp <= 0xFE4F) ||  // CJK Compat Forms
      (cp >= 0xFF00 && cp <= 0xFF60) ||  // Fullwidth Forms
      (cp >= 0xFFE0 && cp <= 0xFFE6);    // Fullwidth signs
    w += wide ? 2 : 1;
  }
  return w;
}

/**
 * marked 테이블 토큰을 보고 각 컬럼의 시각 폭 비율로 colWidths(HWPUNIT) 를 산출.
 *
 * 알고리즘:
 *   1. 각 컬럼의 (헤더 + 본문 셀) 시각 폭 수집
 *   2. 컬럼 대표 폭 = max(셀 폭들) — 단 전체 평균의 3배로 상한 (폭주 방지)
 *   3. 최소 폭 보장 (2.0 units = 대략 한글 1자)
 *   4. 합을 totalWidth 로 정규화
 *   5. 반올림 오차는 가장 넓은 컬럼에 몰아넣음
 */
export function computeAutoColWidths(tok: Tokens.Table, totalWidth: number): number[] {
  const colCount = tok.header.length;
  if (colCount === 0) return [];

  // 1) 셀별 시각 폭 수집
  const cellWidths: number[][] = Array(colCount).fill(0).map(() => []);
  tok.header.forEach((cell, i) => {
    cellWidths[i].push(visualWidth(extractVisibleText(cell.tokens)));
  });
  for (const row of tok.rows) {
    row.forEach((cell, i) => {
      if (i < colCount) {
        cellWidths[i].push(visualWidth(extractVisibleText(cell.tokens)));
      }
    });
  }

  // 2) 컬럼 대표 폭 (상한 적용) — 한 셀이 극단적으로 길어도 다른 컬럼을 뭉개지 않게
  const allCellMax = Math.max(1, ...cellWidths.flat());
  const cap = allCellMax; // 일단 cap 을 허용 최대치로 (개별 컬럼 캡은 추후 튜닝 여지)
  const repWidths = cellWidths.map(ws => Math.min(Math.max(1, ...ws), cap));

  // 3) 최소 폭 보장
  const MIN = 2;
  for (let i = 0; i < colCount; i++) repWidths[i] = Math.max(repWidths[i], MIN);

  // 4) 정규화
  const sum = repWidths.reduce((a, b) => a + b, 0) || 1;
  const result = repWidths.map(w => Math.round((w / sum) * totalWidth));

  // 5) 반올림 오차 보정 — 가장 넓은 컬럼에 나머지를 몰아줌
  const actualSum = result.reduce((a, b) => a + b, 0);
  const diff = totalWidth - actualSum;
  if (diff !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < result.length; i++) if (result[i] > result[maxIdx]) maxIdx = i;
    result[maxIdx] += diff;
  }
  return result;
}

// ── 유틸리티 ──

function registerStyles(
  doc: HwpxDocument,
  settings: HwpxWriterSettings,
  fonts: {
    hangulFont: string;
    latinFont: string;
    getFontId: (name: string | undefined | null) => number;
  },
) {
  // 언어별 fontRef 세트 생성 헬퍼.
  // hangulName: 한글 런용, latinName: 영문/숫자용. 나머지 언어는 hangul을 따라간다.
  const refs = (hangulName: string, latinName?: string) => {
    const hId = fonts.getFontId(hangulName);
    const lId = fonts.getFontId(latinName || hangulName);
    return {
      fontHangul: hId,
      fontLatin: lId,
      fontHanja: hId,
      fontJapanese: hId,
      fontOther: hId,
      fontSymbol: hId,
      fontUser: hId,
    };
  };
  const bodyRefs = refs(fonts.hangulFont, fonts.latinFont);

  const bodyCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize),
    ...bodyRefs,
  }));
  const headingCharPrIds: number[] = [];
  const headingParaPrIds: number[] = [];
  const headingParaPrNoBrIds: number[] = [];
  for (let i = 0; i < 6; i++) {
    const hs = settings.headingStyles[i] || { fontSize: 10, bold: true, italic: false, pageBreakBefore: false, spaceBefore: 0, spaceAfter: 0, color: "#000000", fontName: "" };
    // 헤딩별 전용 폰트. 설정 없으면 본문 폰트(한글/영문) 폴백
    const headingRefs = hs.fontName
      ? refs(hs.fontName)
      : bodyRefs;
    headingCharPrIds.push(doc.addCharProperty(new CharProperties({
      height: pt(hs.fontSize),
      bold: hs.bold,
      italic: hs.italic || false,
      textColor: hs.color || "#000000",
      ...headingRefs,
    })));
    headingParaPrIds.push(doc.addParaProperty(new ParaProperties({
      pageBreakBefore: hs.pageBreakBefore,
      spacingBefore: mm(hs.spaceBefore || 0),
      spacingAfter: mm(hs.spaceAfter || 0),
    })));
    // 페이지 나누기를 생략해야 하는 경우(문서 맨 앞)에 쓰이는 동일 스펙의 대체 변형
    headingParaPrNoBrIds.push(doc.addParaProperty(new ParaProperties({
      pageBreakBefore: false,
      spacingBefore: mm(hs.spaceBefore || 0),
      spacingAfter: mm(hs.spaceAfter || 0),
    })));
  }
  const boldCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), bold: true, ...bodyRefs,
  }));
  const italicCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), italic: true, ...bodyRefs,
  }));
  const strikeCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), strikeoutShape: "SOLID", ...bodyRefs,
  }));
  // 코드는 고정폭 폰트: 한글/영문 모두 동일 폰트 적용
  const codeRefs = settings.codeFontName ? refs(settings.codeFontName) : bodyRefs;
  const codeCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize),
    ...codeRefs,
  }));
  const linkCharPrId = doc.addCharProperty(new CharProperties({
    height: pt(settings.bodyFontSize), textColor: settings.linkColor,
    underlineType: "BOTTOM", underlineShape: "SOLID", underlineColor: settings.linkColor,
    ...bodyRefs,
  }));
  // 리스트 레벨별 charPrId
  const listCharPrIds: number[] = [];
  if (settings.listLevelStyles?.length) {
    for (const ls of settings.listLevelStyles) {
      const fontSize = ls.fontSize || settings.bodyFontSize;
      const listRefs = ls.fontName ? refs(ls.fontName) : bodyRefs;
      listCharPrIds.push(doc.addCharProperty(new CharProperties({
        height: pt(fontSize),
        ...listRefs,
      })));
    }
  }

  // 머리행 정렬 paraPr (설정값 반영)
  const headerAlign = settings.tableHeaderAlign || "CENTER";
  const headerParaPrId = doc.addParaProperty(new ParaProperties({ alignHorizontal: headerAlign }));
  const centerParaPrId = doc.addParaProperty(new ParaProperties({ alignHorizontal: "CENTER" }));

  // 표 테두리는 `makeCellBorderFactory` 가 위치별로 lazy 등록 (registerStyles 에서 미등록)
  return {
    bodyCharPrId, headingCharPrIds, headingParaPrIds, headingParaPrNoBrIds,
    boldCharPrId, italicCharPrId, strikeCharPrId, codeCharPrId, linkCharPrId,
    centerParaPrId, headerParaPrId,
    listCharPrIds,
  };
}

let _bulletChars = ["ㅇ ", "- ", "∙ ", "● "];

function setListLevelStyles(levels: { bulletChar: string; fontSize: number; fontName: string }[]) {
  _bulletChars = levels.map(l => (l.bulletChar || "ㅇ").trim() + " ");
}

function getBulletChar(level: number): string {
  return _bulletChars[level % _bulletChars.length];
}

function getPaperWidth(size: string): number {
  return size === "B5" ? 49951 : size === "Letter" ? 61200 : 59530;
}

function getPaperHeight(size: string): number {
  return size === "B5" ? 70866 : size === "Letter" ? 79200 : 84190;
}
