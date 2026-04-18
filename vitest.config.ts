import { defineConfig } from "vitest/config";

/**
 * Vitest 설정 — Phase 0 안전망용.
 *
 * - 테스트는 `test/` 디렉토리에 위치
 * - `obsidian` 모듈은 테스트에서 필요 없음 (hwpx-core 및 converter는 독립적으로 동작)
 * - DOM 필요 시(DOMParser 등) "happy-dom" 환경 사용
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      // settings.ts 등이 import하는 obsidian 모듈을 테스트 스텁으로 치환
      obsidian: new URL("./test/stubs/obsidian.ts", import.meta.url).pathname,
    },
  },
});
