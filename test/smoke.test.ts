import { describe, it, expect } from "vitest";
import { pt, mm } from "../src/hwpx-core/index";
import { convertMarkdownToHwpx } from "../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS } from "../src/settings";

describe("smoke", () => {
  it("hwpx-core unit helpers load", () => {
    expect(pt(10)).toBe(1000);
    expect(mm(1)).toBeGreaterThan(0);
  });

  it("converter loads and produces bytes", async () => {
    const bytes = await convertMarkdownToHwpx("# Hello\n\nWorld.", DEFAULT_SETTINGS);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // ZIP 매직 넘버
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });
});
