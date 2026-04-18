/**
 * 표 테두리 디자인 설정이 XML에 정확히 반영되는지 검증.
 *
 * 7개 구간(outerTop/outerBottom/outerLeft/outerRight/headerBottom/innerH/innerV) 각각의
 * {type, color, width} 를 독립 설정하면서 셀 위치별 borderFill 조합이 올바른지 확인.
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS, defaultBorderDesign, type HwpxWriterSettings, type BorderLineSpec, type TableBorderDesign } from "../src/settings";

function buildDesign(overrides: Partial<Record<keyof TableBorderDesign, Partial<BorderLineSpec>>>): TableBorderDesign {
  const d = defaultBorderDesign();
  for (const [k, v] of Object.entries(overrides) as [keyof TableBorderDesign, Partial<BorderLineSpec>][]) {
    d[k] = { ...d[k], ...v };
  }
  return d;
}

async function getDocs(md: string, design: TableBorderDesign): Promise<{ header: string; section: string }> {
  const settings: HwpxWriterSettings = { ...DEFAULT_SETTINGS, tableBorderDesign: design };
  const bytes = await convertMarkdownToHwpx(md, settings);
  const zip = await JSZip.loadAsync(bytes);
  return {
    header: await zip.file("Contents/header.xml")!.async("string"),
    section: await zip.file("Contents/section0.xml")!.async("string"),
  };
}

function extractBorderFill(headerXml: string, id: string): string | null {
  const re = new RegExp(`<hh:borderFill id="${id}"[\\s\\S]*?</hh:borderFill>`);
  return re.exec(headerXml)?.[0] ?? null;
}

/** 4면 중 몇 개가 type="NONE" 이 아닌지 (= 실제로 그려지는 선 수). */
function countVisibleSides(borderFillXml: string): number {
  const sides = ["leftBorder", "rightBorder", "topBorder", "bottomBorder"];
  let count = 0;
  for (const side of sides) {
    const m = new RegExp(`<hh:${side}[^/]*type="([^"]+)"`).exec(borderFillXml);
    if (m && m[1] !== "NONE") count++;
  }
  return count;
}

function sideType(borderFillXml: string, side: string): string | null {
  const m = new RegExp(`<hh:${side}[^/]*type="([^"]+)"`).exec(borderFillXml);
  return m?.[1] ?? null;
}
function sideColor(borderFillXml: string, side: string): string | null {
  const m = new RegExp(`<hh:${side}[^/]*color="([^"]+)"`).exec(borderFillXml);
  return m?.[1] ?? null;
}

const TABLE_MD =
  "| A | B |\n" +
  "|---|---|\n" +
  "| 1 | 2 |\n" +
  "| 3 | 4 |";

describe("TableBorderDesign: outer edges", () => {
  it("all outer borders NONE: corner (0,0) shows only inner sides", async () => {
    const design = buildDesign({
      outerTop: { type: "NONE" }, outerBottom: { type: "NONE" },
      outerLeft: { type: "NONE" }, outerRight: { type: "NONE" },
    });
    const { header, section } = await getDocs(TABLE_MD, design);
    const firstId = /<hp:tc[^>]*borderFillIDRef="(\d+)"/.exec(section)?.[1];
    const bf = extractBorderFill(header, firstId!)!;
    // top(NONE) + left(NONE) + right(innerV SOLID) + bottom(headerBottom SOLID) = 2
    expect(countVisibleSides(bf)).toBe(2);
  });

  it("only outerTop SOLID: corner (0,0) has top + bottom(headerBottom) + right(innerV) = 3 sides", async () => {
    const design = buildDesign({
      outerBottom: { type: "NONE" },
      outerLeft: { type: "NONE" },
      outerRight: { type: "NONE" },
    });
    const { header, section } = await getDocs(TABLE_MD, design);
    const firstId = /<hp:tc[^>]*borderFillIDRef="(\d+)"/.exec(section)?.[1];
    const bf = extractBorderFill(header, firstId!)!;
    expect(countVisibleSides(bf)).toBe(3);
    expect(sideType(bf, "topBorder")).toBe("SOLID");
  });
});

