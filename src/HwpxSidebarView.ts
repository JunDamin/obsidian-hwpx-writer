import { ItemView, WorkspaceLeaf, MarkdownView, Notice } from "obsidian";
import type HwpxWriterPlugin from "./main";
import type { ListLevelStyle } from "./settings";
import { convertMarkdownToHwpx } from "./converter/MarkdownToHwpx";
import { TemplateEditorModal } from "./TemplateEditorModal";
import { detectEnvironment, canUsePreview, openInHancom, EnvironmentInfo } from "./environment";
import { parseFrontmatter, applyFrontmatterOverrides } from "./frontmatter";

export const VIEW_TYPE_HWPX = "hwpx-writer-view";

export class HwpxSidebarView extends ItemView {
  plugin: HwpxWriterPlugin;
  private previewEl: HTMLElement | null = null;
  private pageInfoEl: HTMLElement | null = null;
  private resultEl: HTMLElement | null = null;
  private debounceTimer: number | null = null;
  private currentPage = 0;
  private totalPages = 0;
  private rhwpDoc: any = null;
  private rhwpInitialized = false;
  private env: EnvironmentInfo | null = null;
  private lastHwpxBytes: Uint8Array | null = null;
  private currentHeadingIdx = 0;
  private currentBodyTabIdx = 0;
  private currentListLevelIdx = 0;

  constructor(leaf: WorkspaceLeaf, plugin: HwpxWriterPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_HWPX;
  }

  getDisplayText(): string {
    return "HWPX Writer";
  }

  getIcon(): string {
    return "file-output";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hwpx-sidebar");

    // 환경 감지 후 UI 빌드
    this.env = await detectEnvironment(this.app, this.plugin.manifest.dir || "");
    console.log("[HWPX Writer] Environment:", this.env);

    this.buildUI(container);
  }

