/**
 * 최소 ZIP 파서 — entry 순서·압축 방식 검증을 위해 raw 바이트를 훑는다.
 * 일반 라이브러리는 "논리적" 엔트리만 내주고 ZIP 특유의 순서·STORED/DEFLATE 여부를 잃어버림.
 *
 * 참고: PKZIP APPNOTE.TXT
 *   Local file header signature: 0x04034b50
 *   Central dir signature:       0x02014b50
 *   End of central dir:          0x06054b50
 */

export interface LocalEntry {
  name: string;
  method: "STORE" | "DEFLATE" | "OTHER";
  compressedSize: number;
  uncompressedSize: number;
  offset: number; // Local File Header 시작 위치
}

export function parseZipEntries(bytes: Uint8Array): LocalEntry[] {
  const entries: LocalEntry[] = [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;

  while (i + 4 <= bytes.length) {
    const sig = dv.getUint32(i, true);
    if (sig !== 0x04034b50) break; // Local File Header 연속 영역을 벗어남

    // Local File Header: 30 바이트 고정 + 파일명 + extra
    const method = dv.getUint16(i + 8, true);
    const compressedSize = dv.getUint32(i + 18, true);
    const uncompressedSize = dv.getUint32(i + 22, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extraLen = dv.getUint16(i + 28, true);
    const nameBytes = bytes.subarray(i + 30, i + 30 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);

    entries.push({
      name,
      method: method === 0 ? "STORE" : method === 8 ? "DEFLATE" : "OTHER",
      compressedSize,
      uncompressedSize,
      offset: i,
    });

    // 다음 엔트리로 점프: header + name + extra + data
    i += 30 + nameLen + extraLen + compressedSize;
  }

  return entries;
}
