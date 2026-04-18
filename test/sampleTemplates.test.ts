/**
 * 샘플 템플릿 — md2hwpx 번들 보고양식이 포함되고 유효한 HWPX 인지 검증.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { createAllSampleTemplates, CURRENT_SAMPLE_VERSION } from "../src/templates/sampleTemplates";
import { parseHeaderXml } from "../src/converter/TemplateReader";

describe("sampleTemplates (v2: md2hwpx-only)", () => {
  it("produces md2hwpx 보고양식", async () => {
    const samples = await createAllSampleTemplates();
    expect(samples.length).toBeGreaterThanOrEqual(1);
    expect(samples.some(s => s.name.includes("md2hwpx"))).toBe(true);
  });

  it("번들 샘플은 유효한 ZIP 이며 mimetype 포함", async () => {
    for (const sample of await createAllSampleTemplates()) {
      expect(sample.bytes).toBeInstanceOf(Uint8Array);
      expect(sample.bytes.length).toBeGreaterThan(5000);
      const zip = await JSZip.loadAsync(sample.bytes);
      expect(zip.file("mimetype")).toBeDefined();
      expect(zip.file("Contents/header.xml")).toBeDefined();
      expect(zip.file("Contents/section0.xml")).toBeDefined();
    }
  });

  it("TemplateReader 로 폰트 파싱 가능", async () => {
    for (const sample of await createAllSampleTemplates()) {
      const zip = await JSZip.loadAsync(sample.bytes);
      const xml = await zip.file("Contents/header.xml")!.async("string");
      const meta = parseHeaderXml(xml);
      expect(meta.bodyFontHangul).not.toBeNull();
      expect(meta.hangulFonts.length).toBeGreaterThan(0);
    }
  });

  it("CURRENT_SAMPLE_VERSION 은 양수", () => {
    expect(CURRENT_SAMPLE_VERSION).toBeGreaterThan(0);
  });
});
