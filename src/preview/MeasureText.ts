/**
 * @rhwp/core WASM 이 호출하는 globalThis.measureTextWidth 콜백 등록.
 *
 * WASM 내부에서 텍스트 레이아웃(줄바꿈, 정렬)을 계산할 때
 * 브라우저 Canvas API 로 실제 렌더링 폭을 측정한다.
 *
 * rhwp.js 내부 시그니처:
 *   __wbg_measureTextWidth_1fba8c01a653f4c4: (arg0, arg1, arg2, arg3) =>
 *     globalThis.measureTextWidth(font, text)
 *
 * ⚠ globalThis 사용은 WASM 측 계약(globalThis.measureTextWidth) 때문에 불가피.
 * ⚠ WASM 초기화 이전에 반드시 등록해야 한다.
 */

import { Platform } from "obsidian";

let ctx: CanvasRenderingContext2D | null = null;
let lastFont = "";

/**
 * Canvas 측정용 컨텍스트를 게으르게 생성. popout window 와 메인 window 의
 * canvas 는 호환되므로 어느 쪽에서 만들어도 측정 결과는 동일.
 */
function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (ctx) return ctx;
  // activeDocument 가 없는 환경(테스트 등) 에서는 안전하게 fallback.
  const doc = typeof activeDocument !== "undefined" ? activeDocument : null;
  if (!doc) return null;
  ctx = doc.createElement("canvas").getContext("2d");
  return ctx;
}

export function registerMeasureTextWidth(): void {
  // 데스크탑 앱에서만 — 모바일은 미리보기를 지원하지 않음.
  if (!Platform.isDesktopApp) return;

  const g = globalThis as Record<string, unknown>;
  // 이미 등록되어 있으면 건너뛴다 (다른 플러그인이 등록했을 수도 있음).
  if (typeof g.measureTextWidth === "function") return;

  g.measureTextWidth = (font: string, text: string): number => {
    const c = getMeasurementContext();
    if (!c) return 0;
    if (font !== lastFont) {
      c.font = font;
      lastFont = font;
    }
    return c.measureText(text).width;
  };
}
