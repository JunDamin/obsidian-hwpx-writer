/**
 * marked 기반 파서 회귀 테스트 — 기존 자체 파서의 알려진 버그가 해결됐는지.
 *
 * 검증 방식: HWPX section0.xml 내의 run/텍스트 구조를 정규식으로 추출해
 * 기대하는 스타일 ID 조합이 나타나는지 확인.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS } from "../src/settings";

async function section0(md: string): Promise<string> {
  const bytes = await convertMarkdownToHwpx(md, DEFAULT_SETTINGS);
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("Contents/section0.xml");
  if (!entry) throw new Error("no section0");
  return entry.async("string");
}

/** section0 에서 (charPrIDRef, text) 쌍을 순서대로 추출. */
function extractRuns(xml: string): Array<{ charPr: string; text: string }> {
  const re = /<hp:run charPrIDRef="(\d+)"[^>]*>\s*<hp:t>([^<]*)<\/hp:t>/g;
  const out: Array<{ charPr: string; text: string }> = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push({ charPr: m[1], text: m[2] });
  }
  return out;
}

describe("marked regression: previously-broken inline parsing", () => {
  it("nested emphasis **bold *italic***: both styles must appear", async () => {
    const xml = await section0("**굵은 *기울임***");
    const runs = extractRuns(xml);
    // 최소 2개의 run — 서로 다른 charPrIDRef
    const charPrs = new Set(runs.map(r => r.charPr));
    expect(charPrs.size).toBeGreaterThanOrEqual(2);
    // 텍스트 조각들이 원본을 복원해야 함 (공백 포함)
    const recombined = runs.map(r => r.text).join("");
    expect(recombined).toContain("굵은");
    expect(recombined).toContain("기울임");
  });

  it("escaped asterisk \\*: should appear as literal *, not emphasis", async () => {
    const xml = await section0("일반 \\*문장\\* 끝");
    const runs = extractRuns(xml);
    const text = runs.map(r => r.text).join("");
    expect(text).toContain("*문장*");
  });

  it("code inside link [`code`](url): produces a hyperlink field", async () => {
    const xml = await section0("[`코드`](https://example.com)");
    // 링크 필드가 존재해야 함 (Hyperlink → fieldBegin)
    expect(xml).toMatch(/hp:fieldBegin[^>]*type="HYPERLINK"/);
  });
});

describe("marked regression: previously-broken block parsing", () => {
  it("table with 3 columns: produces colCnt=3 (no phantom 4th column)", async () => {
    const xml = await section0("| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |");
    const m = /colCnt="(\d+)"/.exec(xml);
    expect(m?.[1]).toBe("3");
  });

  it("ordered list nested: inner list restarts at 1", async () => {
    const xml = await section0(
      "1. 첫번째\n" +
      "2. 두번째\n" +
      "   1. 내부 첫\n" +
      "   2. 내부 둘\n" +
      "3. 세번째",
    );
    const runs = extractRuns(xml);
    const texts = runs.map(r => r.text);
    // 외부 리스트: "1. ", "2. ", "3. " 프리픽스
    expect(texts.some(t => t.startsWith("1. "))).toBe(true);
    expect(texts.some(t => t.startsWith("2. "))).toBe(true);
    expect(texts.some(t => t.startsWith("3. "))).toBe(true);
    // 내부 리스트: "1. ", "2. " 프리픽스가 다시 등장해야 함 (리셋 확인)
    const ones = texts.filter(t => t.startsWith("1. "));
    expect(ones.length).toBe(2); // 외부 1개 + 내부 1개
  });

  it("paragraph before table: does not swallow table first row", async () => {
    const xml = await section0("문단\n| A | B |\n|---|---|\n| 1 | 2 |");
    // 표가 존재해야 함
    expect(xml).toMatch(/<hp:tbl/);
    // "문단" 이 별도 문단으로 존재, "A | B" 가 텍스트로 표에 들어가지 않음
    const runs = extractRuns(xml);
    const paragraphTexts = runs.filter(r => !r.text.match(/^[AB12]$/));
    expect(paragraphTexts.some(r => r.text === "문단")).toBe(true);
    // 표 셀에 순수 값만
    expect(runs.some(r => r.text === "A")).toBe(true);
    expect(runs.some(r => r.text === "B")).toBe(true);
  });

  it("blockquote preserves paragraph breaks", async () => {
    const xml = await section0("> 첫 문단\n>\n> 둘째 문단");
    const runs = extractRuns(xml);
    // 두 개의 독립 문단 텍스트가 있어야 함
    expect(runs.some(r => r.text === "첫 문단")).toBe(true);
    expect(runs.some(r => r.text === "둘째 문단")).toBe(true);
    // 한 런에 뭉개져선 안 됨
    expect(runs.some(r => r.text.includes("첫 문단") && r.text.includes("둘째 문단"))).toBe(false);
  });

  it("task list: preserves checkbox markers", async () => {
    const xml = await section0("- [x] 완료\n- [ ] 미완료");
    const runs = extractRuns(xml);
    const prefixes = runs.map(r => r.text).filter(t => t.startsWith("☑") || t.startsWith("☐"));
    expect(prefixes.length).toBe(2);
    expect(prefixes.some(t => t.startsWith("☑"))).toBe(true);
    expect(prefixes.some(t => t.startsWith("☐"))).toBe(true);
  });
});

describe("marked regression: still-working cases", () => {
  it("simple headings render with correct charPrIDRef levels", async () => {
    const xml = await section0("# 제목1\n## 제목2\n### 제목3");
    const runs = extractRuns(xml);
    // 각 헤딩은 서로 다른 charPrIDRef 를 가져야 함
    const h1 = runs.find(r => r.text === "제목1");
    const h2 = runs.find(r => r.text === "제목2");
    const h3 = runs.find(r => r.text === "제목3");
    expect(h1?.charPr).toBeDefined();
    expect(h2?.charPr).toBeDefined();
    expect(h3?.charPr).toBeDefined();
    expect(h1?.charPr).not.toBe(h2?.charPr);
    expect(h2?.charPr).not.toBe(h3?.charPr);
  });

  it("fenced code block preserves line breaks", async () => {
    const xml = await section0("```\n라인1\n라인2\n```");
    expect(xml).toMatch(/라인1/);
    expect(xml).toMatch(/라인2/);
  });

  it("YAML frontmatter is stripped from output", async () => {
    const xml = await section0("---\ntitle: foo\n---\n\n본문");
    expect(xml).not.toMatch(/title: foo/);
    expect(xml).toMatch(/본문/);
  });
});
