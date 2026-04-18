/**
 * YAML frontmatter 파서 — 문서별 설정 오버라이드.
 * 외부 의존성 없이 간단한 key: value / nested 구조만 지원.
 *
 * 예시:
 * ---
 * hwpx:
 *   preset: "공문 양식"
 *   paper: "A4"
 *   landscape: true
 *   margin-left: 30
 *   body-font: "함초롬바탕"
 *   body-size: 11
 * ---
 */

import type { HwpxWriterSettings } from "./settings";

export interface ParseResult {
  frontmatter: Record<string, any>;
  body: string;
}

/** Markdown에서 frontmatter를 추출하고 본문을 분리한다. */
export function parseFrontmatter(markdown: string): ParseResult {
  const lines = markdown.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { frontmatter: {}, body: markdown };
  }

  // 닫는 --- 찾기
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { endIdx = i; break; }
  }
  if (endIdx < 0) return { frontmatter: {}, body: markdown };

  const yamlLines = lines.slice(1, endIdx);
  const bodyLines = lines.slice(endIdx + 1);
  const frontmatter = parseSimpleYaml(yamlLines);
  return { frontmatter, body: bodyLines.join("\n") };
}

/**
 * 매우 단순한 YAML 파서 — key: value / 2-스페이스 중첩만 지원.
 * 복잡한 YAML(배열, 여러 줄 문자열)은 지원하지 않는다.
 */
function parseSimpleYaml(lines: string[]): Record<string, any> {
  const root: Record<string, any> = {};
  const stack: { obj: Record<string, any>; indent: number }[] = [{ obj: root, indent: -1 }];

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    const m = line.match(/^([\w\-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const rawValue = m[2];

    // 스택에서 현재 indent보다 같거나 깊은 레이어를 pop
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (rawValue === "") {
      // 하위 객체 시작
      const child: Record<string, any> = {};
      parent[key] = child;
      stack.push({ obj: child, indent });
    } else {
      parent[key] = parseYamlValue(rawValue);
    }
  }
  return root;
}

function parseYamlValue(raw: string): any {
  const s = raw.trim();
  // 따옴표 문자열
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  // 불린
  if (s === "true") return true;
  if (s === "false") return false;
  // null
  if (s === "null" || s === "~") return null;
  // 숫자
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

/**
 * frontmatter의 hwpx 섹션을 기존 설정에 오버라이드한다.
 * 인식하는 키:
 *   preset:          프리셋 이름 (먼저 적용)
 *   paper:           "A4" | "B5" | "Letter"
 *   landscape:       boolean
 *   margin-left/right/top/bottom/header/footer: number (mm)
 *   body-font:       string
 *   body-size:       number (pt)
 *   line-spacing:    number (%)
 *   font-hangul:     string
 *   font-latin:      string
 *   link-color:      string (#RRGGBB)
 *   math-mode:       "none" | "italic" | "hwce"
 *
 * 최상위 키 `hwpx` 또는 개별 키(paper, landscape 등) 모두 인식.
 */
export function applyFrontmatterOverrides(
  base: HwpxWriterSettings,
  frontmatter: Record<string, any>,
): { settings: HwpxWriterSettings; appliedKeys: string[] } {
  const applied: string[] = [];
  // 깊은 복사 (presets 등은 공유해도 되지만 설정 수정하므로 얕은 복사 수준으로)
  let settings: HwpxWriterSettings = { ...base, headingStyles: [...base.headingStyles] };

  // hwpx 섹션 우선, 없으면 최상위 레벨도 탐색
  const src = (frontmatter.hwpx && typeof frontmatter.hwpx === "object")
    ? frontmatter.hwpx
    : frontmatter;

  // preset을 먼저 적용 (다른 오버라이드가 프리셋 값을 덮어쓸 수 있도록)
  if (typeof src.preset === "string" && base.presets?.[src.preset]) {
    const preset = base.presets[src.preset];
    const { presets, activePreset, ...preserved } = settings;
    Object.assign(settings, preserved, preset);
    settings.presets = presets;
    settings.activePreset = src.preset;
    applied.push(`preset=${src.preset}`);
  }

  const setStr = (key: string, prop: keyof HwpxWriterSettings) => {
    const v = src[key];
    if (typeof v === "string" && v.length > 0) {
      (settings as any)[prop] = v;
      applied.push(`${key}=${v}`);
    }
  };
  const setNum = (key: string, prop: keyof HwpxWriterSettings) => {
    const v = src[key];
    if (typeof v === "number" && !isNaN(v)) {
      (settings as any)[prop] = v;
      applied.push(`${key}=${v}`);
    }
  };
  const setBool = (key: string, prop: keyof HwpxWriterSettings) => {
    const v = src[key];
    if (typeof v === "boolean") {
      (settings as any)[prop] = v;
      applied.push(`${key}=${v}`);
    }
  };
  const setEnum = <T>(key: string, prop: keyof HwpxWriterSettings, allowed: T[]) => {
    const v = src[key];
    if (allowed.includes(v)) {
      (settings as any)[prop] = v;
      applied.push(`${key}=${v}`);
    }
  };

  setEnum("paper", "paperSize", ["A4", "B5", "Letter"] as any);
  setBool("landscape", "landscape");
  setNum("margin-left", "marginLeft");
  setNum("margin-right", "marginRight");
  setNum("margin-top", "marginTop");
  setNum("margin-bottom", "marginBottom");
  setNum("margin-header", "marginHeader");
  setNum("margin-footer", "marginFooter");
  // body-font는 레거시 별칭 — fontHangul에 매핑
  setStr("body-font", "fontHangul");
  setStr("font-hangul", "fontHangul");
  setStr("font-latin", "fontLatin");
  setNum("body-size", "bodyFontSize");
  setNum("line-spacing", "lineSpacing");
  setStr("link-color", "linkColor");
  setEnum("math-mode", "mathMode", ["none", "italic", "hwce"] as any);
  setStr("output-folder", "outputFolder");

  // body-font이 설정되면 fontHangul도 함께 동기화(하위 호환)
  if (typeof src["body-font"] === "string") {
    settings.fontHangul = src["body-font"];
  }

  return { settings, appliedKeys: applied };
}
