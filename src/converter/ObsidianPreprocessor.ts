/**
 * Obsidian 전용 Markdown 문법 → 표준 Markdown 변환.
 *
 * marked 가 이해하지 못하는 Obsidian 확장을 사전에 치환해 marked 에 넘긴다.
 * 이렇게 하면 테스트 환경(Node)에서 Obsidian 없이도 파싱·변환 가능하다.
 *
 * 변환 대상 (현재):
 *   - `[[위키링크]]`           → `[위키링크](위키링크)`
 *   - `[[target|alias]]`        → `[alias](target)`
 *   - `[[target#heading]]`      → `[target#heading](target#heading)`
 *   - `![[embed.md]]`           → `[embed.md](embed.md)` (임베드를 링크로 저하 처리)
 *   - `> [!NOTE] 콜아웃`        → `> **NOTE**: 콜아웃`
 *   - `==하이라이트==`          → `**하이라이트**` (marked 가 해석 못하는 GFM 확장)
 *
 * 변환하지 않는 것 (원문 그대로 — 나중 확장 여지):
 *   - `#태그` — 노트 내에서 특별한 스타일 없이 그대로 텍스트
 *   - `^blockid` — 블록 참조 식별자, 그대로 둠
 *   - dataview 쿼리 블록 — 그대로 둠 (코드블록으로 인식됨)
 */

/** Obsidian 문법을 표준 markdown 으로 치환한 새 문자열 반환. 원본은 변경하지 않음. */
export function preprocessObsidianSyntax(md: string): string {
  // 1) 임베드/링크 위키링크 (![[...]] / [[...]])
  //    캡처 그룹: target | alias (둘 다 optional)
  md = md.replace(
    /(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (_full, bang, target, heading, alias) => {
      const href = heading ? `${target}#${heading}` : target;
      const label = alias || (heading ? `${target} > ${heading}` : target);
      // 임베드(!) 는 지금은 링크로 저하 처리 — 향후 이미지/문서 삽입으로 확장 가능
      void bang;
      return `[${label}](${href})`;
    },
  );

  // 2) 콜아웃 — `> [!TYPE] 제목\n> 본문`
  //    marked 는 blockquote 를 이해하므로 첫 줄만 형식 변환
  md = md.replace(
    /^(>\s*)\[!(\w+)\](?:\s+(.*))?$/gm,
    (_full, prefix, type, rest) => {
      const body = rest ? ` ${rest}` : "";
      return `${prefix}**${type.toUpperCase()}**:${body}`;
    },
  );

  // 3) 하이라이트 ==text== → **text** (굵게로 근사)
  //    note: marked 에는 이에 해당하는 기본 스타일이 없다.
  md = md.replace(/==([^=\n]+)==/g, "**$1**");

  return md;
}
