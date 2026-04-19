/**
 * 표 테두리 디자이너 — 7개 독립 구간의 선 종류·색·굵기를 각각 지정.
 *
 * 구조:
 *   ┌─── 프리뷰 SVG ────────────┐
 *   │  [헤더 배경색]            │
 *   │   L      C      R         │  ← 헤더 1행 × 3칸 (tableHeaderBgColor)
 *   ├═══════════════════════════┤  ← headerBottom (별도 구간)
 *   │   .      .      .         │  ← 본문 3행 × 3칸
 *   │   .      .      .         │
 *   │   .      .      .         │
 *   └───────────────────────────┘
 *
 * 각 선분은 클릭 가능. 클릭하면 해당 구간의 {type, color, width} 편집 컨트롤이 아래에 뜬다.
 *
 * 편집 가능한 7개 구간:
 *   outerTop, outerBottom, outerLeft, outerRight,
 *   headerBottom, innerH, innerV
 *
 * HWPX 표준 17개 선 종류 전체 지원 (SOLID ~ CLIPPING).
 */

import type HwpxWriterPlugin from "../main";
import type { BorderLineSpec, BorderLineType, TableBorderDesign } from "../settings";
import { BORDER_TYPE_LABELS, BORDER_WIDTHS } from "../settings";
import { promptText, confirmModal } from "../ui/prompts";

type SegmentKey = keyof TableBorderDesign;

const SEGMENT_LABELS: Record<SegmentKey, string> = {
  outerTop:     "위쪽 외곽",
  outerBottom:  "아래쪽 외곽",
  outerLeft:    "왼쪽 외곽",
  outerRight:   "오른쪽 외곽",
  headerBottom: "헤더-본문 구분",
  innerH:       "본문 가로선",
  innerV:       "열 사이 세로선",
};

/**
 * 프리셋 — 현재 design 과 "기준 스펙(ref)" 을 받아 새 design 을 반환.
 * ref 는 "ON으로 만들 구간에 적용할 색·굵기·종류" 로 쓰인다.
 * 보통 사용자가 선택한 구간의 스펙이 ref 로 들어감 (선택 없으면 기본값).
 */
interface Preset {
  label: string;
  apply: (current: TableBorderDesign, ref: BorderLineSpec) => TableBorderDesign;
}

const PRESETS: Preset[] = [
  {
    label: "전체",
    apply: (_d, ref) => broadcastTypes(ref, {
      outerTop: ref.type, outerBottom: ref.type, outerLeft: ref.type, outerRight: ref.type,
      headerBottom: ref.type, innerH: ref.type, innerV: ref.type,
    }),
  },
  {
    label: "외곽만",
    apply: (d, ref) => mergeSpecs(d, ref, {
      outerTop: ref.type, outerBottom: ref.type, outerLeft: ref.type, outerRight: ref.type,
      headerBottom: "NONE", innerH: "NONE", innerV: "NONE",
    }),
  },
  {
    label: "안쪽만",
    apply: (d, ref) => mergeSpecs(d, ref, {
      outerTop: "NONE", outerBottom: "NONE", outerLeft: "NONE", outerRight: "NONE",
      headerBottom: ref.type, innerH: ref.type, innerV: ref.type,
    }),
  },
  {
    label: "헤더 강조",
    apply: (_d, ref) => {
      // 전체에 ref 적용 + headerBottom 만 DOUBLE_SLIM 으로 강조 (색·굵기는 ref 승계)
      const base = broadcastTypes(ref, {
        outerTop: ref.type, outerBottom: ref.type, outerLeft: ref.type, outerRight: ref.type,
        headerBottom: ref.type, innerH: ref.type, innerV: ref.type,
      });
      base.headerBottom = { ...ref, type: "DOUBLE_SLIM" };
      return base;
    },
  },
  {
    label: "없음",
    apply: (d) => mergeSpecs(d, defaultLine(), {
      outerTop: "NONE", outerBottom: "NONE", outerLeft: "NONE", outerRight: "NONE",
      headerBottom: "NONE", innerH: "NONE", innerV: "NONE",
    }),
  },
];

function defaultLine(): BorderLineSpec {
  return { type: "SOLID", color: "#000000", width: "0.12 mm" };
}

