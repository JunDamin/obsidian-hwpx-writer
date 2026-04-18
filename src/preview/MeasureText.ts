/**
 * @rhwp/core WASM이 호출하는 globalThis.measureTextWidth 콜백 등록.
 *
 * WASM 내부에서 텍스트 레이아웃(줄바꿈, 정렬)을 계산할 때
 * 브라우저 Canvas API로 실제 렌더링 폭을 측정한다.
 *
 * rhwp.js 내부 시그니처:
 *   __wbg_measureTextWidth_1fba8c01a653f4c4: (arg0, arg1, arg2, arg3) =>
 *     globalThis.measureTextWidth(font, text)
 *
 * ⚠ WASM 초기화 이전에 반드시 등록해야 한다.
 */

let ctx: CanvasRenderingContext2D | null = null;
let lastFont = "";

export function registerMeasureTextWidth(): void {
  // 이미 등록되어 있으면 건너뛴다 (다른 플러그인이 등록했을 수도 있음)
  if (typeof (globalThis as any).measureTextWidth === "function") return;

  (globalThis as any).measureTextWidth = (font: string, text: string): number => {
    if (!ctx) {
      ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return 0;
    }
    if (font !== lastFont) {
      ctx.font = font;
      lastFont = font;
    }
    return ctx.measureText(text).width;
  };
}