describe("TableBorderDesign: per-segment color and type", () => {
  it("different color for each outer segment is preserved in output", async () => {
    const design = buildDesign({
      outerTop:    { color: "#FF0000" },
      outerBottom: { color: "#00FF00" },
      outerLeft:   { color: "#0000FF" },
      outerRight:  { color: "#FFFF00" },
    });
    const { header, section } = await getDocs(TABLE_MD, design);

    // 좌상단 코너 — top/left 는 각자 색
    const firstId = /<hp:tc[^>]*borderFillIDRef="(\d+)"/.exec(section)?.[1];
    const bf = extractBorderFill(header, firstId!)!;
    expect(sideColor(bf, "topBorder")).toBe("#FF0000");
    expect(sideColor(bf, "leftBorder")).toBe("#0000FF");
  });

  it("headerBottom with DOUBLE type is applied only between header and body", async () => {
    const design = buildDesign({
      headerBottom: { type: "DOUBLE", color: "#333333" },
    });
    const { header, section } = await getDocs(TABLE_MD, design);

    // 섹션의 첫 셀(헤더 r=0,c=0) 의 bottomBorder 가 DOUBLE
    const firstId = /<hp:tc[^>]*borderFillIDRef="(\d+)"/.exec(section)?.[1];
    const bf = extractBorderFill(header, firstId!)!;
    expect(sideType(bf, "bottomBorder")).toBe("DOUBLE");
  });

  it("innerH DASH vs innerV DOT: middle body cell has both", async () => {
    // 3x3 table for 중간 셀 확보
    const md3 = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n| 7 | 8 | 9 |";
    const design = buildDesign({
      innerH: { type: "DASH" },
      innerV: { type: "DOT" },
    });
    const { header, section } = await getDocs(md3, design);

    // 모든 셀의 borderFillIDRef 수집
    const ids = [...section.matchAll(/<hp:tc[^>]*borderFillIDRef="(\d+)"/g)].map(m => m[1]);
    // 고유한 borderFill 중 하나는 "4면 모두 내부" (r=중간, c=중간) 를 나타내야 함
    const uniqueIds = new Set(ids);
    let foundPureInner = false;
    for (const id of uniqueIds) {
      const bf = extractBorderFill(header, id);
      if (!bf) continue;
      const t = sideType(bf, "topBorder");
      const b = sideType(bf, "bottomBorder");
      const l = sideType(bf, "leftBorder");
      const r = sideType(bf, "rightBorder");
      // 완전 내부 셀: top/bottom 은 innerH(DASH), left/right 는 innerV(DOT)
      if (t === "DASH" && b === "DASH" && l === "DOT" && r === "DOT") {
        foundPureInner = true;
      }
    }
    expect(foundPureInner).toBe(true);
  });
});

describe("TableBorderDesign: migration from legacy flat fields", () => {
  it("old flat tableBorderOuterTop=false migrates to outerTop.type=NONE", async () => {
    // 설정 마이그레이션은 main.ts 의 loadSettings 에서 호출되므로
    // 직접 migrateLegacySettings 를 호출해서 확인
    const { migrateLegacySettings } = await import("../src/settings");
    const migrated = migrateLegacySettings({
      tableBorderStyle: "DASH",
      tableBorderColor: "#FF00FF",
      tableBorderWidth: "0.5 mm",
      tableBorderOuterTop: false,
      tableBorderInnerH: true,
      tableBorderInnerV: true,
    });
    expect(migrated.tableBorderDesign?.outerTop.type).toBe("NONE");
    expect(migrated.tableBorderDesign?.outerBottom.type).toBe("DASH");
    expect(migrated.tableBorderDesign?.outerBottom.color).toBe("#FF00FF");
    expect(migrated.tableBorderDesign?.outerBottom.width).toBe("0.5 mm");
  });

  it("new tableBorderDesign is preserved when already present", async () => {
    const { migrateLegacySettings } = await import("../src/settings");
    const existing = {
      tableBorderDesign: {
        outerTop: { type: "DOUBLE", color: "#123456", width: "1 mm" },
        // 나머지 누락 → 기본값으로 병합되어야 함
      },
    };
    const migrated = migrateLegacySettings(existing);
    expect(migrated.tableBorderDesign?.outerTop.type).toBe("DOUBLE");
    expect(migrated.tableBorderDesign?.outerTop.color).toBe("#123456");
    expect(migrated.tableBorderDesign?.innerH.type).toBe("SOLID"); // 기본
  });
});