/**
 * 모든 구간에 ref 를 베이스로 깔되, 각 구간의 type 은 types 로 덮어씀.
 * ON 구간은 ref.color / ref.width 를 쓰므로 사용자가 고른 색·굵기가 일괄 적용된다.
 */
function broadcastTypes(
  ref: BorderLineSpec,
  types: Record<SegmentKey, BorderLineType>,
): TableBorderDesign {
  const result = {} as TableBorderDesign;
  for (const k of ["outerTop", "outerBottom", "outerLeft", "outerRight", "headerBottom", "innerH", "innerV"] as SegmentKey[]) {
    result[k] = { ...ref, type: types[k] };
  }
  return result;
}

/**
 * 현재 design 의 각 구간을 유지하되:
 *   - types[k] 가 "NONE" 이면 그 구간의 type 만 NONE 으로 바꿈 (색·굵기 보존)
 *   - types[k] 가 "NONE" 아니면 ref (type+color+width) 로 완전 교체
 * 색·굵기를 잃지 않으면서 일부만 켜기/끄기에 유용.
 */
function mergeSpecs(
  d: TableBorderDesign,
  ref: BorderLineSpec,
  types: Record<SegmentKey, BorderLineType>,
): TableBorderDesign {
  const result = {} as TableBorderDesign;
  for (const k of Object.keys(d) as SegmentKey[]) {
    const newType = types[k];
    if (newType === "NONE") {
      result[k] = { ...d[k], type: "NONE" };
    } else {
      result[k] = { ...ref, type: newType };
    }
  }
  return result;
}

/** HWPX 선 종류 → SVG stroke-dasharray 패턴 (근사 시각화). */
function dashPattern(type: BorderLineType): string | null {
  switch (type) {
    case "DASH":            return "6 3";
    case "DOT":             return "1 3";
    case "DASH_DOT":        return "6 3 1 3";
    case "DASH_DOT_DOT":    return "6 3 1 3 1 3";
    case "LONG_DASH":       return "12 3";
    case "WAVE":            return "2 2";   // 근사
    case "DOUBLE_WAVE":     return "2 2";
    case "CIRCLE":          return "3 3";
    default:                return null;    // 실선 계열
  }
}

/** 이중선 계열 여부 (SVG 에서 두 줄 그림). */
function isDoubleLine(type: BorderLineType): boolean {
  return type === "DOUBLE_SLIM" || type === "DOUBLE_WAVE";
}

/** 3단 굵기 계열: 시각화 단순화 — 그냥 굵은 실선으로. */
function variableWeight(type: BorderLineType): number | null {
  if (type === "SLIM_THICK" || type === "THICK_SLIM") return 2.5;
  if (type === "SLIM_THICK_SLIM") return 2;
  if (type === "THICK3D") return 3;
  if (type === "NEGATIVE3D") return 2.5;
  return null;
}

export class TableBorderDesigner {
  /**
   * 현재 선택된 구간. null 이면 "아무것도 선택 안 된 상태".
   * 선택된 선을 다시 클릭하면 해제된다.
   */
  private selectedSegment: SegmentKey | null = null;

  /**
   * 선택이 없을 때 편집 패널이 편집하는 "기본 선 스타일". 프리셋이 이 값을 기준으로
   * 나머지 구간에 적용한다. 패널 세션 동안만 유지(영속 저장 안 함) — 재열면 기본값으로.
   */
  private pendingRef: BorderLineSpec = {
    type: "SOLID", color: "#000000", width: "0.12 mm",
  };

  private svg: SVGSVGElement | null = null;
  private editorEl: HTMLElement | null = null;
  /**
   * 프리셋 버튼에 마우스를 올리고 있을 때 "이 프리셋이 바꿀 구간"을 강조할 집합.
   * null 이면 강조 없음. 프리뷰 전체를 바꾸지 않고, 영향받는 선만 glow 오버레이.
   */
  private highlightedSegments: Set<SegmentKey> | null = null;

  /**
   * Undo 스택 — 사용자가 변경할 때마다 이전 design 의 깊은 복사본을 푸시.
   * 현재 컴포넌트 세션(패널이 다시 렌더되면 초기화)에 한정. 용량 제한 없음(현실적으로
   * 사용자가 수백 번 변경할 일 없음).
   */
  private undoStack: TableBorderDesign[] = [];
  private undoBtn: HTMLButtonElement | null = null;

