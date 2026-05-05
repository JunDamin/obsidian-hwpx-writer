/**
 * 환경 감지 — 플러그인이 실행되는 환경에 따라 사용 가능한 기능을 결정한다.
 */

import type { App } from "obsidian";
import { FileSystemAdapter, Platform } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { openPathExternal } from "./electronShell";

export interface EnvironmentInfo {
  /** rhwp_bg.wasm 파일이 플러그인 폴더에 존재하는지 */
  wasmAvailable: boolean;
  /** Electron shell API 사용 가능 여부 (한컴오피스 열기) */
  electronAvailable: boolean;
  /** OS 플랫폼 */
  platform: "win32" | "darwin" | "linux" | "unknown";
  /** 한컴오피스 설치 감지 (Windows만) */
  hancomInstalled: boolean;
  /** 온라인 연결 가능 여부 (@rhwp/editor 사용 가능) */
  online: boolean;
  /** WASM 초기화 성공 여부 (시도 후 설정) */
  wasmInitOk: boolean | null;
  /** 마지막 렌더링 실패 카운트 */
  renderFailCount: number;
}

export function detectEnvironment(app: App, pluginDir: string): EnvironmentInfo {
  const info: EnvironmentInfo = {
    wasmAvailable: false,
    electronAvailable: false,
    platform: "unknown",
    hancomInstalled: false,
    online: navigator.onLine,
    wasmInitOk: null,
    renderFailCount: 0,
  };

  // Electron 사용 가능 여부 — 데스크탑 앱에서만 사용 가능 (모바일에서는 자동 false)
  info.electronAvailable = Platform.isDesktopApp;

  // 플랫폼
  try {
    const p = os.platform();
    if (p === "win32" || p === "darwin" || p === "linux") info.platform = p;
  } catch { /* not available on mobile */ }

  // WASM 파일 존재 확인
  try {
    const adapter = app.vault.adapter as FileSystemAdapter;
    const wasmPath = path.join(adapter.basePath, pluginDir, "rhwp_bg.wasm");
    info.wasmAvailable = fs.existsSync(wasmPath);
  } catch {
    info.wasmAvailable = false;
  }

  // 한컴오피스 감지 (Windows 설치 경로 확인)
  if (info.platform === "win32") {
    try {
      const candidates = [
        "C:\\Program Files\\Hnc\\Office 2022\\Bin\\Hwp.exe",
        "C:\\Program Files (x86)\\Hnc\\Office 2022\\Bin\\Hwp.exe",
        "C:\\Program Files\\Hnc\\Office 2020\\Bin\\Hwp.exe",
        "C:\\Program Files (x86)\\Hnc\\Office 2020\\Bin\\Hwp.exe",
        "C:\\Program Files\\Hnc\\Office 2018\\Bin\\Hwp.exe",
        "C:\\Program Files (x86)\\Hnc\\Office 2018\\Bin\\Hwp.exe",
      ];
      info.hancomInstalled = candidates.some((p) => {
        try { return fs.existsSync(p); } catch { return false; }
      });
    } catch { /* not available on mobile */ }
  }

  return info;
}

/**
 * 현재 환경에서 미리보기를 사용할 수 있는지 판단.
 */
export function canUsePreview(env: EnvironmentInfo): boolean {
  if (!env.wasmAvailable) return false;
  if (env.wasmInitOk === false) return false;
  if (env.renderFailCount >= 3) return false;  // 3번 실패하면 자동 폴백
  return true;
}

/**
 * HWPX 바이트를 임시 파일로 저장 후 한컴오피스로 열기.
 *
 * 임시 파일은 vault 외부(OS tmpdir)에 두므로 Obsidian Vault API 가 아닌
 * Node fs 와 Electron shell 을 사용해야 한다. Platform.isDesktopApp 가드는
 * `openPathExternal` 내부에서 처리.
 */
export function openInHancom(
  hwpxBytes: Uint8Array,
  filename: string,
): string {
  const safeName = (filename || "preview").replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ._ -]/g, "_");
  const tmpPath = path.join(os.tmpdir(), `${safeName}.hwpx`);
  fs.writeFileSync(tmpPath, Buffer.from(hwpxBytes));
  openPathExternal(tmpPath);
  return tmpPath;
}
