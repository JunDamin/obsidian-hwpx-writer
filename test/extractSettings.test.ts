/**
 * extractSettingsFromTemplate — 템플릿에서 settings 필드 추출 검증.
 */
import { describe, it, expect } from "vitest";
import { readTemplateFromBytes } from "../src/converter/TemplateReader";
import { extractSettingsFromTemplate } from "../src/converter/extractSettingsFromTemplate";
import { decodeBogoyangsikBytes } from "../src/templates/bogoyangsikBundle";

describe("extractSettingsFromTemplate (md2hwpx 보고양식)", () => {
  it("폰트 · 본문 크기 · 헤딩 스타일 · 표 테두리를 settings 로 추출", async () => {
    const meta = await readTemplateFromBytes(decodeBogoyangsikBytes());
    const { patch, summary } = extractSettingsFromTemplate(meta, meta.rawHeaderXml);

    // 폰트 — BODY placeholder 의 fontRef 가 실제 본문 폰트 (템플릿마다 다름)
    // 하드코딩하지 않고 "존재하고 비어있지 않음" + "기본값(맑은 고딕)이 아님" 으로 검증
    expect(patch.fontHangul).toBeDefined();
    expect(patch.fontHangul).not.toBe("");
    expect(patch.fontHangul).not.toBe("맑은 고딕");

    // 본문 크기 (BODY placeholder 의 charPr.height/100)
    expect(patch.bodyFontSize).toBeDefined();
    expect(patch.bodyFontSize).toBeGreaterThan(0);
    expect(patch.bodyFontSize).toBeLessThan(30);

    // 헤딩 스타일 최소 1개 이상
    expect(Array.isArray(patch.headingStyles)).toBe(true);
    expect(patch.headingStyles!.length).toBeGreaterThanOrEqual(1);

    // H1 의 fontSize 는 본문보다 큼
    const h1 = patch.headingStyles![0];
    expect(h1).toBeDefined();
    expect(h1.fontSize).toBeGreaterThan(patch.bodyFontSize!);

    // 표 테두리 디자인 복원
    expect(patch.tableBorderDesign).toBeDefined();
    expect(patch.tableBorderDesign!.outerTop).toBeDefined();
    expect(patch.tableBorderDesign!.headerBottom).toBeDefined();
    expect(patch.tableBorderDesign!.innerH).toBeDefined();

    // summary 는 비어있지 않음
    expect(summary.length).toBeGreaterThan(0);
  });

  it("표 머리행 배경색 추출 (HEADER_CENTER 셀에 faceColor 가 있으면)", async () => {
    const meta = await readTemplateFromBytes(decodeBogoyangsikBytes());
    const { patch } = extractSettingsFromTemplate(meta, meta.rawHeaderXml);
    // 샘플의 헤더 셀에 배경색이 지정돼 있으면 추출됨. 없으면 undefined.
    // 어떤 경우든 크래시 없이 진행되어야 함.
    if (patch.tableHeaderBgColor) {
      expect(patch.tableHeaderBgColor).toMatch(/^#/);
    }
  });

  it("summary 는 디버그 로그 가능한 문자열들", async () => {
    const meta = await readTemplateFromBytes(decodeBogoyangsikBytes());
    const { summary } = extractSettingsFromTemplate(meta, meta.rawHeaderXml);
    for (const line of summary) {
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });
});