  constructor(private plugin: HwpxWriterPlugin) {}

  /** 현재 design 을 undo 스택에 푸시 (변경 직전에 호출). */
  private pushUndo(): void {
    this.undoStack.push(structuredClone(this.actualDesign));
    this.refreshUndoButton();
  }

  /** Undo 버튼 활성/비활성 갱신. */
  private refreshUndoButton(): void {
    if (!this.undoBtn) return;
    const canUndo = this.undoStack.length > 0;
    this.undoBtn.disabled = !canUndo;
    this.undoBtn.toggleClass("hwpx-disabled", !canUndo);
    this.undoBtn.setAttribute("title",
      canUndo ? `되돌리기 (${this.undoStack.length}단계 남음)` : "되돌릴 변경 내역이 없습니다",
    );
  }

  /** 현재 design — 항상 실제 설정값 (hover 중에도 변경하지 않음). */
  private get design(): TableBorderDesign {
    return this.plugin.settings.tableBorderDesign;
  }

  /** 편의 alias — 이전 네이밍 호환. */
  private get actualDesign(): TableBorderDesign {
    return this.plugin.settings.tableBorderDesign;
  }

  /**
   * 프리셋이 참조할 "기준 스펙":
   *   - 선택된 구간이 있고 NONE 이 아니면: 그 구간의 스펙 (선택 우선)
   *   - 그 외: pendingRef (편집 패널에서 사용자가 설정한 기본 선 스타일)
   *
   * 선택이 NONE 인 경우 펜딩 ref 로 폴백해야 "전체가 NONE 으로 비워지는" 무의미한
   * 작업을 막는다.
   */
  private referenceSpec(): BorderLineSpec {
    if (this.selectedSegment) {
      const s = this.actualDesign[this.selectedSegment];
      if (s.type !== "NONE") return { ...s };
    }
    return { ...this.pendingRef };
  }

  /**
   * 두 design 사이에 실제로 값이 달라지는 구간 집합.
   * 프리셋을 적용했을 때 "어느 선이 바뀔지" 강조 표시하는 데 사용.
   */
  private diffSegments(a: TableBorderDesign, b: TableBorderDesign): Set<SegmentKey> {
    const keys: SegmentKey[] = [
      "outerTop", "outerBottom", "outerLeft", "outerRight",
      "headerBottom", "innerH", "innerV",
    ];
    const out = new Set<SegmentKey>();
    for (const k of keys) {
      const sa = a[k], sb = b[k];
      if (sa.type !== sb.type || sa.color !== sb.color || sa.width !== sb.width) {
        out.add(k);
      }
    }
    return out;
  }

  /** 사용자 프리셋 행 컨테이너 — 저장/삭제 시 재구성. */
  private userPresetsEl: HTMLElement | null = null;

  render(parent: HTMLElement): void {
    const container = parent.createDiv("hwpx-border-designer");

    this.renderPresets(container);
    this.renderUserPresets(container);
    this.renderPreview(container);
    this.renderEditor(container);
  }

  private renderUserPresets(parent: HTMLElement): void {
    const wrap = parent.createDiv("hwpx-border-user-presets-wrap");

    const header = wrap.createDiv("hwpx-border-user-presets-header");
    header.createEl("span", { text: "내 프리셋", cls: "hwpx-border-user-presets-label" });

    // 현재 디자인을 새 프리셋으로 저장
    const saveBtn = header.createEl("button", { text: "💾 현재 설정 저장", cls: "hwpx-border-save-btn" });
    saveBtn.addEventListener("click", () => { void (async () => {
      const name = await promptText(
        this.plugin.app,
        "테두리 프리셋 저장",
        "",
        "이름 (예: 공문체)",
      );
      if (!name) return;
      await this.saveUserPreset(name.trim());
    })(); });

    this.userPresetsEl = wrap.createDiv("hwpx-border-user-presets");
    this.rebuildUserPresets();
  }

