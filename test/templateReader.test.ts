/**
 * TemplateReader 파싱 단위 테스트.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { parseHeaderXml, readTemplate } from "../src/converter/TemplateReader";

const SAMPLE = "C:/Users/freed/Documents/python_projects/042_hwpx_writer/samples/브라더 공공기관 보고서 양식.hwpx";

describe("TemplateReader.parseHeaderXml", () => {
  it("extracts fonts from well-formed header.xml snippet", () => {
    const xml = `<hh:head>
      <hh:refList>
        <hh:fontfaces itemCnt="7">
          <hh:fontface lang="HANGUL" fontCnt="2">
            <hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/>
            <hh:font id="1" face="맑은 고딕" type="TTF" isEmbedded="0"/>
          </hh:fontface>
          <hh:fontface lang="LATIN" fontCnt="1">
            <hh:font id="0" face="Times New Roman" type="TTF" isEmbedded="0"/>
          </hh:fontface>
        </hh:fontfaces>
        <hh:styles itemCnt="2">
          <hh:style id="0" type="PARA" name="바탕글" engName="Normal"/>
          <hh:style id="1" type="PARA" name="본문" engName="Body"/>
        </hh:styles>
      </hh:refList>
    </hh:head>`;

    const meta = parseHeaderXml(xml);
    expect(meta.hangulFonts).toEqual(["함초롬바탕", "맑은 고딕"]);
    expect(meta.latinFonts).toEqual(["Times New Roman"]);
    expect(meta.bodyFontHangul).toBe("함초롬바탕");
    expect(meta.bodyFontLatin).toBe("Times New Roman");
    expect(meta.styleNames).toEqual(["바탕글", "본문"]);
  });

  it("ignores hh:substFont inside hh:font (no id attribute)", () => {
    // 실제 한컴 샘플에서 발견되는 패턴 — substFont 의 face 가 잘못 잡히면 안 됨
    const xml = `<hh:fontface lang="HANGUL" fontCnt="1">
      <hh:font id="0" face="-아이리스M" type="TTF" isEmbedded="0">
        <hh:substFont face="한컴바탕" type="TTF" isEmbedded="0" binaryItemIDRef=""/>
      </hh:font>
    </hh:fontface>`;

    const meta = parseHeaderXml(xml);
    expect(meta.hangulFonts).toEqual(["-아이리스M"]);
  });

  it("returns empty metadata for malformed XML", () => {
    const meta = parseHeaderXml("<not><valid></wrong>");
    expect(meta.bodyFontHangul).toBeNull();
    expect(meta.hangulFonts).toEqual([]);
    expect(meta.styleNames).toEqual([]);
  });
});

describe("TemplateReader.readTemplate (integration with real sample)", () => {
  it("parses real Hancom sample template", async () => {
    const meta = await readTemplate(SAMPLE);
    // 샘플이 실제로 쓰는 첫 폰트는 "함초롬돋움"
    expect(meta.bodyFontHangul).toBe("함초롬돋움");
    expect(meta.hangulFonts.length).toBeGreaterThan(0);
    // 한컴 표준 스타일이 포함되어야 함
    expect(meta.styleNames).toContain("바탕글");
  });

  it("returns empty metadata for missing file", async () => {
    const meta = await readTemplate("/nonexistent/path/to/nothing.hwpx");
    expect(meta.bodyFontHangul).toBeNull();
  });
});
