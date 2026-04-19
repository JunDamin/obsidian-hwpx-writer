/**
 * @rhwp/core WASM 기반 HWPX 렌더러.
 *
 * 책임:
 * - WASM 초기화 (resource URL fetch 시도 → fs.readFileSync 폴백)
 * - HwpDocument 로드 및 페이지 수 집계
 * - renderPageSvg(pageIdx) 위임
 *
 * WASM 초기화 이전에 globalThis.measureTextWidth 콜백을 반드시 등록한다.
 */

import type { App } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { log } from "../logger";
import { registerMeasureTextWidth } from "./MeasureText";

export interface RhwpRenderResult {
  pageCount: number;
}

interface RhwpDocument {
  pageCount(): number;
  renderPageSvg(pageIdx: number): string;
  free?(): void;
}

export class RhwpRenderer {
  private initialized = false;
  private doc: RhwpDocument | null = null;
  private _pageCount = 0;

  constructor(private app: App, private pluginDir: string) {}

  get pageCount(): number {
    return this._pageCount;
  }

  get hasDocument(): boolean {
    return this.doc !== null;
  }

  /** WASM 초기화 — 이미 초기화되어 있으면 no-op. */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // ⚠ WASM 초기화 전에 콜백 등록
    registerMeasureTextWidth();

    const rhwp = await import("@rhwp/core");

    // 1차 시도: Obsidian resource URL (app://...) 을 통해 fetch
    try {
      const wasmPath = (this.app.vault.adapter as FileSystemAdapter).getResourcePath(
        `${this.pluginDir}/rhwp_bg.wasm`
      );
      await rhwp.default({ module_or_path: wasmPath });
      this.initialized = true;
      return;
    } catch (primaryErr) {
      log.warn("Primary WASM init failed, trying fs fallback:", primaryErr);
    }

    // 2차 폴백: Node.js fs로 직접 읽기 (Electron 환경)
    const basePath = (this.app.vault.adapter as FileSystemAdapter).basePath;
    const wasmFile = path.join(basePath, this.pluginDir, "rhwp_bg.wasm");
    const wasmBuffer = fs.readFileSync(wasmFile);
    rhwp.initSync({ module: wasmBuffer });
    this.initialized = true;
  }

  /** HWPX 바이트로 문서 로드. 이전 문서는 자동 해제. */
  async loadDocument(hwpxBytes: Uint8Array): Promise<RhwpRenderResult> {
    if (!this.initialized) {
      throw new Error("RhwpRenderer: initialize() must be called first");
    }
    const rhwp = await import("@rhwp/core");

    // 이전 문서 해제
    if (this.doc && typeof this.doc.free === "function") {
      try { this.doc.free(); } catch { /* ignore */ }
    }

    this.doc = new rhwp.HwpDocument(hwpxBytes);
    this._pageCount = this.doc.pageCount();
    return { pageCount: this._pageCount };
  }

  /** 지정 페이지를 SVG 문자열로 렌더. */
  renderPageSvg(pageIdx: number): string {
    if (!this.doc) throw new Error("RhwpRenderer: no document loaded");
    return this.doc.renderPageSvg(pageIdx);
  }

  /** 리소스 해제 */
  dispose(): void {
    if (this.doc && typeof this.doc.free === "function") {
      try { this.doc.free(); } catch { /* ignore */ }
    }
    this.doc = null;
    this._pageCount = 0;
  }
}
