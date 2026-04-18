/**
 * TemplateReader 의 placeholder 스타일 추출 검증.
 * md2hwpx 번들 샘플을 실제로 파싱해 모든 H1~H9, CELL_*, LIST_*, BODY, CODE, LINK 추출.
 */
import { describe, it, expect } from "vitest";
import { readTemplateFromBytes, parsePlaceholderStyles } from "../src/converter/TemplateReader";
import { decodeBogoyangsikBytes } from "../src/templates/bogoyangsikBundle";

describe("parsePlaceholderStyles", () => {
  it("extracts paragraph placeholders with distinct style IDs", () => {
    const xml = `<?xml version="1.0"?><hs:sec xmlns:hp="urn">
      <hp:p paraPrIDRef="32" styleIDRef="0"><hp:run charPrIDRef="22"><hp:t>{{H1}}</hp:t></hp:run></hp:p>
      <hp:p paraPrIDRef="34" styleIDRef="16"><hp:run charPrIDRef="26"><hp:t>{{H2}}</hp:t></hp:run></hp:p>
      <hp:p paraPrIDRef="10" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>{{BODY}}</hp:t></hp:run></hp:p>
    </hs:sec>`;

    const ps = parsePlaceholderStyles(xml);
    expect(ps.paragraphs.get("H1")).toEqual({ paraPrId: 32, charPrId: 22, styleId: 0 });
    expect(ps.paragraphs.get("H2")).toEqual({ paraPrId: 34, charPrId: 26, styleId: 16 });
    expect(ps.paragraphs.get("BODY")).toEqual({ paraPrId: 10, charPrId: 0, styleId: 0 });
  });

  it("extracts prefix text from preceding runs in list placeholder", () => {
    const xml = `<hs:sec xmlns:hp="urn">
      <hp:p paraPrIDRef="5" styleIDRef="0">
        <hp:run charPrIDRef="3"><hp:t>● </hp:t></hp:run>
        <hp:run charPrIDRef="4"><hp:t>{{LIST_BULLET_1}}</hp:t></hp:run>
      </hp:p>
    </hs:sec>`;

    const ps = parsePlaceholderStyles(xml);
    const bullet = ps.lists.get("BULLET_1");
    expect(bullet).toBeDefined();
    expect(bullet!.paraPrId).toBe(5);
    expect(bullet!.charPrId).toBe(4);
    expect(bullet!.prefix).toBe("● ");
  });

  it("extracts cell placeholders with borderFill and margins", () => {
    const xml = `<hs:sec xmlns:hp="urn">
      <hp:tbl>
        <hp:tc borderFillIDRef="5">
          <hp:p paraPrIDRef="7" styleIDRef="0">
            <hp:run charPrIDRef="8"><hp:t>{{CELL_HEADER_LEFT}}</hp:t></hp:run>
          </hp:p>
          <hp:cellMargin left="567" right="567" top="283" bottom="283"/>
        </hp:tc>
      </hp:tbl>
    </hs:sec>`;

    const ps = parsePlaceholderStyles(xml);
    const cell = ps.cells.get("HEADER_LEFT");
    expect(cell).toBeDefined();
    expect(cell!.borderFillId).toBe(5);
    expect(cell!.charPrId).toBe(8);
    expect(cell!.paraPrId).toBe(7);
    expect(cell!.marginLeft).toBe(567);
    expect(cell!.marginTop).toBe(283);
  });
});

describe("readTemplateFromBytes — md2hwpx 번들 샘플", () => {
  it("파싱 성공 + 모든 placeholder 카테고리 추출", async () => {
    const meta = await readTemplateFromBytes(decodeBogoyangsikBytes());

    expect(meta.bodyFontHangul).toBeTruthy();
    expect(meta.rawSectionXml.length).toBeGreaterThan(1000);

    // 문단: H1~H9 + BODY + CODE + LINK
    const p = meta.placeholderStyles.paragraphs;
    for (let i = 1; i <= 9; i++) {
      expect(p.has(`H${i}`), `H${i} missing`).toBe(true);
    }
    expect(p.has("BODY")).toBe(true);
    expect(p.has("CODE")).toBe(true);
    expect(p.has("LINK")).toBe(true);

    // 셀: HEADER_{LEFT,CENTER,RIGHT} + TOP/MIDDLE/BOTTOM_{LEFT,CENTER,RIGHT} = 12
    const c = meta.placeholderStyles.cells;
    for (const row of ["HEADER", "TOP", "MIDDLE", "BOTTOM"]) {
      for (const col of ["LEFT", "CENTER", "RIGHT"]) {
        expect(c.has(`${row}_${col}`), `CELL_${row}_${col} missing`).toBe(true);
      }
    }

    // 리스트: BULLET_1~7, ORDERED_1~7
    const l = meta.placeholderStyles.lists;
    for (let i = 1; i <= 7; i++) {
      expect(l.has(`BULLET_${i}`), `BULLET_${i} missing`).toBe(true);
      expect(l.has(`ORDERED_${i}`), `ORDERED_${i} missing`).toBe(true);
    }
  });

  it("H1 과 H2 는 서로 다른 paraPrId/charPrId 를 가진다", async () => {
    const meta = await readTemplateFromBytes(decodeBogoyangsikBytes());
    const h1 = meta.placeholderStyles.paragraphs.get("H1")!;
    const h2 = meta.placeholderStyles.paragraphs.get("H2")!;
    expect(h1.paraPrId).not.toBe(h2.paraPrId);
  });

  it("CELL_HEADER_LEFT 와 CELL_MIDDLE_LEFT 는 다른 borderFillId 를 가진다", async () => {
    const meta = await readTemplateFromBytes(decodeBogoyangsikBytes());
    const header = meta.placeholderStyles.cells.get("HEADER_LEFT")!;
    const middle = meta.placeholderStyles.cells.get("MIDDLE_LEFT")!;
    // 머리행과 본문 셀은 배경색이 달라 다른 borderFill ID
    expect(header.borderFillId).not.toBe(middle.borderFillId);
  });
});