  /** 사용자 프리셋 칩들을 다시 그림. */
  private rebuildUserPresets(): void {
    const container = this.userPresetsEl;
    if (!container) return;
    container.empty();

    const presets = this.plugin.settings.tableBorderUserPresets || [];
    if (presets.length === 0) {
      container.createEl("span", {
        text: "저장된 프리셋이 없습니다",
        cls: "hwpx-border-user-chip-empty",
      });
      return;
    }

    for (let i = 0; i < presets.length; i++) {
      const preset = presets[i];
      const chip = container.createDiv("hwpx-border-user-chip");

      const applyBtn = chip.createEl("button", { text: preset.name, cls: "hwpx-border-chip-apply-btn" });
      applyBtn.setAttribute("title", `"${preset.name}" 프리셋 적용 (클릭)`);

      // Hover 시 영향 구간 강조 (built-in 프리셋과 동일)
      const startHighlight = () => {
        this.highlightedSegments = this.diffSegments(this.actualDesign, preset.design);
        this.updatePreview();
      };
      const endHighlight = () => {
        this.highlightedSegments = null;
        this.updatePreview();
      };
      applyBtn.addEventListener("mouseenter", startHighlight);
      applyBtn.addEventListener("mouseleave", endHighlight);
      applyBtn.addEventListener("focus", startHighlight);
      applyBtn.addEventListener("blur", endHighlight);

      applyBtn.addEventListener("click", () => { void (async () => {
        this.pushUndo();
        this.highlightedSegments = null;
        this.plugin.settings.tableBorderDesign = structuredClone(preset.design);
        await this.plugin.saveSettings();
        this.updatePreview();
        this.updateEditor();
      })(); });

      // 삭제 버튼 (×)
      const delBtn = chip.createEl("button", { text: "×", cls: "hwpx-border-chip-del-btn" });
      delBtn.setAttribute("title", `"${preset.name}" 삭제`);
      delBtn.addEventListener("click", (ev) => { void (async () => {
        ev.stopPropagation();
        const ok = await confirmModal(
          this.plugin.app,
          "프리셋 삭제",
          `"${preset.name}" 프리셋을 삭제하시겠습니까?`,
          "삭제",
          "취소",
        );
        if (!ok) return;
        this.plugin.settings.tableBorderUserPresets.splice(i, 1);
        await this.plugin.saveSettings();
        this.rebuildUserPresets();
      })(); });
    }
  }

  private async saveUserPreset(name: string): Promise<void> {
    if (!name) return;
    const list = this.plugin.settings.tableBorderUserPresets || [];
    // 동명 프리셋이 있으면 덮어쓰기 확인
    const existingIdx = list.findIndex(p => p.name === name);
    if (existingIdx >= 0) {
      const ok = await confirmModal(
        this.plugin.app,
        "덮어쓰기 확인",
        `"${name}" 프리셋이 이미 있습니다. 덮어쓸까요?`,
        "덮어쓰기",
        "취소",
      );
      if (!ok) return;
      list[existingIdx] = { name, design: structuredClone(this.actualDesign) };
    } else {
      list.push({ name, design: structuredClone(this.actualDesign) });
    }
    this.plugin.settings.tableBorderUserPresets = list;
    await this.plugin.saveSettings();
    this.rebuildUserPresets();
  }

