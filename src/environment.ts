/**
 * 환경 감지 — 플러그인이 실행되는 환경에 따라 사용 가능한 기능을 결정한다.
 */

import type { App } from "obsidian";

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

export async function detectEnvironment(app: App, pluginDir: string): Promise<EnvironmentInfo> {
  const info: EnvironmentInfo = {
    wasmAvailable: false,
    electronAvailable: false,
    platform: "unknown",
    hancomInstalled: false,
    online: navigator.onLine,
    wasmInitOk: null,
    renderFailCount: 0,
  };

  // Electron 사용 가능 여부
  try {
    const electron = require("electron");
    info.electronAvailable = !!electron?.shell;
  } catch {
    info.electronAvailable = false;
  }

  // 플랫폼
  try {
    const os = require("os");
    const p = os.platform();
    if (p === "win32" || p === "darwin" || p === "linux") info.platform = p;
  } catch {}

  // WASM 파일 존재 확인
  try {
    const fs = require("fs");
    const path = require("path");
    const adapter = app.vault.adapter as any;
    const wasmPath = path.join(adapter.basePath, pluginDir, "rhwp_bg.wasm");
    info.wasmAvailable = fs.existsSync(wasmPath);
  } catch {
    info.wasmAvailable = false;
  }

  // 한컴오피스 감지 (Windows 설치 경로 확인)
  if (info.platform === "win32") {
    try {
      const fs = require("fs");
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
    } catch {}
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
 */
export async function openInHancom(
  hwpxBytes: Uint8Array,
  filename: string,
): Promise<string> {
  const path = require("path");
  const fs = require("fs");
  const os = require("os");
  const { shell } = require("electron");

  const safeName = (filename || "preview").replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.\-_ ]/g, "_");
  const tmpPath = path.join(os.tmpdir(), `${safeName}.hwpx`);
  fs.writeFileSync(tmpPath, Buffer.from(hwpxBytes));
  await shell.openPath(tmpPath);
  return tmpPath;
}
