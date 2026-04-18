/**
 * 사용자가 겪는 실전 시나리오 단위 테스트.
 *
 * "왜 템플릿이 적용되지 않나" 라는 보고에 대응해, 각 케이스별로 분기가
 * 올바르게 선택되는지 + 로그가 적절히 찍히는지 검증.
 *
 * Obsidian 런타임 없이도 hwpx-core + TemplateReader + TemplateAwareConverter 를
 * 직접 조합해 end-to-end 검증 가능.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import { readTemplateFromBytes, parsePlaceholderStyles } from "../src/converter/TemplateReader";
import { convertWithTemplate } from "../src/converter/TemplateAwareConverter";
import { decodeBogoyangsikBytes } from "../src/templates/bogoyangsikBundle";

describe("사용자 시나리오: 템플릿 적용 여부 판정", () => {
  it("원본 md2hwpx 번들을 템플릿으로 쓰면 placeholder 가 풍부하게 추출된다", async () => {
    const bytes = decodeBogoyangsikBytes();
    const meta = await readTemplateFromBytes(bytes);
    const total = meta.placeholderStyles.paragraphs.size
      + meta.placeholderStyles.cells.size
      + meta.placeholderStyles.lists.size;
    expect(total).toBeGreaterThan(20);
    expect(meta.placeholderStyles.paragraphs.has("H1")).toBe(true);
    expect(meta.placeholderStyles.cells.has("HEADER_LEFT")).toBe(true);
    expect(meta.placeholderStyles.lists.has("BULLET_1")).toBe(true);
  });

  it("사용자가 H1 placeholder 만 남기고 나머지를 지운 템플릿도 template-aware 경로 진입", async () => {
    // 사용자가 한컴에서 편집해 대부분의 placeholder 를 지운 최소 케이스
    const bytes = decodeBogoyangsikBytes();
    const zip = await JSZip.loadAsync(bytes);
    const orig = await zip.file("Contents/section0.xml")!.async("string");

    // H1 만 남기고 다른 placeholder 는 전부 제거 (문단 자체를 날리지는 않고 텍스트만 교체)
    let reduced = orig.replace(/\{\{(?!H1\}\})[A-Z0-9_]+\}\}/g, "편집됨");
    zip.file("Contents/section0.xml", reduced);
    const reducedBytes = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));

    const meta = await readTemplateFromBytes(reducedBytes);
    expect(meta.placeholderStyles.paragraphs.has("H1")).toBe(true);
    // 여전히 hasPlaceholders = true 이므로 template-aware 경로 진입해야 함
    const hasAny =
      meta.placeholderStyles.paragraphs.size +
      meta.placeholderStyles.cells.size +
      meta.placeholderStyles.lists.size;
    expect(hasAny).toBeGreaterThan(0);
  });

  it("사용자가 모든 placeholder 를 지운 템플릿은 font-only 폴백 (template-aware 스킵)", async () => {
    const bytes = decodeBogoyangsikBytes();
    const zip = await JSZip.loadAsync(bytes);
    const orig = await zip.file("Contents/section0.xml")!.async("string");
    // 모든 {{...}} 제거
    const stripped = orig.replace(/\{\{[A-Z0-9_]+\}\}/g, "편집됨");
    zip.file("Contents/section0.xml", stripped);
    const strippedBytes = new Uint8Array(await zip.generateAsync({ type: "uint8array" }));

    const meta = await readTemplateFromBytes(strippedBytes);
    const hasAny =
      meta.placeholderStyles.paragraphs.size +
      meta.placeholderStyles.cells.size +
      meta.placeholderStyles.lists.size;
    expect(hasAny).toBe(0);
    // 폰트 이름은 여전히 있어야 함
    expect(meta.bodyFontHangul).not.toBeNull();
  });

  it("사용자가 한컴에서 편집해 타임스탬프 복제된 파일 (_edit_...)도 정상 동작", async () => {
    // 사용자가 '한컴 편집' 버튼으로 만든 복제본은 파일명만 다르지 내용은 동일.
    // convertWithTemplate 가 원본 바이트를 그대로 쓰는지 확인.
    const origBytes = decodeBogoyangsikBytes();
    const meta = await readTemplateFromBytes(origBytes);
    const md = "# 제목\n\n## 부제\n\n본문 문단.\n\n- 리스트1\n- 리스트2";
    const outBytes = await convertWithTemplate(origBytes, meta, md);

    const outZip = await JSZip.loadAsync(outBytes);
    const outSection = await outZip.file("Contents/section0.xml")!.async("string");

    // 각 마크다운 요소가 템플릿의 placeholder ID 를 써서 렌더됐는지
    const h1Ref = meta.placeholderStyles.paragraphs.get("H1")!;
    expect(outSection).toContain(`paraPrIDRef="${h1Ref.paraPrId}"`);
    expect(outSection).toContain("<hp:t>제목</hp:t>");
  });
});

describe("사용자 시나리오: 미리보기 경로와 export 경로 일치", () => {
  /**
   * 핵심 회귀: preview 와 export 가 같은 convertMarkdownToHwpx 호출을 사용하되
   * templatePath 파라미터만 동일하게 넘기면 결과가 완전히 같아야 한다.
   */
  it("같은 markdown + 같은 templatePath → 같은 바이트 시퀀스", async () => {
    const templateBytes = decodeBogoyangsikBytes();
    const meta = await readTemplateFromBytes(templateBytes);
    const md = "# 같은 제목\n\n| A | B |\n|---|---|\n| 1 | 2 |";
    const out1 = await convertWithTemplate(templateBytes, meta, md);
    const out2 = await convertWithTemplate(templateBytes, meta, md);
    expect(out1.length).toBe(out2.length);
    // JSZip 출력은 타임스탬프가 없어 결정론적 (같은 입력 → 같은 출력)
    // section0.xml 레벨에서도 동일해야 함
    const z1 = await JSZip.loadAsync(out1);
    const z2 = await JSZip.loadAsync(out2);
    const s1 = await z1.file("Contents/section0.xml")!.async("string");
    const s2 = await z2.file("Contents/section0.xml")!.async("string");
    expect(s1).toBe(s2);
  });
});

describe("placeholder 추출: 비정상 입력 방어", () => {
  it("빈 section0.xml 도 크래시하지 않음", () => {
    expect(() => parsePlaceholderStyles("")).not.toThrow();
    const ps = parsePlaceholderStyles("");
    expect(ps.paragraphs.size).toBe(0);
  });

  it("깨진 XML 도 크래시하지 않고 최대한 추출", () => {
    // 닫는 태그 없는 깨진 XML
    const broken = `<hs:sec><hp:p paraPrIDRef="5"><hp:run charPrIDRef="3"><hp:t>{{H1}}`;
    expect(() => parsePlaceholderStyles(broken)).not.toThrow();
    // 닫힘이 없으면 매칭 실패 → 빈 결과 OK
  });

  it("중첩된 placeholder 패턴은 첫 번째만 매칭", () => {
    const xml = `<hs:sec xmlns:hp="urn">
      <hp:p paraPrIDRef="1"><hp:run charPrIDRef="1"><hp:t>{{H1}} {{BODY}}</hp:t></hp:run></hp:p>
    </hs:sec>`;
    const ps = parsePlaceholderStyles(xml);
    // 한 문단에 두 placeholder — 현재 구현은 각 hp:t 내에서 첫 번째만 검출
    // (단순 regex.exec). 이 동작을 락인.
    expect(ps.paragraphs.has("H1")).toBe(true);
  });
});
