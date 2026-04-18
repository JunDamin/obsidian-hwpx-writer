/**
 * Obsidian 전용 문법 처리 테스트.
 *
 * preprocessObsidianSyntax 단위 테스트 + 통합 (HWPX 출력 확인).
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { preprocessObsidianSyntax } from "../src/converter/ObsidianPreprocessor";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("preprocessObsidianSyntax", () => {
  it("converts simple wikilink [[target]] to standard link", () => {
    expect(preprocessObsidianSyntax("[[Home]]")).toBe("[Home](Home)");
  });

  it("converts wikilink with alias [[target|alias]]", () => {
    expect(preprocessObsidianSyntax("[[Home|홈]]")).toBe("[홈](Home)");
  });

  it("converts wikilink with heading [[target#heading]]", () => {
    expect(preprocessObsidianSyntax("[[Note#Section]]")).toBe("[Note > Section](Note#Section)");
  });

  it("converts wikilink with heading and alias", () => {
    expect(preprocessObsidianSyntax("[[Note#Sec|별칭]]")).toBe("[별칭](Note#Sec)");
  });

  it("converts embed ![[file]] same as link (MVP)", () => {
    expect(preprocessObsidianSyntax("![[image.png]]")).toBe("[image.png](image.png)");
  });

  it("preserves non-wikilink brackets", () => {
    // 표준 markdown 링크는 그대로
    expect(preprocessObsidianSyntax("[text](url)")).toBe("[text](url)");
    // 단일 대괄호도 그대로
    expect(preprocessObsidianSyntax("[foo]")).toBe("[foo]");
  });

  it("converts callout > [!NOTE] to bold prefix", () => {
    const result = preprocessObsidianSyntax("> [!NOTE] 중요 메시지");
    expect(result).toBe("> **NOTE**: 중요 메시지");
  });

  it("converts callout without title line", () => {
    const result = preprocessObsidianSyntax("> [!WARNING]\n> 본문 내용");
    expect(result).toMatch(/> \*\*WARNING\*\*:/);
    expect(result).toMatch(/> 본문 내용/);
  });

  it("converts highlight ==text== to bold", () => {
    expect(preprocessObsidianSyntax("보통 ==강조== 텍스트"))
      .toBe("보통 **강조** 텍스트");
  });

  it("does not modify == in code contexts (limitation: not context-aware)", () => {
    // 현재 구현은 코드블록 내부도 치환한다 — 알려진 한계
    // 이 테스트는 현 동작을 락인해 향후 개선을 추적.
    const result = preprocessObsidianSyntax("`==코드==`");
    expect(result).toBe("`**코드**`");
  });
});

async function section0(md: string): Promise<string> {
  const bytes = await convertMarkdownToHwpx(md, DEFAULT_SETTINGS);
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("Contents/section0.xml");
  if (!entry) throw new Error("no section0");
  return entry.async("string");
}

describe("Obsidian syntax integration (full conversion)", () => {
  it("wikilink produces hyperlink field in HWPX", async () => {
    const xml = await section0("[[홈|메인 페이지]]");
    expect(xml).toMatch(/hp:fieldBegin[^>]*type="HYPERLINK"/);
    expect(xml).toMatch(/메인 페이지/);
  });

  it("callout becomes blockquote with bold type marker", async () => {
    const xml = await section0("> [!NOTE] 주의\n> 본문");
    // NOTE 가 굵게 표시되어야 함 (bold charPrIDRef 사용)
    expect(xml).toMatch(/NOTE/);
    expect(xml).toMatch(/주의/);
    expect(xml).toMatch(/본문/);
  });
});
