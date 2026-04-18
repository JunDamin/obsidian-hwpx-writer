/**
 * Template-Aware Converter 통합 테스트.
 *
 * md2hwpx 번들 샘플을 템플릿으로 사용해 마크다운을 변환하고:
 *   - 결과 ZIP 이 템플릿의 header.xml 을 그대로 포함하는지
 *   - 생성된 문단이 템플릿의 placeholder 스타일 ID 를 참조하는지
 *   - 표 셀이 템플릿의 CELL_* 스타일을 참조하는지
 */
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readTemplateFromBytes } from "../src/converter/TemplateReader";
import { convertWithTemplate } from "../src/converter/TemplateAwareConverter";
import { decodeBogoyangsikBytes } from "../src/templates/bogoyangsikBundle";

async function convert(markdown: string) {
  const templateBytes = decodeBogoyangsikBytes();
  const meta = await readTemplateFromBytes(templateBytes);
  const outBytes = await convertWithTemplate(templateBytes, meta, markdown);
  const zip = await JSZip.loadAsync(outBytes);
  return {
    meta,
    outBytes,
    zip,
    section: await zip.file("Contents/section0.xml")!.async("string"),
    header: await zip.file("Contents/header.xml")!.async("string"),
    templateSection: await (await JSZip.loadAsync(templateBytes))
      .file("Contents/section0.xml")!.async("string"),
    templateHeader: await (await JSZip.loadAsync(templateBytes))
      .file("Contents/header.xml")!.async("string"),
  };
}

describe("convertWithTemplate — header.xml 보존", () => {
  it("출력의 header.xml 은 템플릿 원본과 동일", async () => {
    const { header, templateHeader } = await convert("# 제목\n\n본문.");
    expect(header).toBe(templateHeader);
  });
});

describe("convertWithTemplate — H1~H6 스타일 참조", () => {
  it("H1 문단은 템플릿 H1 placeholder 의 paraPrId/charPrId 사용", async () => {
    const { section, meta } = await convert("# 첫 제목\n\n본문.");
    const h1Ref = meta.placeholderStyles.paragraphs.get("H1")!;
    expect(h1Ref).toBeDefined();
    // "첫 제목" 텍스트가 있는 문단의 paraPrIDRef 와 그 run 의 charPrIDRef 확인
    const paraMatch = new RegExp(
      `<hp:p[^>]*paraPrIDRef="${h1Ref.paraPrId}"[^>]*>[\\s\\S]*?<hp:run[^>]*charPrIDRef="${h1Ref.charPrId}"[^>]*>\\s*<hp:t>첫 제목</hp:t>`,
    );
    expect(section).toMatch(paraMatch);
  });

  it("H3 문단은 H3 placeholder 스타일 사용", async () => {
    const { section, meta } = await convert("### H3 제목\n\n본문.");
    const h3 = meta.placeholderStyles.paragraphs.get("H3")!;
    expect(section).toMatch(
      new RegExp(`paraPrIDRef="${h3.paraPrId}"[^>]*>[\\s\\S]*?charPrIDRef="${h3.charPrId}"[^>]*>\\s*<hp:t>H3 제목</hp:t>`),
    );
  });

  it("일반 문단은 BODY placeholder 스타일 사용", async () => {
    const { section, meta } = await convert("평범한 본문 한 줄.");
    const body = meta.placeholderStyles.paragraphs.get("BODY")!;
    expect(section).toMatch(
      new RegExp(`paraPrIDRef="${body.paraPrId}"[^>]*>[\\s\\S]*?<hp:t>평범한 본문 한 줄\\.</hp:t>`),
    );
  });
});

