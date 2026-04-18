/**
 * 골든 파일 테스트 — 현재 변환기 출력을 바이트 단위로 락인.
 *
 * 최초 실행 시 `test/__snapshots__/` 에 기대 파일이 없으면 자동 생성된다.
 * 이후 변경으로 XML이 달라지면 diff가 보이고, 의도된 변경이면
 * `UPDATE=true npm test` 로 갱신한다.
 *
 * 비교 대상: header.xml, section0.xml, Contents/content.hpf (있다면)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { convertAndExtract } from "./helpers/convert";
import { normalizeXml } from "./helpers/normalize";

const FIXTURES = join(__dirname, "fixtures");

// 비교할 XML 파일 목록. 경로가 없으면 스킵.
const INTERESTING = [
  "Contents/header.xml",
  "Contents/section0.xml",
  "Contents/content.hpf",
  "META-INF/container.xml",
  "META-INF/manifest.xml",
  "version.xml",
];

async function goldenAssert(fixtureName: string) {
  const md = readFileSync(join(FIXTURES, `${fixtureName}.md`), "utf-8");
  const doc = await convertAndExtract(md);

  for (const path of INTERESTING) {
    const content = doc.files.get(path);
    if (content === undefined) continue;
    const normalized = normalizeXml(content);
    await expect(normalized).toMatchFileSnapshot(
      join(__dirname, "__snapshots__", fixtureName, path),
    );
  }
}

describe("golden: basic markdown", () => {
  it("produces stable header.xml and section0.xml", async () => {
    await goldenAssert("basic");
  });
});

describe("golden: heading with pageBreakBefore at page start", () => {
  it("suppresses page break at document start", async () => {
    await goldenAssert("heading-with-pagebreak");
  });
});

describe("golden: GFM table", () => {
  it("produces stable table XML", async () => {
    await goldenAssert("table");
  });
});
