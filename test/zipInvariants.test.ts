/**
 * ZIP 불변식 — CLAUDE.md 에서 "반드시" 규칙으로 명시된 것들:
 *   - mimetype 은 첫 번째 엔트리
 *   - mimetype 은 STORED(무압축)
 *   - mimetype 내용은 정확히 "application/hwp+zip"
 *   - version.xml 은 STORED
 *   - BinData/* 는 STORED (바이너리 리소스가 있을 때만 검사)
 */
import { describe, it, expect } from "vitest";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS } from "../src/settings";
import { parseZipEntries } from "./helpers/zipParser";

async function build(md: string): Promise<Uint8Array> {
  return convertMarkdownToHwpx(md, DEFAULT_SETTINGS);
}

describe("ZIP invariants", () => {
  it("mimetype is first entry, STORED, with exact content", async () => {
    const bytes = await build("# Test\n\n본문.");
    const entries = parseZipEntries(bytes);
    expect(entries.length).toBeGreaterThan(0);

    const first = entries[0];
    expect(first.name).toBe("mimetype");
    expect(first.method).toBe("STORE");

    // STORED 이므로 compressedSize == uncompressedSize, 그리고 내용이 정확해야 함.
    const MIMETYPE = "application/hwp+zip";
    expect(first.uncompressedSize).toBe(MIMETYPE.length);
    // 데이터는 Local File Header 바로 뒤부터 compressedSize 만큼
    const dataStart = first.offset + 30 + MIMETYPE.length; // nameLen == "mimetype".length == 8, 하지만 name과 mimetype 내용 길이는 다르다
    // 다시 정확히 계산: 30 + nameLen + extraLen
    // 헬퍼에서 offset만 주므로 바이트 직접 읽기로.
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const nameLen = dv.getUint16(first.offset + 26, true);
    const extraLen = dv.getUint16(first.offset + 28, true);
    const dataOffset = first.offset + 30 + nameLen + extraLen;
    const content = new TextDecoder().decode(
      bytes.subarray(dataOffset, dataOffset + first.compressedSize),
    );
    expect(content).toBe(MIMETYPE);
  });

  it("version.xml is STORED", async () => {
    const bytes = await build("# Test");
    const entries = parseZipEntries(bytes);
    const v = entries.find(e => e.name === "version.xml");
    expect(v, "version.xml entry must exist").toBeDefined();
    expect(v!.method).toBe("STORE");
  });

  it("all BinData/* entries are STORED (when present)", async () => {
    const bytes = await build("# Test");
    const entries = parseZipEntries(bytes);
    const bin = entries.filter(e => e.name.startsWith("BinData/"));
    // 현재 테스트 픽스처엔 바이너리 리소스가 없어도 되지만,
    // 있다면 반드시 STORED.
    for (const e of bin) {
      expect(e.method, `${e.name} must be STORED`).toBe("STORE");
    }
  });

  it("every entry is either STORE or DEFLATE (no unsupported methods)", async () => {
    const bytes = await build("# Test\n\n내용");
    const entries = parseZipEntries(bytes);
    for (const e of entries) {
      expect(e.method, `${e.name} uses unsupported compression`).not.toBe("OTHER");
    }
  });
});
