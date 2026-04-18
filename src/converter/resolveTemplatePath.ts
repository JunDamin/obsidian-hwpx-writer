/**
 * 설정의 activeTemplateId → OS 절대 경로.
 *
 * main.ts · PreviewPanel 양쪽에서 같은 로직으로 쓰도록 공유 헬퍼로 분리.
 * preview 도 export 와 같은 경로(template-aware 포함)를 타야 "미리보기와 실제 결과가
 * 다르다" 는 혼란을 방지한다.
 */

import type { App, Plugin } from "obsidian";
import { log } from "../logger";
import type { HwpxWriterSettings } from "../settings";
import { TemplateStore } from "../templates/TemplateStore";

export function resolveActiveTemplatePath(
  app: App,
  plugin: Plugin,
  settings: HwpxWriterSettings,
): string | null {
  const id = settings.activeTemplateId;
  if (!id) {
    log.info("No active template (activeTemplateId = null)");
    return null;
  }
  const store = new TemplateStore(app, plugin);
  const info = store.get(id);
  if (!info) {
    log.warn(`Active template "${id}" not found in store`);
    return null;
  }
  log.info(`Active template resolved: ${info.name} → ${info.absPath}`);
  return info.absPath;
}
