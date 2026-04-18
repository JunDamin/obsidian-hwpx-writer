/**
 * 골든 비교를 위한 XML 정규화.
 *
 * 현재 HwpxDocument 직렬화는 결정론적이지만(ID가 삽입 순서로 매겨짐),
 * 줄바꿈·공백 정책이 바뀌면 diff가 폭발하므로 최소한의 정규화를 해 둔다.
 * 의미론적 동일성을 해치지 않는 선에서만 손본다.
 */
export function normalizeXml(xml: string): string {
  return (
    xml
      // CRLF → LF
      .replace(/\r\n/g, "\n")
      // 태그 사이 공백만 있는 경우 제거(레이아웃 잡음)
      .replace(/>\s+</g, "><")
      // 끝 공백 제거
      .replace(/\s+$/g, "")
      // 마지막 개행 통일
      + "\n"
  );
}
