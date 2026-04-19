/**
 * 템플릿 저장소 — 파일시스템 기반 CRUD.
 *
 * 위치: <vault>/<pluginDir>/templates/<id>.hwpx  (file-based, 간단)
 * md2hwpx-gui의 `%APPDATA%/md2hwpx-gui/templates/` 구조를 참고하되,
 * Obsidian 플러그인은 vault 내 플러그인 디렉토리를 쓴다.
 */

import type { App, Plugin } from "obsidian";
import { FileSystemAdapter } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { shell } from "electron";
import { createAllSampleTemplates } from "./sampleTemplates";

export interface TemplateInfo {
  id: string;         // 파일명 stem (예: "보고양식")
  name: string;       // 표시 이름 (현재는 id와 동일)
  filename: string;   // 파일명 (예: "보고양식.hwpx")
  absPath: string;    // OS 절대 경로 (Node fs용)
  sizeBytes: number;  // 파일 크기
  mtime: number;      // 수정 시각 (epoch ms)
}

export class TemplateStore {
  constructor(private app: App, private plugin: Plugin) {}

  /** 템플릿 저장 디렉토리의 OS 절대 경로. 없으면 생성한다. */
  getTemplatesDir(): string {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultBase = adapter.basePath as string;
    const pluginDir = this.plugin.manifest.dir || "";
    const dir = path.join(vaultBase, pluginDir, "templates");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /** 디렉토리를 스캔해 .hwpx 파일 목록을 반환 */
  list(): TemplateInfo[] {
    const dir = this.getTemplatesDir();
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      return [];
    }
    const infos: TemplateInfo[] = [];
    for (const filename of files) {
      if (!filename.toLowerCase().endsWith(".hwpx")) continue;
      const absPath = path.join(dir, filename);
      let stat;
      try { stat = fs.statSync(absPath); } catch { continue; }
      if (!stat.isFile()) continue;
      const id = filename.replace(/\.hwpx$/i, "");
      infos.push({
        id,
        name: id,
        filename,
        absPath,
        sizeBytes: stat.size,
        mtime: stat.mtimeMs,
      });
    }
    // 이름 기준 정렬
    infos.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    return infos;
  }

  /** 특정 템플릿 조회 (없으면 null) */
  get(id: string): TemplateInfo | null {
    return this.list().find(t => t.id === id) || null;
  }

  /**
   * 파일에서 템플릿 임포트.
   * 이름 충돌 시 타임스탬프 suffix를 붙인다. (`_import_YYYYMMDD_HHMMSS`)
   */
  importFromBytes(bytes: ArrayBuffer | Uint8Array, originalName: string): TemplateInfo {
    const dir = this.getTemplatesDir();
    const stem = this.sanitizeId(originalName.replace(/\.(hwpx|hwp)$/i, ""));
    let filename = `${stem}.hwpx`;
    let absPath = path.join(dir, filename);
    if (fs.existsSync(absPath)) {
      filename = `${stem}_import_${this.timestamp()}.hwpx`;
      absPath = path.join(dir, filename);
    }
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    fs.writeFileSync(absPath, Buffer.from(buf));
    return this.get(filename.replace(/\.hwpx$/i, ""))!;
  }

  /**
   * 편집용 복제 — 원본은 건드리지 않고 `<name>_edit_YYYYMMDD_HHMMSS.hwpx` 로 복사.
   * md2hwpx-gui의 copy-on-edit 패턴을 따른다.
   */
  copyForEdit(id: string): TemplateInfo | null {
    const src = this.get(id);
    if (!src) return null;
    const dir = this.getTemplatesDir();
    const newId = `${src.id}_edit_${this.timestamp()}`;
    const dstPath = path.join(dir, `${newId}.hwpx`);
    fs.copyFileSync(src.absPath, dstPath);
    return this.get(newId);
  }

  /** 삭제 */
  delete(id: string): boolean {
    const info = this.get(id);
    if (!info) return false;
    try {
      fs.unlinkSync(info.absPath);
      return true;
    } catch {
      return false;
    }
  }