  private renderPresets(parent: HTMLElement): void {
    const row = parent.createDiv("hwpx-border-presets");
    // 프리셋 N개 + 되돌리기 1개 = (N+1) 컬럼 — CSS var 로 동적 지정
    row.setCssProps({ "--hwpx-border-presets-cols": `repeat(${PRESETS.length}, 1fr) auto` });

    for (const preset of PRESETS) {
      const btn = row.createEl("button", {
        text: preset.label,
        cls: "hwpx-preset-action-btn",
        attr: { title: `"${preset.label}" 프리셋 미리보기 (클릭 시 적용)` },
      });

      // Hover/focus 시 "이 프리셋이 바꿀 구간"을 강조 표시
      const startHighlight = () => {
        const result = preset.apply(this.actualDesign, this.referenceSpec());
        this.highlightedSegments = this.diffSegments(this.actualDesign, result);
        this.updatePreview();
      };
      const endHighlight = () => {
        this.highlightedSegments = null;
        this.updatePreview();
      };
      btn.addEventListener("mouseenter", startHighlight);
      btn.addEventListener("mouseleave", endHighlight);
      btn.addEventListener("focus", startHighlight);
      btn.addEventListener("blur", endHighlight);

      // 실제 적용은 클릭에서만
      btn.addEventListener("click", () => { void (async () => {
        this.pushUndo();
        const applied = preset.apply(this.actualDesign, this.referenceSpec());
        this.highlightedSegments = null;
        this.plugin.settings.tableBorderDesign = applied;
        await this.plugin.saveSettings();
        this.updatePreview();
        this.updateEditor();
      })(); });
    }

    // 되돌리기 버튼 — 프리셋 행 우측 끝
    const undoBtn = row.createEl("button", {
      text: "↶",
      cls: "hwpx-preset-action-btn hwpx-undo-btn",
    });
    this.undoBtn = undoBtn;
    this.refreshUndoButton();

    undoBtn.addEventListener("click", () => { void (async () => {
      const prev = this.undoStack.pop();
      if (!prev) return;
      this.highlightedSegments = null;
      this.plugin.settings.tableBorderDesign = prev;
      await this.plugin.saveSettings();
      this.refreshUndoButton();
      this.updatePreview();
      this.updateEditor();
    })(); });
  }

  private renderPreview(parent: HTMLElement): void {
    const box = parent.createDiv("hwpx-border-preview");

    // SVG: viewBox 만 지정, 높이는 CSS 로 aspect-ratio 처리 (SVG height 속성에 "auto" 무효)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 240 160");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "hwpx-border-preview-svg");
    box.appendChild(svg);
    this.svg = svg;
    this.updatePreview();
  }

  private updatePreview(): void {
    const svg = this.svg;
    if (!svg) return;
    svg.replaceChildren();

    // 좌표계: 외곽 (10,10)-(230,150). 헤더 높이 35, 본문 3행 35씩.
    const X0 = 10, X3 = 230;
    const Xs = [10, 83, 157, 230];
    const Yh = 45;  // 헤더와 본문의 경계
    const Ys = [45, 80, 115, 150];

    const d = this.design;

    // 헤더 배경 — 구분 강화
    const headerBgColor = this.plugin.settings.tableHeaderBgColor || "#D5E8F0";
    const headerBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    headerBg.setAttribute("x", String(X0));
    headerBg.setAttribute("y", "10");
    headerBg.setAttribute("width", String(X3 - X0));
    headerBg.setAttribute("height", String(Yh - 10));
    headerBg.setAttribute("fill", headerBgColor);
    headerBg.setAttribute("opacity", "0.55");
    svg.appendChild(headerBg);

    // 헤더 셀 라벨 (L/C/R) — 더 진하게
    for (let c = 0; c < 3; c++) {
      const cx = (Xs[c] + Xs[c + 1]) / 2;
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", String(cx));
      txt.setAttribute("y", "32");
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("fill", "var(--text-normal)");
      txt.setAttribute("font-size", "13");
      txt.setAttribute("font-weight", "bold");
      txt.textContent = ["L", "C", "R"][c];
      svg.appendChild(txt);
    }

    // 본문 영역에 'HEADER' / 'BODY' 라벨로 구분 강조
    const bodyLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    bodyLabel.setAttribute("x", String((X0 + X3) / 2));
    bodyLabel.setAttribute("y", "100");
    bodyLabel.setAttribute("text-anchor", "middle");
    bodyLabel.setAttribute("fill", "var(--text-faint)");
    bodyLabel.setAttribute("font-size", "10");
    bodyLabel.textContent = "본문";
    svg.appendChild(bodyLabel);

    // 선 그리기
    this.drawSegment(svg, "outerTop",     X0, 10,   X3, 10);
    this.drawSegment(svg, "outerBottom",  X0, 150,  X3, 150);
    this.drawSegment(svg, "outerLeft",    X0, 10,   X0, 150);
    this.drawSegment(svg, "outerRight",   X3, 10,   X3, 150);
    this.drawSegment(svg, "headerBottom", X0, Yh,   X3, Yh);
    this.drawSegment(svg, "innerH", X0, Ys[1], X3, Ys[1]);
    this.drawSegment(svg, "innerH", X0, Ys[2], X3, Ys[2]);
    this.drawSegment(svg, "innerV", Xs[1], 10, Xs[1], 150);
    this.drawSegment(svg, "innerV", Xs[2], 10, Xs[2], 150);

    void d;
  }

