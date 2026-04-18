/**
 * 중앙 로거 — Obsidian 커뮤니티 플러그인 가이드라인 준수.
 *
 * 가이드라인(https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines):
 *   "Don't leave console.log calls in your production code."
 *
 * 전략:
 *   - error / warn 는 항상 출력 — 사용자에게 문제 상황 전달 필요
 *   - info / debug 는 DEBUG 모드에서만 — 개발·버그 리포트 시 켜서 확인
 *   - DEBUG 모드 활성화:
 *       1) 빌드 타임 esbuild --define '__HWPX_DEBUG__=true'
 *       2) 런타임 localStorage.setItem("hwpx-writer-debug", "1") — DevTools 에서
 *
 * 모든 메시지에는 `[HWPX Writer]` 프리픽스를 자동 추가.
 */

declare const __HWPX_DEBUG__: boolean | undefined;

function isDebugEnabled(): boolean {
  // 빌드 타임 플래그
  try {
    if (typeof __HWPX_DEBUG__ !== "undefined" && __HWPX_DEBUG__) return true;
  } catch { /* ignore */ }
  // 런타임 opt-in (사용자가 devtools 에서 켬)
  try {
    return localStorage.getItem("hwpx-writer-debug") === "1";
  } catch {
    return false;
  }
}

const PREFIX = "[HWPX Writer]";

export const log = {
  /** 상세 정보 — DEBUG 모드에서만 */
  debug(...args: unknown[]): void {
    if (isDebugEnabled()) console.debug(PREFIX, ...args);
  },
  /** 일반 정보 — DEBUG 모드에서만 (프로덕션 콘솔 오염 방지) */
  info(...args: unknown[]): void {
    if (isDebugEnabled()) console.info(PREFIX, ...args);
  },
  /** 경고 — 항상 출력 (사용자가 주의해야 할 상황) */
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
  },
  /** 에러 — 항상 출력 */
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  },
};