  /** 이름 변경 */
  rename(id: string, newName: string): TemplateInfo | null {
    const info = this.get(id);
    if (!info) return null;
    const newId = this.sanitizeId(newName);
    if (!newId || newId === id) return info;
    const dir = this.getTemplatesDir();
    const newPath = path.join(dir, `${newId}.hwpx`);
    if (fs.existsSync(newPath)) return null; // 충돌
    fs.renameSync(info.absPath, newPath);
    return this.get(newId);
  }

  /** 템플릿을 기본 프로그램(한컴 등)으로 연다 */
  openExternal(id: string): boolean {
    const info = this.get(id);
    if (!info) return false;
    try {
      void shell.openPath(info.absPath);
      return true;
    } catch {
      return false;
    }
  }

  /** 파일 탐색기에서 해당 파일을 선택된 상태로 연다 */
  revealInFolder(id: string): boolean {
    const info = this.get(id);
    if (!info) return false;
    try {
      shell.showItemInFolder(info.absPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 샘플 템플릿 시드.
   *
   * `createAllSampleTemplates()` 로 생성된 HWPX 들을 templates 폴더에 쓴다.
   * 기본은 비파괴(같은 이름 있으면 건너뜀). `force: true` 면 덮어쓰기 — 샘플 세트
   * 버전 업그레이드 시 사용한다.
   * 반환값: 실제로 쓰여진 파일 수.
   */
  seedSampleTemplates(options: { force?: boolean } = {}): number {
    const samples = createAllSampleTemplates();
    const dir = this.getTemplatesDir();
    let written = 0;
    for (const s of samples) {
      const safe = this.sanitizeId(s.name);
      const target = path.join(dir, `${safe}.hwpx`);
      if (fs.existsSync(target) && !options.force) continue;
      fs.writeFileSync(target, Buffer.from(s.bytes));
      written++;
    }
    return written;
  }

  /**
   * 이전 버전(v1)에서 자동 생성했던 샘플 파일 중 현재 세트에 없는 것들을 정리.
   * v1 샘플은 매우 작은 크기(< 20KB)에 특정 이름을 가지므로 안전하게 식별 가능.
   * 사용자가 같은 이름으로 편집·확장했다면 파일이 크므로 건드리지 않는다.
   */
  pruneLegacySampleTemplates(): string[] {
    const LEGACY_V1_NAMES = ["기본 보고서", "공문 양식", "학술 논문", "회의록"];
    const SAFETY_MAX_BYTES = 20 * 1024; // 20KB 이상이면 사용자가 손댄 것으로 간주
    const dir = this.getTemplatesDir();
    const removed: string[] = [];

    for (const name of LEGACY_V1_NAMES) {
      const target = path.join(dir, `${name}.hwpx`);
      try {
        if (!fs.existsSync(target)) continue;
        const stat = fs.statSync(target);
        if (stat.size > SAFETY_MAX_BYTES) continue; // 사용자가 키웠으면 보존
        fs.unlinkSync(target);
        removed.push(name);
      } catch {
        // 실패 무시 (파일 잠김 등)
      }
    }
    return removed;
  }

  /** templates 폴더가 비어있는지 (샘플 자동 시드 판단용) */
  isEmpty(): boolean {
    return this.list().length === 0;
  }

  /** 템플릿 폴더 자체를 연다 */
  openTemplatesFolder(): boolean {
    try {
      void shell.openPath(this.getTemplatesDir());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 템플릿 XML에서 플레이스홀더(`{{NAME}}`) 추출.
   * md2hwpx-gui의 진단 기능 포팅. 읽기 실패 시 빈 배열.
   */
  extractPlaceholders(id: string): string[] {
    const info = this.get(id);
    if (!info) return [];
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(fs.readFileSync(info.absPath)); } catch { return []; }
    // Contents/section0.xml 내용을 찾아 정규식 실행
    // HWPX는 ZIP이므로 간단한 중앙 디렉토리 스캔 대신, 전체 바이트를 디코딩해 검색해도
    // 플레이스홀더 패턴 검출 수준에서는 충분하다.
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const re = /\{\{([A-Z0-9_]+)\}\}/g;
    const found = new Set<string>();
    let m;
    while ((m = re.exec(text)) !== null) found.add(m[1]);
    return Array.from(found).sort();
  }

  // ── 유틸 ──

  private sanitizeId(raw: string): string {
    // 파일 시스템에서 금지된 문자 제거 + trim
    return raw
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "_" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  }
}
