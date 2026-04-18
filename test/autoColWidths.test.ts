/**
 * 표 컬럼 너비 자동 산출 테스트.
 *
 * `computeAutoColWidths` 단위 테스트 + HWPX 출력 통합 검증.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { computeAutoColWidths } from "../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS } from "../src/settings";
import { marked, type Tokens } from "marked";

function tableTokenOf(md: string): Tokens.Table {
  const tokens = marked.lexer(md);
  const tbl = tokens.find(t => t.type === "table");
  if (!tbl) throw new Error("no table in: " + md);
  return tbl as Tokens.Table;
}

async function tableCellWidths(md: string): Promise<number[]> {
  const bytes = await convertMarkdownToHwpx(md, DEFAULT_SETTINGS);
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("Contents/section0.xml")!.async("string");
  const matches = [...xml.matchAll(/<hp:cellSz width="(\d+)"/g)];
  // 첫 행의 cellCount 만큼만 (나머지 행은 같은 폭)
  const colCountMatch = /colCnt="(\d+)"/.exec(xml);
  const colCount = parseInt(colCountMatch?.[1] ?? "0", 10);
  return matches.slice(0, colCount).map(m => parseInt(m[1], 10));
}

describe("computeAutoColWidths (unit)", () => {
  it("equal content → equal widths (within rounding)", () => {
    const tok = tableTokenOf("| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |");
    const widths = computeAutoColWidths(tok, 30000);
    // 세 컬럼이 전부 1글자 → 거의 동일
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(2);
    expect(Math.abs(widths[1] - widths[2])).toBeLessThanOrEqual(2);
    // 합은 정확히 totalWidth
    expect(widths.reduce((a, b) => a + b, 0)).toBe(30000);
  });

  it("wider column gets proportionally more space", () => {
    const tok = tableTokenOf(
      "| 짧 | 내용이 훨씬 긴 컬럼 |\n" +
      "|---|---|\n" +
      "| A | 여기도 긴 텍스트 |",
    );
    const widths = computeAutoColWidths(tok, 30000);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    // 합은 정확히 totalWidth
    expect(widths.reduce((a, b) => a + b, 0)).toBe(30000);
  });

  it("Hangul counts as 2 visual units vs Latin 1", () => {
    const tok = tableTokenOf(
      "| 한글 | abcd |\n" +
      "|---|---|\n" +
      "| 가 | a |",
    );
    const widths = computeAutoColWidths(tok, 30000);
    // "한글"(4) vs "abcd"(4) → 거의 같은 폭이어야 함 (한글 2자 = abcd 4자)
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(widths[0] * 0.1);
  });

  it("minimum width guaranteed for empty/tiny columns", () => {
    const tok = tableTokenOf("| A | |\n|---|---|\n| 1 | |");
    const widths = computeAutoColWidths(tok, 30000);
    // 빈 컬럼도 최소 폭 보장
    expect(widths[1]).toBeGreaterThan(0);
    expect(widths.reduce((a, b) => a + b, 0)).toBe(30000);
  });

  it("respects inline markdown in cells (strips ** and *)", () => {
    // 시각 폭 계산은 **굵은** 의 별표를 세지 않아야 함
    const tok1 = tableTokenOf("| 일반텍스트 |\n|---|\n| a |");
    const tok2 = tableTokenOf("| **일반텍스트** |\n|---|\n| a |");
    const w1 = computeAutoColWidths(tok1, 10000);
    const w2 = computeAutoColWidths(tok2, 10000);
    // 동일한 가시 텍스트면 같은 너비여야 함
    expect(w1[0]).toBe(w2[0]);
  });
});

describe("auto column widths (integration)", () => {
  it("content with varied widths produces non-uniform columns in HWPX", async () => {
    const widths = await tableCellWidths(
      "| 짧 | 중간 길이 | 아주 아주 긴 컬럼 내용 |\n" +
      "|---|---|---|\n" +
      "| A | BB | CCC |",
    );
    expect(widths.length).toBe(3);
    // 오름차순이어야 함
    expect(widths[0]).toBeLessThan(widths[1]);
    expect(widths[1]).toBeLessThan(widths[2]);
  });

  it("uniform 1-char table produces near-equal widths", async () => {
    const widths = await tableCellWidths("| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |");
    expect(widths.length).toBe(3);
    const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
    for (const w of widths) {
      expect(Math.abs(w - avg)).toBeLessThan(3); // 반올림 오차만
    }
  });
});
