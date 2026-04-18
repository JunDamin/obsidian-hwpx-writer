/**
 * 템플릿 통합 테스트 (new model).
 *
 * 새 모델: 템플릿은 사용자 settings 에 스타일을 "복사" 한다.
 * 변환기는 templatePath 를 무시하고 settings 만 사용.
 *
 * 따라서 테스트 흐름:
 *   1. readTemplate → meta
 *   2. extractSettingsFromTemplate(meta, meta.rawHeaderXml) → patch
 *   3. Object.assign(settings, patch) — settings 가 템플릿 값으로 덮인다
 *   4. convertMarkdownToHwpx(md, settings) → 출력에 템플릿 값이 반영됨
 */
import { describe, it, expect } from "vitest";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { readTemplate } from "../src/converter/TemplateReader";
import { extractSettingsFromTemplate } from "../src/converter/extractSettingsFromTemplate";
import { DEFAULT_SETTINGS } from "../src/settings";
import JSZip from "jszip";

const SAMPLE = "C:/Users/freed/Documents/python_projects/042_hwpx_writer/samples/브라더 공공기관 보고서 양식.hwpx";

async function buildAndReadHeader(md: string, settings = DEFAULT_SETTINGS): Promise<string> {
  const bytes = await convertMarkdownToHwpx(md, settings);
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("Contents/header.xml");
  if (!entry) throw new Error("no header.xml");
  return entry.async("string");
}

describe("Template → settings 복사 모델", () => {
  const md = "# 제목\n\n본문.";

  it("기본 설정만 사용: 맑은 고딕", async () => {
    const header = await buildAndReadHeader(md);
    expect(header).toMatch(/<hh:fontface lang="HANGUL"[^>]*>[\s\S]*?<hh:font id="0" face="맑은 고딕"/);
  });

  it("템플릿을 settings 에 복사 후 변환하면 템플릿 폰트가 반영됨", async () => {
    const meta = await readTemplate(SAMPLE);
    const { patch } = extractSettingsFromTemplate(meta, meta.rawHeaderXml);
    const settings = { ...DEFAULT_SETTINGS, ...patch };
    // 템플릿의 BODY 실제 폰트 (맑은 고딕이 아님 — 무슨 폰트든 바뀌어야 함)
    expect(settings.fontHangul).toBeDefined();
    expect(settings.fontHangul).not.toBe("맑은 고딕");
    // 출력 XML 에도 그 폰트가 등장
    const header = await buildAndReadHeader(md, settings);
    expect(header).toContain(`face="${settings.fontHangul}"`);
  });

  it("templatePath 파라미터를 넘겨도 converter 는 무시 (settings 만 사용)", async () => {
    // 기본 settings + templatePath — 변환기는 settings 만 씀
    const bytes = await convertMarkdownToHwpx(md, DEFAULT_SETTINGS, { templatePath: SAMPLE });
    const zip = await JSZip.loadAsync(bytes);
    const header = await zip.file("Contents/header.xml")!.async("string");
    // settings 의 fontHangul (맑은 고딕) 이 사용됨 — 템플릿 폰트가 아님
    expect(header).toMatch(/<hh:font id="0" face="맑은 고딕"/);
  });
});