  private drawSegment(
    svg: SVGSVGElement,
    key: SegmentKey,
    x1: number, y1: number, x2: number, y2: number,
  ): void {
    const spec = this.design[key];
    const isSelected = this.selectedSegment === key;
    const isHighlighted = this.highlightedSegments?.has(key) ?? false;

    // 프리셋 hover 강조: 아래에 두꺼운 glow underlay 깔기
    if (isHighlighted) {
      const glow = document.createElementNS("http://www.w3.org/2000/svg", "line");
      glow.setAttribute("x1", String(x1)); glow.setAttribute("y1", String(y1));
      glow.setAttribute("x2", String(x2)); glow.setAttribute("y2", String(y2));
      glow.setAttribute("stroke", "var(--interactive-accent)");
      glow.setAttribute("stroke-width", "8");
      glow.setAttribute("opacity", "0.45");
      glow.setAttribute("stroke-linecap", "round");
      glow.setAttribute("pointer-events", "none");
      svg.appendChild(glow);
    }

    const isNone = spec.type === "NONE";

    // 실제 선 렌더 — NONE 이면 기본적으로 안 보임
    if (!isNone) {
      this.drawLineByType(svg, spec, x1, y1, x2, y2);
    }

    // NONE 구간용 hover ghost — 기본은 opacity 0 (안 보임), hover 시에만 보이게
    const hoverGhost = document.createElementNS("http://www.w3.org/2000/svg", "line");
    hoverGhost.setAttribute("x1", String(x1)); hoverGhost.setAttribute("y1", String(y1));
    hoverGhost.setAttribute("x2", String(x2)); hoverGhost.setAttribute("y2", String(y2));
    hoverGhost.setAttribute("stroke", "var(--text-muted)");
    hoverGhost.setAttribute("stroke-width", "1");
    hoverGhost.setAttribute("stroke-dasharray", "2 3");
    hoverGhost.setAttribute("opacity", "0");
    hoverGhost.setAttribute("class", "hwpx-svg-hover-ghost");
    svg.appendChild(hoverGhost);

    // 히트박스 (투명) + 선택 표시
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "line");
    hit.setAttribute("x1", String(x1)); hit.setAttribute("y1", String(y1));
    hit.setAttribute("x2", String(x2)); hit.setAttribute("y2", String(y2));
    hit.setAttribute("stroke", isSelected ? "var(--interactive-accent)" : "transparent");
    hit.setAttribute("stroke-width", "10");
    hit.setAttribute("opacity", isSelected ? "0.35" : "1");
    hit.setAttribute("class", "hwpx-svg-hit");
    hit.addEventListener("click", (ev) => {
      ev.stopPropagation();
      // 같은 선 다시 클릭 → 선택 해제. 다른 선 클릭 → 그 선으로 변경.
      this.selectedSegment = this.selectedSegment === key ? null : key;
      this.updatePreview();
      this.updateEditor();
    });
    hit.addEventListener("mouseenter", () => {
      // NONE 구간에 hover 하면 선이 있을 자리를 약한 점선으로 표시
      if (isNone) hoverGhost.setAttribute("opacity", "0.55");
      if (!isSelected) {
        hit.setAttribute("stroke", "var(--background-modifier-hover)");
        hit.setAttribute("opacity", "0.5");
      }
    });
    hit.addEventListener("mouseleave", () => {
      hoverGhost.setAttribute("opacity", "0");
      if (!isSelected) {
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("opacity", "1");
      }
    });
    svg.appendChild(hit);
  }

  /** HWPX 17종 선 종류를 SVG 에서 근사 렌더. */
  private drawLineByType(
    svg: SVGSVGElement,
    spec: BorderLineSpec,
    x1: number, y1: number, x2: number, y2: number,
  ): void {
    const color = spec.color;
    const type = spec.type;

    // 굵기 계산: 굵기 문자열 → 픽셀 근사
    const widthMm = parseFloat(spec.width) || 0.12;
    const baseW = Math.max(0.8, widthMm * 3);  // 0.12mm → ~0.4, 1mm → ~3
    const variableW = variableWeight(type);
    const strokeW = variableW ?? baseW;

    const addLine = (offsetX: number, offsetY: number, w: number) => {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(x1 + offsetX)); line.setAttribute("y1", String(y1 + offsetY));
      line.setAttribute("x2", String(x2 + offsetX)); line.setAttribute("y2", String(y2 + offsetY));
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", String(w));
      const dash = dashPattern(type);
      if (dash) line.setAttribute("stroke-dasharray", dash);
      line.setAttribute("pointer-events", "none");
      svg.appendChild(line);
      return line;
    };

    if (isDoubleLine(type)) {
      // 수평/수직에 따라 offset 방향 다름
      const isHorizontal = Math.abs(y2 - y1) < 0.01;
      const o = isHorizontal ? [0, -1.5, 0, 1.5] : [-1.5, 0, 1.5, 0];
      addLine(o[0], o[1], 1);
      addLine(o[2], o[3], 1);
    } else if (type === "WAVE" || type === "DOUBLE_WAVE") {
      // 물결: path 로 근사
      this.drawWave(svg, x1, y1, x2, y2, color, type === "DOUBLE_WAVE");
    } else if (type === "CIRCLE") {
      // 원형: 원 점선
      addLine(0, 0, strokeW);
    } else if (type === "THICK3D" || type === "NEGATIVE3D") {
      // 3D 효과: 두 줄 다른 색으로 근사 (단순화)
      addLine(0, 0, strokeW);
    } else {
      // SOLID / DASH / DOT / DASH_DOT / DASH_DOT_DOT / LONG_DASH / CLIPPING / SLIM_* / ...
      addLine(0, 0, strokeW);
    }
  }

  private drawWave(
    svg: SVGSVGElement,
    x1: number, y1: number, x2: number, y2: number,
    color: string, double: boolean,
  ): void {
    const isHorizontal = Math.abs(y2 - y1) < 0.01;
    const len = isHorizontal ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
    const period = 4;
    const amp = 1.2;
    let d = `M ${x1} ${y1}`;
    const steps = Math.floor(len / period);
    for (let i = 0; i < steps; i++) {
      const ratio = (i + 1) / steps;
      const cx = x1 + (x2 - x1) * ratio;
      const cy = y1 + (y2 - y1) * ratio;
      const bump = i % 2 === 0 ? amp : -amp;
      if (isHorizontal) {
        d += ` Q ${cx - (x2 - x1) / steps / 2} ${y1 + bump} ${cx} ${cy}`;
      } else {
        d += ` Q ${x1 + bump} ${cy - (y2 - y1) / steps / 2} ${cx} ${cy}`;
      }
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "1");
    path.setAttribute("fill", "none");
    path.setAttribute("pointer-events", "none");
    svg.appendChild(path);
    if (double) {
      const p2 = path.cloneNode() as SVGPathElement;
      // 두 번째 파동은 살짝 offset
      const offsetAttr = isHorizontal ? "translate(0, 2)" : "translate(2, 0)";
      p2.setAttribute("transform", offsetAttr);
      svg.appendChild(p2);
    }
  }

  private renderEditor(parent: HTMLElement): void {
    this.editorEl = parent.createDiv("hwpx-border-editor");
    this.updateEditor();
  }

  private updateEditor(): void {
    const el = this.editorEl;
    if (!el) return;
    el.empty();

    // 편집 대상 결정:
    //   - 선택된 구간이 있으면 그 구간의 spec 을 편집 (변경 시 settings 저장 + undo)
    //   - 없으면 pendingRef (메모리 상태) 를 편집 — 프리셋의 기준으로 사용됨
    const editingSelection = !!this.selectedSegment;
    const spec: BorderLineSpec = editingSelection
      ? this.design[this.selectedSegment!]
      : this.pendingRef;

    // 헤더: 무엇을 편집 중인지 + 미니 프리뷰 선
    const header = el.createDiv("hwpx-border-editor-header");

    const labelText = editingSelection
      ? `선택: ${SEGMENT_LABELS[this.selectedSegment!]}`
      : "기본 선 스타일";
    const labelEl = header.createEl("div");
    labelEl.createEl("strong", { text: labelText, cls: "hwpx-border-editor-strong" });
    if (!editingSelection) {
      header.createEl("span", {
        text: "(프리셋이 이 스타일로 적용)",
        cls: "hwpx-border-editor-hint",
      });
    }

    // 미니 프리뷰 — 현재 spec 을 짧은 SVG 선으로 렌더해 "지금 어떤 선인지" 즉시 보여줌
    const miniSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    miniSvg.setAttribute("viewBox", "0 0 60 10");
    miniSvg.setAttribute("width", "60");
    miniSvg.setAttribute("class", "hwpx-border-mini-svg");
    this.drawLineByType(miniSvg, spec, 2, 5, 58, 5);
    header.appendChild(miniSvg);

    // ── 컨트롤 ─────────────────────────────────────────────
    const mkRow = (): HTMLElement => el.createDiv("hwpx-border-editor-row");

    // 변경 커밋 — 선택 편집이면 saveSettings + undo, pendingRef 면 그냥 상태만.
    const commit = async (mutate: () => void, shouldUndo: boolean = true) => {
      if (editingSelection && shouldUndo) this.pushUndo();
      mutate();
      if (editingSelection) await this.plugin.saveSettings();
      this.updatePreview();
    };

    // 종류
    const typeRow = mkRow();
    typeRow.createEl("span", { text: "종류", cls: "hwpx-border-editor-label" });
    const typeSel = typeRow.createEl("select", { cls: "hwpx-select-sm" });
    for (const [val, lbl] of BORDER_TYPE_LABELS) {
      typeSel.createEl("option", { text: lbl, value: val });
    }
    typeSel.value = spec.type;
    typeSel.addEventListener("change", () => { void (async () => {
      await commit(() => { spec.type = typeSel.value as BorderLineType; });
      this.updateEditor();
    })(); });

    // 색
    const colorRow = mkRow();
    colorRow.createEl("span", { text: "색", cls: "hwpx-border-editor-label" });
    const colorInput = colorRow.createEl("input", { cls: "hwpx-border-color-input", attr: { type: "color" } });
    colorInput.value = spec.color;
    const colorBeforeDrag = { value: spec.color };
    colorInput.addEventListener("mousedown", () => { colorBeforeDrag.value = spec.color; });
    const repaintMini = () => {
      miniSvg.replaceChildren();
      this.drawLineByType(miniSvg, spec, 2, 5, 58, 5);
    };
    colorInput.addEventListener("input", () => {
      spec.color = colorInput.value;
      this.updatePreview();
      repaintMini();
    });
    colorInput.addEventListener("change", () => { void (async () => {
      if (editingSelection && colorInput.value !== colorBeforeDrag.value && this.selectedSegment) {
        const snapshot = structuredClone(this.actualDesign);
        snapshot[this.selectedSegment].color = colorBeforeDrag.value;
        this.undoStack.push(snapshot);
        this.refreshUndoButton();
      }
      spec.color = colorInput.value;
      if (editingSelection) await this.plugin.saveSettings();
      this.updatePreview();
      this.updateEditor();
    })(); });

    // 굵기
    const widthRow = mkRow();
    widthRow.createEl("span", { text: "굵기", cls: "hwpx-border-editor-label" });
    const widthSel = widthRow.createEl("select", { cls: "hwpx-select-sm" });
    for (const w of BORDER_WIDTHS) {
      widthSel.createEl("option", { text: w, value: w });
    }
    if (!(BORDER_WIDTHS as readonly string[]).includes(spec.width)) {
      widthSel.createEl("option", { text: `${spec.width} (사용자)`, value: spec.width });
    }
    widthSel.value = spec.width;
    widthSel.addEventListener("change", () => { void (async () => {
      await commit(() => { spec.width = widthSel.value; });
      this.updateEditor();
    })(); });

    // 선택이 없는 상태에서의 부가 안내
    if (!editingSelection) {
      el.createEl("div", {
        text: "프리뷰의 선을 클릭하면 그 선 하나만 편집할 수 있습니다.",
        cls: "hwpx-border-editor-tip",
      });
    }
  }
}