  async onClose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private buildUI(container: HTMLElement) {
    // ── 미리보기 영역 (환경에 따라 다르게) ──
    const previewSection = container.createDiv("hwpx-preview-section");
    this.previewEl = previewSection.createDiv("hwpx-preview-canvas");

    const env = this.env;
    const previewEnabled = this.plugin.settings.showPreview && env && canUsePreview(env);

    if (!previewEnabled) {
      // 미리보기 비활성화 — 환경 정보 + 대체 버튼 표시
      this.renderPreviewDisabled();
    } else {
      this.previewEl.setText("미리보기 준비 중... (🔄 버튼을 눌러 생성)");
    }

    // 페이지 네비게이션 (미리보기 활성 시에만)
    if (previewEnabled) {
      const previewNav = previewSection.createDiv("hwpx-preview-nav");
      previewNav.createEl("button", { text: "◀", cls: "hwpx-nav-btn" })
        .addEventListener("click", () => this.prevPage());
      this.pageInfoEl = previewNav.createEl("span", { text: "- / -", cls: "hwpx-page-info" });
      previewNav.createEl("button", { text: "▶", cls: "hwpx-nav-btn" })
        .addEventListener("click", () => this.nextPage());
    }

    // 미리보기/대체 버튼 행
    const previewBtnRow = previewSection.createDiv("hwpx-preview-btn-row");
    if (previewEnabled) {
      const previewBtn = previewBtnRow.createEl("button", {
        text: "🔄 미리보기 생성",
        cls: "hwpx-preview-btn",
      });
      previewBtn.addEventListener("click", () => this.refreshPreview());
    }

    // 환경별 대체 버튼: 한컴오피스가 있으면 "한컴에서 미리보기" 제공
    if (env?.electronAvailable) {
      const hancomBtn = previewBtnRow.createEl("button", {
        text: env.hancomInstalled ? "🖨️ 한컴에서 미리보기" : "📄 외부 뷰어로 열기",
        cls: "hwpx-preview-btn",
      });
      hancomBtn.addEventListener("click", () => this.previewInHancom());
    }

    // 미리보기가 꺼진 경우 켜기 버튼 제공
    if (!previewEnabled && env?.wasmAvailable) {
      const enableBtn = previewBtnRow.createEl("button", {
        text: "🔄 미리보기 다시 켜기",
        cls: "hwpx-preview-btn",
      });
      enableBtn.addEventListener("click", async () => {
        this.plugin.settings.showPreview = true;
        await this.plugin.saveSettings();
        if (this.env) this.env.renderFailCount = 0;
        this.rebuildUI();
      });
    }

    // ── 변환 버튼 ──
    const convertSection = container.createDiv("hwpx-convert-section");

    // 프리셋 선택
    const presetRow = convertSection.createDiv("hwpx-preset-row");
    presetRow.createEl("span", { text: "프리셋:" });
    const presetSelect = presetRow.createEl("select", { cls: "hwpx-template-select" });
    this.refreshPresetList(presetSelect);
    presetSelect.addEventListener("change", async () => {
      const name = (presetSelect as HTMLSelectElement).value;
      if (name && name !== "__custom__") {
        await this.applyPreset(name);
      }
    });

    // 프리셋 저장/삭제 버튼
    const presetBtnRow = convertSection.createDiv("hwpx-preset-btns");
    const savePresetBtn = presetBtnRow.createEl("button", { text: "💾 현재 설정 저장", cls: "hwpx-action-btn" });
    savePresetBtn.addEventListener("click", async () => {
      const name = prompt("프리셋 이름을 입력하세요:");
      if (!name) return;
      // 현재 설정을 프리셋으로 저장 (presets, activePreset, templates 제외)
      const { presets, activePreset, templates, ...settingsToSave } = this.plugin.settings;
      this.plugin.settings.presets[name] = { ...settingsToSave };
      this.plugin.settings.activePreset = name;
      await this.plugin.saveSettings();
      this.refreshPresetList(presetSelect);
      (presetSelect as HTMLSelectElement).value = name;
      new Notice(`✅ 프리셋 "${name}" 저장됨`);
    });
    const exportPresetBtn = presetBtnRow.createEl("button", { text: "📤", cls: "hwpx-action-btn", attr: { title: "프리셋 내보내기 (JSON)" } });
    exportPresetBtn.addEventListener("click", async () => {
      const name = (presetSelect as HTMLSelectElement).value;
      if (!name || name === "__custom__") { new Notice("프리셋을 선택하세요."); return; }
      const preset = this.plugin.settings.presets[name];
      if (!preset) return;
      const json = JSON.stringify({ name, settings: preset }, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `hwpx-preset-${name}.json`; a.click();
      URL.revokeObjectURL(url);
      new Notice(`📤 프리셋 "${name}" 내보내기 완료`);
    });

    const importPresetBtn = presetBtnRow.createEl("button", { text: "📥", cls: "hwpx-action-btn", attr: { title: "프리셋 불러오기 (JSON)" } });
    importPresetBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const data = JSON.parse(text);
          const name = data.name || file.name.replace(/\.json$/, "");
          this.plugin.settings.presets[name] = data.settings || data;
          await this.plugin.saveSettings();
          this.refreshPresetList(presetSelect);
          new Notice(`📥 프리셋 "${name}" 불러오기 완료`);
        } catch (e) {
          new Notice("❌ 잘못된 프리셋 파일");
        }
      });
      input.click();
    });

    const deletePresetBtn = presetBtnRow.createEl("button", { text: "🗑", cls: "hwpx-action-btn", attr: { title: "선택된 프리셋 삭제" } });
    deletePresetBtn.addEventListener("click", async () => {
      const name = (presetSelect as HTMLSelectElement).value;
      if (!name || name === "__custom__" || name === "기본") {
        new Notice("기본 프리셋은 삭제할 수 없습니다.");
        return;
      }
      delete this.plugin.settings.presets[name];
      this.plugin.settings.activePreset = "기본";
      await this.plugin.saveSettings();
      this.refreshPresetList(presetSelect);
      new Notice(`🗑 프리셋 "${name}" 삭제됨`);
    });

    // 템플릿 선택 (HWPX 파일)
    const templateRow = convertSection.createDiv("hwpx-template-row");
    templateRow.createEl("span", { text: "템플릿:" });
    const templateSelect = templateRow.createEl("select", { cls: "hwpx-template-select" });
    templateSelect.createEl("option", { text: "기본 양식", value: "default" });

    const exportBtn = convertSection.createEl("button", {
      text: "📄 HWPX로 내보내기",
      cls: "hwpx-export-btn",
    });
    exportBtn.addEventListener("click", () => this.plugin.exportCurrentFile());

    // ── 내보내기 결과 영역 ──
    this.resultEl = convertSection.createDiv("hwpx-result-section");
    this.resultEl.style.display = "none";

    // ── 접이식 설정 섹션들 ──
    this.buildCollapsibleSection(container, "페이지 설정", (el) => {
      this.buildPageSettings(el);
    });

    this.buildCollapsibleSection(container, "헤딩 스타일", (el) => {
      this.buildStyleSettings(el);
    });

    this.buildCollapsibleSection(container, "본문 스타일", (el) => {
      this.buildBodyStyleSection(el);
    });

    this.buildCollapsibleSection(container, "프리셋 관리", (el) => {
      this.buildPresetManager(el);
    });

    this.buildCollapsibleSection(container, "템플릿 관리", (el) => {
      this.buildTemplateManager(el);
    });
  }

  private buildCollapsibleSection(
    parent: HTMLElement,
    title: string,
    buildContent: (el: HTMLElement) => void,
  ) {
    const section = parent.createDiv("hwpx-collapsible");
    const header = section.createDiv("hwpx-collapsible-header");
    const arrow = header.createEl("span", { text: "▶", cls: "hwpx-arrow" });
    header.createEl("span", { text: title });

    const content = section.createDiv("hwpx-collapsible-content");
    content.style.display = "none";
    buildContent(content);

    header.addEventListener("click", () => {
      const isOpen = content.style.display !== "none";
      content.style.display = isOpen ? "none" : "block";
      arrow.setText(isOpen ? "▶" : "▼");
    });
  }

  private buildPageSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 용지 크기 버튼 그룹
    const paperRow = el.createDiv("hwpx-setting-row");
    paperRow.createEl("span", { text: "용지" });
    const paperBtns = paperRow.createDiv("hwpx-btn-group");
    for (const size of ["A4", "B5", "Letter"] as const) {
      const btn = paperBtns.createEl("button", {
        text: size,
        cls: `hwpx-toggle-btn ${s.paperSize === size ? "active" : ""}`,
      });
      btn.addEventListener("click", async () => {
        this.plugin.settings.paperSize = size;
        await this.plugin.saveSettings();
        paperBtns.querySelectorAll("button").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    }

    // 방향 토글
    const dirRow = el.createDiv("hwpx-setting-row");
    dirRow.createEl("span", { text: "방향" });
    const dirBtns = dirRow.createDiv("hwpx-btn-group");
    for (const [label, val] of [["세로", false], ["가로", true]] as const) {
      const btn = dirBtns.createEl("button", {
        text: label,
        cls: `hwpx-toggle-btn ${s.landscape === val ? "active" : ""}`,
      });
      btn.addEventListener("click", async () => {
        this.plugin.settings.landscape = val;
        await this.plugin.saveSettings();
        dirBtns.querySelectorAll("button").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
      });
    }

    // 여백
    el.createEl("div", { text: "여백 (mm)", cls: "hwpx-label" });
    const marginGrid = el.createDiv("hwpx-margin-grid");
    for (const [label, key] of [
      ["좌", "marginLeft"], ["우", "marginRight"],
      ["상", "marginTop"], ["하", "marginBottom"],
    ] as const) {
      const cell = marginGrid.createDiv("hwpx-margin-cell");
      cell.createEl("span", { text: label });
      const input = cell.createEl("input", {
        type: "number",
        cls: "hwpx-num-input",
        value: String((s as any)[key]),
      });
      input.addEventListener("change", async () => {
        (this.plugin.settings as any)[key] = Number(input.value) || 15;
        await this.plugin.saveSettings();
      });
    }
  }

  private buildStyleSettings(el: HTMLElement) {
    // 탭 버튼 (H1~H6)
    const tabRow = el.createDiv("hwpx-heading-tabs");
    const panel = el.createDiv("hwpx-heading-panel");
    const buttons: HTMLButtonElement[] = [];
    for (let i = 0; i < 6; i++) {
      const btn = tabRow.createEl("button", {
        text: `H${i + 1}`,
        cls: `hwpx-heading-tab ${i === this.currentHeadingIdx ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.currentHeadingIdx = i;
        buttons.forEach((b, bi) => b.toggleClass("active", bi === i));
        this.renderHeadingPanel(panel);
      });
      buttons.push(btn);
    }

    this.renderHeadingPanel(panel);
  }

  /** 선택된 H{n}의 상세 설정 + 미리보기 패널 렌더링 */
  private renderHeadingPanel(panel: HTMLElement) {
    panel.empty();
    const i = this.currentHeadingIdx;
    const s = this.plugin.settings;
    const hs = s.headingStyles[i];
    if (!hs) return;

    // 미리보기 박스
    const preview = panel.createDiv("hwpx-heading-preview");
    const previewText = preview.createEl("div", { cls: "hwpx-heading-preview-text" });
    const updatePreview = () => {
      const latest = this.plugin.settings.headingStyles[i];
      const fontName = latest.fontName || this.plugin.settings.fontHangul || "맑은 고딕";
      previewText.setText(`H${i + 1} 헤딩 미리보기`);
      previewText.style.fontSize = `${latest.fontSize}pt`;
      previewText.style.fontWeight = latest.bold ? "700" : "400";
      previewText.style.fontStyle = latest.italic ? "italic" : "normal";
      previewText.style.color = latest.color || "#000000";
      previewText.style.fontFamily = `"${fontName}", sans-serif`;
    };
    updatePreview();

    // 폰트 입력 (빈 문자열이면 본문 폰트 사용)
    const fontRow = panel.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트", cls: "hwpx-heading-field-label" });
    const fontInput = fontRow.createEl("input", {
      type: "text", cls: "hwpx-text-input",
      value: hs.fontName || "",
      attr: { placeholder: `(본문: ${s.fontHangul || "맑은 고딕"})` },
    });
    fontInput.addEventListener("input", async () => {
      this.plugin.settings.headingStyles[i].fontName = fontInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 크기 + 색상
    const sizeRow = panel.createDiv("hwpx-setting-row");
    sizeRow.createEl("span", { text: "크기", cls: "hwpx-heading-field-label" });
    const fsInput = sizeRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm", value: String(hs.fontSize),
    });
    fsInput.addEventListener("change", async () => {
      this.plugin.settings.headingStyles[i].fontSize = Number(fsInput.value) || 10;
      await this.plugin.saveSettings();
      updatePreview();
    });
    sizeRow.createEl("span", { text: "pt", cls: "hwpx-unit" });
    sizeRow.createEl("span", { text: "  색상", cls: "hwpx-heading-field-label" });
    const colorInput = sizeRow.createEl("input", {
      type: "color", cls: "hwpx-color-input", value: hs.color || "#000000",
    });
    colorInput.addEventListener("change", async () => {
      this.plugin.settings.headingStyles[i].color = colorInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 스타일 토글 (B / I / 페이지 나누기)
    const toggleRow = panel.createDiv("hwpx-setting-row");
    toggleRow.createEl("span", { text: "스타일", cls: "hwpx-heading-field-label" });
    const boldBtn = toggleRow.createEl("button", {
      text: "B", cls: `hwpx-toggle-btn hwpx-bold-btn ${hs.bold ? "active" : ""}`,
      attr: { title: "굵게" },
    });
    boldBtn.addEventListener("click", async () => {
      const v = !this.plugin.settings.headingStyles[i].bold;
      this.plugin.settings.headingStyles[i].bold = v;
      boldBtn.toggleClass("active", v);
      await this.plugin.saveSettings();
      updatePreview();
    });
    const italicBtn = toggleRow.createEl("button", {
      text: "I", cls: `hwpx-toggle-btn ${hs.italic ? "active" : ""}`,
      attr: { style: "font-style:italic", title: "기울임" },
    });
    italicBtn.addEventListener("click", async () => {
      const v = !this.plugin.settings.headingStyles[i].italic;
      this.plugin.settings.headingStyles[i].italic = v;
      italicBtn.toggleClass("active", v);
      await this.plugin.saveSettings();
      updatePreview();
    });
    const pbBtn = toggleRow.createEl("button", {
      text: "↵ 페이지", cls: `hwpx-toggle-btn ${hs.pageBreakBefore ? "active" : ""}`,
      attr: { title: "헤딩 앞에서 페이지 나누기" },
    });
    pbBtn.addEventListener("click", async () => {
      const v = !this.plugin.settings.headingStyles[i].pageBreakBefore;
      this.plugin.settings.headingStyles[i].pageBreakBefore = v;
      pbBtn.toggleClass("active", v);
      await this.plugin.saveSettings();
    });

    // 빈 줄 앞/뒤/높이
    const blankRow = panel.createDiv("hwpx-setting-row");
    blankRow.createEl("span", { text: "빈 줄", cls: "hwpx-heading-field-label" });
    blankRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    this.addNumInput(blankRow, hs.blankLinesBefore ?? 0, "", (v) => {
      this.plugin.settings.headingStyles[i].blankLinesBefore = v;
    });
    blankRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    this.addNumInput(blankRow, hs.blankLinesAfter ?? 0, "", (v) => {
      this.plugin.settings.headingStyles[i].blankLinesAfter = v;
    });
    blankRow.createEl("span", { text: "높이", cls: "hwpx-unit", attr: { title: "0=본문 크기 사용" } });
    this.addNumInput(blankRow, hs.blankLineHeight ?? 0, "pt", (v) => {
      this.plugin.settings.headingStyles[i].blankLineHeight = v;
    });

    // 문단 간격 앞/뒤 (mm)
    const spaceRow = panel.createDiv("hwpx-setting-row");
    spaceRow.createEl("span", { text: "문단 간격", cls: "hwpx-heading-field-label" });
    spaceRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    this.addNumInput(spaceRow, hs.spaceBefore ?? 0, "mm", (v) => {
      this.plugin.settings.headingStyles[i].spaceBefore = v;
    });
    spaceRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    this.addNumInput(spaceRow, hs.spaceAfter ?? 0, "mm", (v) => {
      this.plugin.settings.headingStyles[i].spaceAfter = v;
    });

    // 다른 레벨로 복사 버튼
    const copyRow = panel.createDiv("hwpx-setting-row");
    copyRow.createEl("span", { text: "복사", cls: "hwpx-heading-field-label" });
    for (let j = 0; j < 6; j++) {
      if (j === i) continue;
      const btn = copyRow.createEl("button", {
        text: `→H${j + 1}`, cls: "hwpx-toggle-btn",
        attr: { title: `현재 H${i + 1} 설정을 H${j + 1}에 복사` },
      });
      btn.addEventListener("click", async () => {
        this.plugin.settings.headingStyles[j] = { ...this.plugin.settings.headingStyles[i] };
        await this.plugin.saveSettings();
        new Notice(`H${i + 1} → H${j + 1} 복사 완료`);
      });
    }
  }

  private buildTableSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 머리행
    el.createEl("div", { text: "머리행", cls: "hwpx-label" });
    const hdrRow = el.createDiv("hwpx-setting-row");
    hdrRow.createEl("span", { text: "배경" });
    this.addColorInput(hdrRow, s.tableHeaderBgColor, (v) => { this.plugin.settings.tableHeaderBgColor = v; });
    this.addNumInput(hdrRow, s.tableHeaderFontSize, "pt", (v) => { this.plugin.settings.tableHeaderFontSize = v; });
    const hdrBoldBtn = hdrRow.createEl("button", { text: "B", cls: `hwpx-toggle-btn hwpx-bold-btn ${s.tableHeaderBold ? "active" : ""}` });
    hdrBoldBtn.addEventListener("click", async () => {
      this.plugin.settings.tableHeaderBold = !this.plugin.settings.tableHeaderBold;
      hdrBoldBtn.toggleClass("active", this.plugin.settings.tableHeaderBold);
      await this.plugin.saveSettings();
    });

    // 본문 크기
    const bodyRow = el.createDiv("hwpx-setting-row");
    bodyRow.createEl("span", { text: "본문" });
    this.addNumInput(bodyRow, s.tableBodyFontSize, "pt", (v) => { this.plugin.settings.tableBodyFontSize = v; });

    // 반복
    const repeatRow = el.createDiv("hwpx-setting-row");
    this.addCheckbox(repeatRow, s.tableRepeatHeader, "머리행 반복", (v) => { this.plugin.settings.tableRepeatHeader = v; });

    // 테두리
    el.createEl("div", { text: "테두리", cls: "hwpx-label" });
    const borderRow = el.createDiv("hwpx-setting-row");
    const borderSelect = borderRow.createEl("select", { cls: "hwpx-select-sm" });
    for (const [val, label] of [["SOLID", "실선"], ["DASH", "파선"], ["DOT", "점선"], ["NONE", "없음"]]) {
      borderSelect.createEl("option", { text: label, value: val });
    }
    (borderSelect as HTMLSelectElement).value = s.tableBorderStyle;
    borderSelect.addEventListener("change", async () => {
      this.plugin.settings.tableBorderStyle = (borderSelect as HTMLSelectElement).value;
      await this.plugin.saveSettings();
    });
    this.addColorInput(borderRow, s.tableBorderColor, (v) => { this.plugin.settings.tableBorderColor = v; });

    // 셀 여백
    const padRow = el.createDiv("hwpx-setting-row");
    padRow.createEl("span", { text: "셀 여백" });
    padRow.createEl("span", { text: "좌우", cls: "hwpx-unit" });
    this.addNumInput(padRow, s.tableCellPaddingH, "mm", (v) => { this.plugin.settings.tableCellPaddingH = v; });
    padRow.createEl("span", { text: "상하", cls: "hwpx-unit" });
    this.addNumInput(padRow, s.tableCellPaddingV, "mm", (v) => { this.plugin.settings.tableCellPaddingV = v; });
  }

  // ── 헬퍼 메서드 ──

  private addNumInput(parent: HTMLElement, value: number, unit: string, onChange: (v: number) => void) {
    const input = parent.createEl("input", { type: "number", cls: "hwpx-num-input-sm", value: String(value) });
    parent.createEl("span", { text: unit, cls: "hwpx-unit" });
    input.addEventListener("change", async () => {
      onChange(Number(input.value) || 0);
      await this.plugin.saveSettings();
    });
    return input;
  }

  private addColorInput(parent: HTMLElement, value: string, onChange: (v: string) => void) {
    const input = parent.createEl("input", { type: "color", cls: "hwpx-color-input-sm", value });
    input.addEventListener("change", async () => {
      onChange(input.value);
      await this.plugin.saveSettings();
    });
    return input;
  }

  private addCheckbox(parent: HTMLElement, value: boolean, label: string, onChange: (v: boolean) => void) {
    const cb = parent.createEl("input", { type: "checkbox" });
    (cb as HTMLInputElement).checked = value;
    parent.createEl("span", { text: ` ${label}`, cls: "hwpx-unit" });
    cb.addEventListener("change", async () => {
      onChange((cb as HTMLInputElement).checked);
      await this.plugin.saveSettings();
    });
  }

  private buildBodySettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 정렬
    const alignRow = el.createDiv("hwpx-setting-row");
    alignRow.createEl("span", { text: "정렬" });
    const alignBtns = alignRow.createDiv("hwpx-btn-group");
    for (const [label, val] of [["양쪽", "JUSTIFY"], ["좌", "LEFT"], ["중앙", "CENTER"], ["우", "RIGHT"]] as const) {
      const btn = alignBtns.createEl("button", { text: label, cls: `hwpx-toggle-btn ${s.bodyAlign === val ? "active" : ""}` });
      btn.addEventListener("click", async () => {
        this.plugin.settings.bodyAlign = val;
        await this.plugin.saveSettings();
        alignBtns.querySelectorAll("button").forEach(b => b.removeClass("active"));
        btn.addClass("active");
      });
    }

    // 첫줄 들여쓰기
    const indentRow = el.createDiv("hwpx-setting-row");
    indentRow.createEl("span", { text: "첫줄 들여쓰기" });
    this.addNumInput(indentRow, s.bodyIndent, "mm", (v) => { this.plugin.settings.bodyIndent = v; });

    // 문단 간격
    const spRow = el.createDiv("hwpx-setting-row");
    spRow.createEl("span", { text: "간격" });
    spRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    this.addNumInput(spRow, s.bodySpacingBefore, "mm", (v) => { this.plugin.settings.bodySpacingBefore = v; });
    spRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    this.addNumInput(spRow, s.bodySpacingAfter, "mm", (v) => { this.plugin.settings.bodySpacingAfter = v; });
  }

  private buildListSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    // 글머리표 문자
    const bulletRow = el.createDiv("hwpx-setting-row");
    bulletRow.createEl("span", { text: "글머리표" });
    const bulletInput = bulletRow.createEl("input", { cls: "hwpx-text-input", value: s.listBulletChars });
    bulletInput.setAttribute("placeholder", "ㅇ,-,∙,●");
    bulletInput.addEventListener("change", async () => {
      this.plugin.settings.listBulletChars = bulletInput.value;
      await this.plugin.saveSettings();
    });

    // 들여쓰기
    const indentRow = el.createDiv("hwpx-setting-row");
    indentRow.createEl("span", { text: "들여쓰기/레벨" });
    this.addNumInput(indentRow, s.listIndentPerLevel, "mm", (v) => { this.plugin.settings.listIndentPerLevel = v; });

    // 글꼴 크기
    const fsRow = el.createDiv("hwpx-setting-row");
    fsRow.createEl("span", { text: "글꼴 크기" });
    this.addNumInput(fsRow, s.listFontSize, "pt", (v) => { this.plugin.settings.listFontSize = v; });
  }

  private buildCodeSettings(el: HTMLElement) {
    const s = this.plugin.settings;

    const fontRow = el.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트" });
    const fontInput = fontRow.createEl("input", { cls: "hwpx-text-input", value: s.codeFontName });
    fontInput.addEventListener("change", async () => {
      this.plugin.settings.codeFontName = fontInput.value;
      await this.plugin.saveSettings();
    });

    const fsRow = el.createDiv("hwpx-setting-row");
    fsRow.createEl("span", { text: "크기" });
    this.addNumInput(fsRow, s.codeFontSize, "pt", (v) => { this.plugin.settings.codeFontSize = v; });
  }

  private buildBodyStyleSection(el: HTMLElement) {
    const tabLabels = ["본문", "리스트", "표", "코드"];
    const tabRow = el.createDiv("hwpx-style-tabs");
    tabRow.style.gridTemplateColumns = "repeat(4, 1fr)";
    const panel = el.createDiv("hwpx-heading-panel");
    const buttons: HTMLButtonElement[] = [];

    for (let t = 0; t < tabLabels.length; t++) {
      const btn = tabRow.createEl("button", {
        text: tabLabels[t],
        cls: `hwpx-style-tab ${t === this.currentBodyTabIdx ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.currentBodyTabIdx = t;
        buttons.forEach((b, bi) => b.toggleClass("active", bi === t));
        this.renderBodyStylePanel(panel);
      });
      buttons.push(btn);
    }

    this.renderBodyStylePanel(panel);
  }

  private renderBodyStylePanel(panel: HTMLElement) {
    panel.empty();
    switch (this.currentBodyTabIdx) {
      case 0:
        this.renderBodyTab(panel);
        break;
      case 1:
        this.renderListTab(panel);
        break;
      case 2:
        this.buildTableSettings(panel);
        break;
      case 3:
        this.buildCodeSettings(panel);
        break;
    }
  }

  private renderBodyTab(panel: HTMLElement) {
    const s = this.plugin.settings;

    // 미리보기 박스
    const preview = panel.createDiv("hwpx-heading-preview");
    const previewText = preview.createEl("div", { cls: "hwpx-heading-preview-text" });
    const updatePreview = () => {
      const latest = this.plugin.settings;
      const fontName = latest.fontHangul || "맑은 고딕";
      previewText.setText("본문 미리보기 텍스트");
      previewText.style.fontSize = `${latest.bodyFontSize}pt`;
      previewText.style.fontWeight = "400";
      previewText.style.fontFamily = `"${fontName}", sans-serif`;
    };
    updatePreview();

    // 한글 폰트
    const hangulRow = panel.createDiv("hwpx-setting-row");
    hangulRow.createEl("span", { text: "한글 폰트" });
    const hangulInput = hangulRow.createEl("input", {
      cls: "hwpx-text-input",
      value: s.fontHangul,
      attr: { placeholder: "맑은 고딕" },
    });
    hangulInput.addEventListener("change", async () => {
      this.plugin.settings.fontHangul = hangulInput.value;
      this.plugin.settings.bodyFont = hangulInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 영문 폰트
    const latinRow = panel.createDiv("hwpx-setting-row");
    latinRow.createEl("span", { text: "영문 폰트" });
    const latinInput = latinRow.createEl("input", {
      cls: "hwpx-text-input",
      value: s.fontLatin,
      attr: { placeholder: s.fontHangul || "맑은 고딕" },
    });
    latinInput.addEventListener("change", async () => {
      this.plugin.settings.fontLatin = latinInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 크기
    const sizeRow = panel.createDiv("hwpx-setting-row");
    sizeRow.createEl("span", { text: "크기" });
    const sizeInput = sizeRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm", value: String(s.bodyFontSize),
    });
    sizeInput.addEventListener("change", async () => {
      this.plugin.settings.bodyFontSize = Number(sizeInput.value) || 10;
      await this.plugin.saveSettings();
      updatePreview();
    });
    sizeRow.createEl("span", { text: "pt", cls: "hwpx-unit" });

    // 줄간격
    const lsRow = panel.createDiv("hwpx-setting-row");
    lsRow.createEl("span", { text: "줄간격" });
    const lsInput = lsRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm", value: String(s.lineSpacing),
    });
    lsInput.addEventListener("change", async () => {
      this.plugin.settings.lineSpacing = Number(lsInput.value) || 160;
      await this.plugin.saveSettings();
      updatePreview();
    });
    lsRow.createEl("span", { text: "%", cls: "hwpx-unit" });

    // 정렬
    const alignRow = panel.createDiv("hwpx-setting-row");
    alignRow.createEl("span", { text: "정렬" });
    const alignBtns = alignRow.createDiv("hwpx-btn-group");
    for (const [label, val] of [["양쪽", "JUSTIFY"], ["좌", "LEFT"], ["중앙", "CENTER"], ["우", "RIGHT"]] as const) {
      const btn = alignBtns.createEl("button", { text: label, cls: `hwpx-toggle-btn ${s.bodyAlign === val ? "active" : ""}` });
      btn.addEventListener("click", async () => {
        this.plugin.settings.bodyAlign = val;
        await this.plugin.saveSettings();
        alignBtns.querySelectorAll("button").forEach(b => b.removeClass("active"));
        btn.addClass("active");
        updatePreview();
      });
    }

    // 들여쓰기
    const indentRow = panel.createDiv("hwpx-setting-row");
    indentRow.createEl("span", { text: "들여쓰기" });
    this.addNumInput(indentRow, s.bodyIndent, "mm", (v) => { this.plugin.settings.bodyIndent = v; });

    // 간격
    const spRow = panel.createDiv("hwpx-setting-row");
    spRow.createEl("span", { text: "간격" });
    spRow.createEl("span", { text: "앞", cls: "hwpx-unit" });
    this.addNumInput(spRow, s.bodySpacingBefore, "mm", (v) => { this.plugin.settings.bodySpacingBefore = v; });
    spRow.createEl("span", { text: "뒤", cls: "hwpx-unit" });
    this.addNumInput(spRow, s.bodySpacingAfter, "mm", (v) => { this.plugin.settings.bodySpacingAfter = v; });
  }

  private renderListTab(panel: HTMLElement) {
    const s = this.plugin.settings;

    // Common settings
    const commonRow = panel.createDiv("hwpx-setting-row");
    commonRow.createEl("span", { text: "들여쓰기/레벨" });
    this.addNumInput(commonRow, s.listIndentPerLevel, "mm", (v) => { this.plugin.settings.listIndentPerLevel = v; });
    commonRow.createEl("span", { text: "줄간격", cls: "hwpx-unit" });
    this.addNumInput(commonRow, s.listLineSpacing, "%", (v) => { this.plugin.settings.listLineSpacing = v; });

    // Level tabs L1~L4
    const tabRow = panel.createDiv("hwpx-style-tabs");
    tabRow.style.gridTemplateColumns = "repeat(4, 1fr)";
    const levelPanel = panel.createDiv("hwpx-heading-panel");
    const buttons: HTMLButtonElement[] = [];

    for (let l = 0; l < 4; l++) {
      const btn = tabRow.createEl("button", {
        text: `L${l + 1}`,
        cls: `hwpx-style-tab ${l === this.currentListLevelIdx ? "active" : ""}`,
      });
      btn.addEventListener("click", () => {
        this.currentListLevelIdx = l;
        buttons.forEach((b, bi) => b.toggleClass("active", bi === l));
        this.renderListLevelPanel(levelPanel);
      });
      buttons.push(btn);
    }

    this.renderListLevelPanel(levelPanel);
  }

  private renderListLevelPanel(panel: HTMLElement) {
    panel.empty();
    const li = this.currentListLevelIdx;
    const s = this.plugin.settings;
    const ls = s.listLevelStyles[li];
    if (!ls) return;

    // 미리보기
    const preview = panel.createDiv("hwpx-heading-preview");
    const previewText = preview.createEl("div", { cls: "hwpx-heading-preview-text" });
    const updatePreview = () => {
      const latest = this.plugin.settings.listLevelStyles[li];
      const fontName = latest.fontName || this.plugin.settings.fontHangul || "맑은 고딕";
      const size = latest.fontSize || this.plugin.settings.bodyFontSize;
      previewText.setText(`${latest.bulletChar} 리스트 항목`);
      previewText.style.fontSize = `${size}pt`;
      previewText.style.fontFamily = `"${fontName}", sans-serif`;
    };
    updatePreview();

    // 글머리표
    const bulletRow = panel.createDiv("hwpx-setting-row");
    bulletRow.createEl("span", { text: "글머리표" });
    const bulletInput = bulletRow.createEl("input", {
      cls: "hwpx-text-input", value: ls.bulletChar,
    });
    bulletInput.addEventListener("change", async () => {
      this.plugin.settings.listLevelStyles[li].bulletChar = bulletInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 폰트
    const fontRow = panel.createDiv("hwpx-setting-row");
    fontRow.createEl("span", { text: "폰트" });
    const fontInput = fontRow.createEl("input", {
      type: "text", cls: "hwpx-text-input",
      value: ls.fontName || "",
      attr: { placeholder: `(본문: ${s.fontHangul || "맑은 고딕"})` },
    });
    fontInput.addEventListener("change", async () => {
      this.plugin.settings.listLevelStyles[li].fontName = fontInput.value;
      await this.plugin.saveSettings();
      updatePreview();
    });

    // 크기
    const sizeRow = panel.createDiv("hwpx-setting-row");
    sizeRow.createEl("span", { text: "크기" });
    const sizeInput = sizeRow.createEl("input", {
      type: "number", cls: "hwpx-num-input-sm",
      value: String(ls.fontSize),
    });
    sizeInput.addEventListener("change", async () => {
      this.plugin.settings.listLevelStyles[li].fontSize = Number(sizeInput.value) || 0;
      await this.plugin.saveSettings();
      updatePreview();
    });
    sizeRow.createEl("span", { text: "pt", cls: "hwpx-unit" });
  }

  private buildTemplateManager(el: HTMLElement) {
    const btnRow = el.createDiv("hwpx-btn-row");

    // 새 템플릿 만들기 (빈 문서를 에디터에서 편집)
    const newBtn = btnRow.createEl("button", { text: "✏️ 새 템플릿 만들기", cls: "hwpx-action-btn" });
    newBtn.addEventListener("click", () => {
      const modal = new TemplateEditorModal(this.app, null, "새 템플릿");
      modal.open();
    });

    // 기존 HWPX 파일을 에디터에서 열기
    const openBtn = btnRow.createEl("button", { text: "📂 파일 열어서 편집", cls: "hwpx-action-btn" });
    openBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".hwpx,.hwp";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        const modal = new TemplateEditorModal(this.app, buffer, file.name);
        modal.open();
      });
      input.click();
    });

    // 안내
    el.createEl("div", {
      text: "💡 에디터에서 플레이스홀더({{H1}}, {{BODY}} 등)를 포함하면 스타일이 자동 추출됩니다.",
      cls: "hwpx-label",
    });
  }

  private buildPresetManager(el: HTMLElement) {
    const s = this.plugin.settings;
    const presets = s.presets || {};
    const presetNames = Object.keys(presets);

    // 상단 버튼
    const btnRow = el.createDiv("hwpx-btn-row");
    const saveBtn = btnRow.createEl("button", { text: "💾 현재 설정 저장", cls: "hwpx-action-btn" });
    saveBtn.addEventListener("click", async () => {
      const name = prompt("프리셋 이름:");
      if (!name) return;
      const { presets: p, activePreset: a, templates: t, ...toSave } = this.plugin.settings;
      this.plugin.settings.presets[name] = { ...toSave };
      this.plugin.settings.activePreset = name;
      await this.plugin.saveSettings();
      this.rebuildPresetList(listEl);
      new Notice(`✅ "${name}" 저장됨`);
    });

    const importBtn = btnRow.createEl("button", { text: "📥 불러오기", cls: "hwpx-action-btn" });
    importBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          const name = data.name || file.name.replace(/\.json$/, "");
          this.plugin.settings.presets[name] = data.settings || data;
          await this.plugin.saveSettings();
          this.rebuildPresetList(listEl);
          new Notice(`📥 "${name}" 불러옴`);
        } catch { new Notice("❌ 잘못된 파일"); }
      });
      input.click();
    });

    // 프리셋 목록
    const listEl = el.createDiv("hwpx-preset-list");
    this.rebuildPresetList(listEl);
  }

  private rebuildPresetList(listEl: HTMLElement) {
    listEl.empty();
    const presets = this.plugin.settings.presets || {};
    const active = this.plugin.settings.activePreset;

    for (const name of Object.keys(presets)) {
      const isActive = name === active;
      const item = listEl.createDiv(`hwpx-preset-item ${isActive ? "active" : ""}`);

      // 이름 + 활성 표시
      const nameEl = item.createDiv("hwpx-preset-name");
      nameEl.createEl("span", { text: isActive ? `● ${name}` : `○ ${name}` });

      // 버튼들
      const btns = item.createDiv("hwpx-preset-actions");

      // 적용
      if (!isActive) {
        const applyBtn = btns.createEl("button", { text: "적용", cls: "hwpx-preset-action-btn", attr: { title: "이 프리셋 적용" } });
        applyBtn.addEventListener("click", async () => {
          await this.applyPreset(name);
          this.rebuildPresetList(listEl);
        });
      }

      // 복제
      const dupBtn = btns.createEl("button", { text: "📋", cls: "hwpx-preset-action-btn", attr: { title: "복제" } });
      dupBtn.addEventListener("click", async () => {
        const newName = prompt("복제할 이름:", `${name} 사본`);
        if (!newName) return;
        this.plugin.settings.presets[newName] = JSON.parse(JSON.stringify(presets[name]));
        await this.plugin.saveSettings();
        this.rebuildPresetList(listEl);
        new Notice(`📋 "${newName}" 복제됨`);
      });

      // 내보내기
      const exportBtn = btns.createEl("button", { text: "📤", cls: "hwpx-preset-action-btn", attr: { title: "JSON 내보내기" } });
      exportBtn.addEventListener("click", () => {
        const json = JSON.stringify({ name, settings: presets[name] }, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `hwpx-preset-${name}.json`; a.click();
        URL.revokeObjectURL(url);
        new Notice(`📤 "${name}" 내보냄`);
      });

      // 이름 변경
      const renameBtn = btns.createEl("button", { text: "✏️", cls: "hwpx-preset-action-btn", attr: { title: "이름 변경" } });
      renameBtn.addEventListener("click", async () => {
        const newName = prompt("새 이름:", name);
        if (!newName || newName === name) return;
        this.plugin.settings.presets[newName] = presets[name];
        delete this.plugin.settings.presets[name];
        if (active === name) this.plugin.settings.activePreset = newName;
        await this.plugin.saveSettings();
        this.rebuildPresetList(listEl);
        new Notice(`✏️ "${name}" → "${newName}"`);
      });

      // 삭제 (기본은 삭제 불가)
      if (name !== "기본") {
        const delBtn = btns.createEl("button", { text: "🗑", cls: "hwpx-preset-action-btn hwpx-danger", attr: { title: "삭제" } });
        delBtn.addEventListener("click", async () => {
          if (!confirm(`"${name}" 프리셋을 삭제하시겠습니까?`)) return;
          delete this.plugin.settings.presets[name];
          if (active === name) this.plugin.settings.activePreset = "기본";
          await this.plugin.saveSettings();
          this.rebuildPresetList(listEl);
          new Notice(`🗑 "${name}" 삭제됨`);
        });
      }
    }
  }


  /** 프리셋 목록 갱신 */
  private refreshPresetList(selectEl: HTMLElement) {
    selectEl.empty();
    const presets = this.plugin.settings.presets || {};
    selectEl.createEl("option", { text: "커스텀", value: "__custom__" });
    for (const name of Object.keys(presets)) {
      const opt = selectEl.createEl("option", { text: name, value: name });
      if (name === this.plugin.settings.activePreset) {
        (opt as HTMLOptionElement).selected = true;
      }
    }
  }

  /** 프리셋 적용 */
  private async applyPreset(name: string) {
    const preset = this.plugin.settings.presets[name];
    if (!preset) return;

    // 프리셋 값을 현재 설정에 덮어쓰기 (presets/activePreset/templates 제외)
    const { presets, activePreset, templates, ...defaults } = { ...this.plugin.settings };
    Object.assign(this.plugin.settings, defaults, preset);
    this.plugin.settings.presets = presets;
    this.plugin.settings.templates = templates;
    this.plugin.settings.activePreset = name;
    await this.plugin.saveSettings();

    // UI 갱신 (사이드바 재빌드)
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hwpx-sidebar");
    this.buildUI(container);

    new Notice(`✅ 프리셋 "${name}" 적용됨`);
  }

  /** 내보내기 결과 버튼 표시 */
  showExportResult(fullPath: string, vaultPath: string) {
    if (!this.resultEl) return;
    this.resultEl.empty();
    this.resultEl.style.display = "block";

    const info = this.resultEl.createDiv("hwpx-result-info");
    info.createEl("span", { text: `✅ ${vaultPath}`, cls: "hwpx-result-path" });

    const btnRow = this.resultEl.createDiv("hwpx-result-btns");

    // 파일 열기 (한컴오피스)
    const openFileBtn = btnRow.createEl("button", {
      text: "📄 파일 열기",
      cls: "hwpx-result-btn",
    });
    openFileBtn.addEventListener("click", () => {
      try {
        const { shell } = require("electron");
        shell.openPath(fullPath);
      } catch (e) {
        new Notice("파일 열기 실패");
      }
    });

    // 폴더 열기
    const openFolderBtn = btnRow.createEl("button", {
      text: "📂 폴더 열기",
      cls: "hwpx-result-btn",
    });
    openFolderBtn.addEventListener("click", () => {
      try {
        const { shell } = require("electron");
        shell.showItemInFolder(fullPath);
      } catch (e) {
        new Notice("폴더 열기 실패");
      }
    });
  }

  /** UI 전체 재빌드 */
  private rebuildUI() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("hwpx-sidebar");
    this.buildUI(container);
  }

  /** 미리보기 비활성 상태 — 환경에 맞는 안내 + 버튼 */
  private renderPreviewDisabled() {
    if (!this.previewEl) return;
    this.previewEl.empty();
    const box = this.previewEl.createDiv("hwpx-editor-fallback");

    const env = this.env;
    if (!env?.wasmAvailable) {
      box.createEl("h4", { text: "🔌 미리보기 불가" });
      box.createEl("p", { text: "rhwp_bg.wasm 파일이 플러그인 폴더에 없습니다." });
    } else if (env?.renderFailCount >= 3) {
      box.createEl("h4", { text: "⚠️ 렌더링이 반복 실패했습니다" });
      box.createEl("p", { text: "한컴오피스에서 직접 확인해 주세요." });
    } else {
      box.createEl("h4", { text: "💡 미리보기가 꺼져 있습니다" });
      box.createEl("p", { text: "환경 진단 결과 또는 설정에 따라 꺼진 상태입니다." });
    }

    // 환경 정보 요약
    if (env) {
      const detail = box.createEl("p");
      detail.style.fontSize = "10px";
      detail.style.color = "var(--text-muted)";
      const parts = [
        `플랫폼: ${env.platform}`,
        `WASM: ${env.wasmAvailable ? "있음" : "없음"}`,
        `한컴: ${env.hancomInstalled ? "설치됨" : "미확인"}`,
        `온라인: ${env.online ? "O" : "X"}`,
      ];
      detail.setText(parts.join(" · "));
    }
  }

  /** HWPX로 변환 후 한컴오피스(혹은 연결된 뷰어)로 미리보기 */
  private async previewInHancom() {
    if (!this.env?.electronAvailable) {
      new Notice("이 환경에서는 외부 뷰어로 열 수 없습니다.");
      return;
    }
    const file = this.plugin.findMarkdownFile();
    if (!file) {
      new Notice("Markdown 파일을 열어주세요.");
      return;
    }
    try {
      new Notice("변환 중...");
      const markdown = await this.app.vault.read(file);
      const { frontmatter } = parseFrontmatter(markdown);
      const { settings, appliedKeys } = applyFrontmatterOverrides(this.plugin.settings, frontmatter);
      if (appliedKeys.length > 0) console.log("[HWPX Writer] Frontmatter:", appliedKeys);
      const hwpxBytes = await convertMarkdownToHwpx(markdown, settings);
      this.lastHwpxBytes = hwpxBytes;
      const tmp = await openInHancom(hwpxBytes, file.basename);
      new Notice(`📄 열기 요청: ${tmp}`);
    } catch (e) {
      new Notice(`외부 뷰어 열기 실패: ${e}`);
    }
  }

  private async refreshPreview() {
    if (!this.previewEl) return;

    // 현재 Markdown 파일 찾기 (plugin의 공통 메서드 사용)
    const file = this.plugin.findMarkdownFile();
    if (!file) {
      this.previewEl.setText("Markdown 파일을 열어주세요.");
      return;
    }

    this.previewEl.setText("변환 중...");

    try {
      // Markdown → HWPX bytes (frontmatter 오버라이드 적용)
      const markdown = await this.app.vault.read(file);
      const { frontmatter } = parseFrontmatter(markdown);
      const { settings, appliedKeys } = applyFrontmatterOverrides(this.plugin.settings, frontmatter);
      if (appliedKeys.length > 0) console.log("[HWPX Writer] Frontmatter:", appliedKeys);
      const hwpxBytes = await convertMarkdownToHwpx(markdown, settings);
      this.lastHwpxBytes = hwpxBytes;

      // @rhwp/core로 렌더링
      if (!this.rhwpInitialized) {
        try {
          const rhwp = await import("@rhwp/core");
          const wasmPath = this.app.vault.adapter.getResourcePath(
            `${this.plugin.manifest.dir}/rhwp_bg.wasm`
          );
          // WASM 초기화 시도
          await rhwp.default({ module_or_path: wasmPath });
          this.rhwpInitialized = true;
        } catch (e) {
          // WASM 초기화 실패 — initSync로 폴백
          try {
            const rhwp = await import("@rhwp/core");
            const fs = require("fs");
            const wasmBuffer = fs.readFileSync(
              require("path").join(
                (this.app.vault.adapter as any).basePath,
                ".obsidian/plugins/obsidian-hwpx-writer/rhwp_bg.wasm"
              )
            );
            rhwp.initSync({ module: wasmBuffer });
            this.rhwpInitialized = true;
          } catch (e2) {
            console.error("[HWPX Writer] WASM init failed:", e2);
            if (this.env) this.env.wasmInitOk = false;
            this.showPreviewFallback("WASM 초기화 실패", String(e2));
            return;
          }
        }
        if (this.env && this.env.wasmInitOk === null) this.env.wasmInitOk = true;
      }

      // HwpDocument 생성 + SVG 렌더링
      const rhwp = await import("@rhwp/core");
      this.rhwpDoc = new rhwp.HwpDocument(hwpxBytes);
      this.totalPages = this.rhwpDoc.pageCount();
      this.currentPage = 0;

      this.renderCurrentPage();
    } catch (error) {
      console.error("[HWPX Writer] Preview error:", error);
      this.showPreviewFallback("미리보기 실패", String(error));
    }
  }

  /**
   * 미리보기 실패 시 환경별 폴백 UI 표시.
   * 한컴 열기 / 내보내기 / 미리보기 끄기 버튼 제공.
   */
  private showPreviewFallback(title: string, detail: string) {
    if (!this.previewEl) return;
    this.previewEl.empty();
    const box = this.previewEl.createDiv("hwpx-editor-fallback");
    box.createEl("h4", { text: `⚠️ ${title}` });
    const msg = box.createEl("p", { text: detail });
    msg.style.fontSize = "10px";
    msg.style.color = "var(--text-muted)";
    msg.style.wordBreak = "break-all";

    const btnRow = box.createDiv("hwpx-result-btns");

    // 한컴오피스에서 열기 (Electron 가능 시)
    if (this.env?.electronAvailable) {
      const openBtn = btnRow.createEl("button", {
        text: this.env.hancomInstalled ? "🖨️ 한컴에서 열기" : "📄 외부 뷰어로 열기",
        cls: "hwpx-result-btn",
      });
      openBtn.addEventListener("click", async () => {
        try {
          if (!this.lastHwpxBytes) {
            const file = this.plugin.findMarkdownFile();
            if (!file) { new Notice("Markdown 파일을 열어주세요."); return; }
            const md = await this.app.vault.read(file);
            const { frontmatter } = parseFrontmatter(md);
            const { settings } = applyFrontmatterOverrides(this.plugin.settings, frontmatter);
            this.lastHwpxBytes = await convertMarkdownToHwpx(md, settings);
          }
          const file = this.plugin.findMarkdownFile();
          await openInHancom(this.lastHwpxBytes, file?.basename || "preview");
        } catch (e) {
          new Notice(`열기 실패: ${e}`);
        }
      });
    }

    // 다시 시도
    const retryBtn = btnRow.createEl("button", { text: "🔄 다시 시도", cls: "hwpx-result-btn" });
    retryBtn.addEventListener("click", () => this.refreshPreview());

    // 미리보기 끄기
    const disableBtn = btnRow.createEl("button", { text: "🚫 미리보기 끄기", cls: "hwpx-result-btn" });
    disableBtn.addEventListener("click", async () => {
      this.plugin.settings.showPreview = false;
      await this.plugin.saveSettings();
      this.rebuildUI();
      new Notice("미리보기를 껐습니다. 설정에서 다시 켤 수 있습니다.");
    });
  }

  private renderCurrentPage() {
    if (!this.previewEl || !this.rhwpDoc) return;

    try {
      const svg = this.rhwpDoc.renderPageSvg(this.currentPage);
      this.previewEl.empty();
      this.previewEl.innerHTML = svg;

      // SVG 크기 조정
      const svgEl = this.previewEl.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = "100%";
        svgEl.style.height = "auto";
      }

      // 성공하면 실패 카운트 리셋
      if (this.env) this.env.renderFailCount = 0;
    } catch (e) {
      console.error("[HWPX Writer] Render page failed:", e);
      if (this.env) this.env.renderFailCount++;
      this.showPreviewFallback(`페이지 ${this.currentPage + 1} 렌더링 실패`, String(e));
    }

    // 페이지 정보 업데이트
    if (this.pageInfoEl) {
      this.pageInfoEl.setText(`${this.currentPage + 1}/${this.totalPages} 페이지`);
    }
  }

  private prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.renderCurrentPage();
    }
  }

  private nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.renderCurrentPage();
    }
  }
}