describe("convertWithTemplate — 표 셀 스타일", () => {
  it("표 머리행은 CELL_HEADER_* 스타일 사용 (3행 이상 필요: header/top/middle/bottom)", async () => {
    // 4행 표: 헤더 1 + 본문 3 (top/middle/bottom)
    const md =
      "| A | B | C |\n" +
      "|---|---|---|\n" +
      "| t1 | t2 | t3 |\n" +
      "| m1 | m2 | m3 |\n" +
      "| b1 | b2 | b3 |";
    const { section, meta } = await convert(md);
    const headerLeft = meta.placeholderStyles.cells.get("HEADER_LEFT")!;
    const headerRight = meta.placeholderStyles.cells.get("HEADER_RIGHT")!;
    const middleCenter = meta.placeholderStyles.cells.get("MIDDLE_CENTER")!;
    expect(headerLeft).toBeDefined();
    expect(headerRight).toBeDefined();
    expect(middleCenter).toBeDefined();

    // A 셀은 HEADER_LEFT borderFillId
    expect(section).toMatch(
      new RegExp(`borderFillIDRef="${headerLeft.borderFillId}"[\\s\\S]*?<hp:t>A</hp:t>`),
    );
    // 중간 행 중간 셀 "m2" 는 MIDDLE_CENTER
    expect(section).toMatch(
      new RegExp(`borderFillIDRef="${middleCenter.borderFillId}"[\\s\\S]*?<hp:t>m2</hp:t>`),
    );
  });

  it("서로 다른 셀 위치가 다른 borderFillId 를 갖는다", async () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const { section, meta } = await convert(md);
    const headerLeft = meta.placeholderStyles.cells.get("HEADER_LEFT")!;
    const headerRight = meta.placeholderStyles.cells.get("HEADER_RIGHT")!;
    // 같은 값이 아니어야 의미 있음
    expect(headerLeft.borderFillId).not.toBe(headerRight.borderFillId);
    // A 와 B 가 실제로 각각의 ID 로 렌더
    expect(section).toMatch(new RegExp(`borderFillIDRef="${headerLeft.borderFillId}"[\\s\\S]*?<hp:t>A</hp:t>`));
    expect(section).toMatch(new RegExp(`borderFillIDRef="${headerRight.borderFillId}"[\\s\\S]*?<hp:t>B</hp:t>`));
  });
});

describe("convertWithTemplate — 리스트", () => {
  it("BULLET_1 placeholder 의 prefix 와 스타일이 리스트 아이템에 적용", async () => {
    const { section, meta } = await convert("- 첫 항목\n- 둘째 항목");
    const bullet1 = meta.placeholderStyles.lists.get("BULLET_1")!;
    expect(bullet1).toBeDefined();
    // 리스트 paraPr 가 적용됐는지
    expect(section).toMatch(new RegExp(`paraPrIDRef="${bullet1.paraPrId}"`));
    // 아이템 텍스트 존재
    expect(section).toContain("첫 항목");
    expect(section).toContain("둘째 항목");
  });

  it("중첩 리스트는 더 높은 레벨의 BULLET placeholder 사용", async () => {
    const md = "- 레벨 1\n  - 레벨 2";
    const { section, meta } = await convert(md);
    const b1 = meta.placeholderStyles.lists.get("BULLET_1");
    const b2 = meta.placeholderStyles.lists.get("BULLET_2");
    if (b1 && b2 && b1.paraPrId !== b2.paraPrId) {
      expect(section).toMatch(new RegExp(`paraPrIDRef="${b2.paraPrId}"`));
    }
  });
});

describe("convertWithTemplate — 결과 HWPX 유효성", () => {
  it("ZIP 구조 + mimetype 보존", async () => {
    const { zip } = await convert("# H1\n\n본문.");
    expect(await zip.file("mimetype")!.async("string")).toBe("application/hwp+zip");
    expect(zip.file("Contents/header.xml")).toBeDefined();
    expect(zip.file("Contents/section0.xml")).toBeDefined();
  });

  it("secPr 블록이 새 section0 에 보존됨", async () => {
    const { section } = await convert("본문");
    expect(section).toMatch(/<hp:secPr/);
    expect(section).toMatch(/<\/hp:secPr>/);
    expect(section).toMatch(/<hp:pagePr/);
  });
});
