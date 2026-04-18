import JSZip from "jszip";
import { convertMarkdownToHwpx } from "../../src/converter/MarkdownToHwpx";
import { DEFAULT_SETTINGS, type HwpxWriterSettings } from "../../src/settings";

export interface ExtractedDocument {
  bytes: Uint8Array;
  files: Map<string, string>; // path -> text content (XML only)
  entries: Array<{ name: string; compression: "STORE" | "DEFLATE"; size: number }>;
  rawEntryOrder: string[]; // ZIP 내 엔트리 순서
}

/**
 * 변환 후 ZIP을 풀어 XML 내용을 돌려준다. 골든 비교용.
 * 테스트 재현성을 위해 settings 오버라이드 허용.
 */
export async function convertAndExtract(
  markdown: string,
  settingsOverride: Partial<HwpxWriterSettings> = {},
): Promise<ExtractedDocument> {
  const settings: HwpxWriterSettings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  const bytes = await convertMarkdownToHwpx(markdown, settings);
  const zip = await JSZip.loadAsync(bytes);

  const files = new Map<string, string>();
  const entries: ExtractedDocument["entries"] = [];
  const rawEntryOrder: string[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    rawEntryOrder.push(path);
    if (entry.dir) continue;
    // XML / 텍스트 추출
    const isText = path.endsWith(".xml") || path === "mimetype" || path === "version.xml";
    if (isText) {
      files.set(path, await entry.async("string"));
    }
    // entry 원본 메타데이터. JSZip은 compression 정보를 직접 드러내지 않으므로
    // 대신 바이트를 다시 읽어 Central Directory에서 알아낸 것과 일치시킨다(zipInvariants에서 별도 검사).
    entries.push({
      name: path,
      compression: "DEFLATE", // placeholder — zipInvariants에서 실제 검사
      size: (await entry.async("uint8array")).length,
    });
  }

  return { bytes, files, entries, rawEntryOrder };
}
