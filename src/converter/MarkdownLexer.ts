/**
 * Markdown 토큰화 — marked v18 lexer 위에 두 가지 커스텀 블록 확장을 올린다.
 *
 * 1. `$$ ... $$` → `mathBlock` 토큰 (LaTeX 수식)
 * 2. YAML frontmatter 는 이 레벨에서 처리하지 않음 (MarkdownToHwpx 가 사전 제거)
 *
 * 반환 토큰 타입은 marked의 표준 Token 에 커스텀 2개를 유니온.
 */

import { marked, type Token, type TokensList } from "marked";

export interface MathBlockToken {
  type: "mathBlock";
  raw: string;
  latex: string;
}

/** marked 를 한 번만 구성 — 모듈 로드 시 1회 호출 */
let configured = false;
function configureMarked(): void {
  if (configured) return;
  configured = true;

  marked.use({
    extensions: [
      {
        name: "mathBlock",
        level: "block",
        start(src: string) {
          const m = /(^|\n)\$\$/.exec(src);
          return m?.index;
        },
        tokenizer(src: string) {
          const m = /^\$\$([\s\S]*?)\$\$\s*(?:\n|$)/.exec(src);
          if (!m) return undefined;
          const token: MathBlockToken = {
            type: "mathBlock",
            raw: m[0],
            latex: m[1].trim(),
          };
          return token as unknown as Token;
        },
      },
    ],
  });
}

/** Markdown 전체를 토큰 트리로 변환. GFM(표, 취소선) 활성. */
export function lexMarkdown(markdown: string): TokensList {
  configureMarked();
  return marked.lexer(markdown, { gfm: true, breaks: false });
}

/** 인라인 marker 가 있는 텍스트를 inline 토큰으로 분해. */
export function lexInline(text: string): Token[] {
  configureMarked();
  return marked.Lexer.lexInline(text, { gfm: true, breaks: false });
}
