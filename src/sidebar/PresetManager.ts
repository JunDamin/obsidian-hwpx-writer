/**
 * 프리셋 관리 — 저장 / 복제 / 이름변경 / 삭제 / JSON 내보내기·불러오기.
 */

import { Notice } from "obsidian";
import type HwpxWriterPlugin from "../main";
import type { HwpxWriterSettings } from "../settings";
import { promptText, confirmModal } from "../ui/prompts";

function stripPresetMeta(settings: HwpxWriterSettings): Partial<HwpxWriterSettings> {
  const copy: Partial<HwpxWriterSettings> = { ...settings };
  delete copy.presets;
  delete copy.activePreset;
  delete copy.activeTemplateId;
  return copy;
}

export class PresetManager {
  constructor(
    private plugin: HwpxWriterPlugin,
    private onAfterApply: () => void,
  ) {}

  /** 상단 "프리셋:" 선택 드롭다운 */
  renderSelector(parent: HTMLElement): void {
    const presetRow = parent.createDiv("hwpx-preset-row");
    presetRow.createEl("span", { text: "프리셋:" });
    const presetSelect = presetRow.createEl("select", { cls: "hwpx-template-select" });
    this.refreshDropdown(presetSelect);
    presetSelect.addEventListener("change", () => { void (async () => {
      const name = presetSelect.value;
      if (name && name !== "__custom__") {
        await this.applyPreset(name);
      }
    })(); });

    // 저장 / 내보내기 / 불러오기 / 삭제 버튼
    const presetBtnRow = parent.createDiv("hwpx-preset-btns");

    const savePresetBtn = presetBtnRow.createEl("button", { text: "💾 현재 설정 저장", cls: "hwpx-action-btn" });
    savePresetBtn.addEventListener("click", () => { void (async () => {
      const name = await promptText(this.plugin.app, "프리셋 저장", "", "프리셋 이름");
      if (!name) return;
      const settingsToSave = stripPresetMeta(this.plugin.settings);
      this.plugin.settings.presets[name] = { ...settingsToSave };
      this.plugin.settings.activePreset = name;
      await this.plugin.saveSettings();
      this.refreshDropdown(presetSelect);
      presetSelect.value = name;
      new Notice(`✅ 프리셋 "${name}" 저장됨`);
    })(); });

    const exportPresetBtn = presetBtnRow.createEl("button", {
      text: "📤", cls: "hwpx-action-btn", attr: { title: "프리셋 내보내기 (JSON)" },
    });
    exportPresetBtn.addEventListener("click", () => {
      const name = presetSelect.value;
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

    const importPresetBtn = presetBtnRow.createEl("button", {
      text: "📥", cls: "hwpx-action-btn", attr: { title: "프리셋 불러오기 (JSON)" },
    });
    importPresetBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.addEventListener("change", () => { void (async () => {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        try {
          const data = JSON.parse(text);
          const name = data.name || file.name.replace(/\.json$/, "");
          this.plugin.settings.presets[name] = data.settings || data;
          await this.plugin.saveSettings();
          this.refreshDropdown(presetSelect);
          new Notice(`📥 프리셋 "${name}" 불러오기 완료`);
        } catch {
          new Notice("❌ 잘못된 프리셋 파일");
        }
      })(); });
      input.click();
    });

    const deletePresetBtn = presetBtnRow.createEl("button", {
      text: "🗑", cls: "hwpx-action-btn", attr: { title: "선택된 프리셋 삭제" },
    });
    deletePresetBtn.addEventListener("click", () => { void (async () => {
      const name = presetSelect.value;
      if (!name || name === "__custom__" || name === "기본") {
        new Notice("기본 프리셋은 삭제할 수 없습니다.");
        return;
      }
      delete this.plugin.settings.presets[name];
      this.plugin.settings.activePreset = "기본";
      await this.plugin.saveSettings();
      this.refreshDropdown(presetSelect);
      new Notice(`🗑 프리셋 "${name}" 삭제됨`);
    })(); });
  }

  /** 접이식 "프리셋 관리" 섹션 전체 UI (고급) */
  renderDetailedManager(el: HTMLElement): void {
    const btnRow = el.createDiv("hwpx-btn-row");

    const saveBtn = btnRow.createEl("button", { text: "💾 현재 설정 저장", cls: "hwpx-action-btn" });
    saveBtn.addEventListener("click", () => { void (async () => {
      const name = await promptText(this.plugin.app, "프리셋 저장", "", "프리셋 이름");
      if (!name) return;
      const toSave = stripPresetMeta(this.plugin.settings);
      this.plugin.settings.presets[name] = { ...toSave };
      this.plugin.settings.activePreset = name;
      await this.plugin.saveSettings();
      this.rebuildList(listEl);
      new Notice(`✅ "${name}" 저장됨`);
    })(); });

    const importBtn = btnRow.createEl("button", { text: "📥 불러오기", cls: "hwpx-action-btn" });
    importBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.addEventListener("change", () => { void (async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          const name = data.name || file.name.replace(/\.json$/, "");
          this.plugin.settings.presets[name] = data.settings || data;
          await this.plugin.saveSettings();
          this.rebuildList(listEl);
          new Notice(`📥 "${name}" 불러옴`);
        } catch { new Notice("❌ 잘못된 파일"); }
      })(); });
      input.click();
    });

    // 프리셋 목록
    const listEl = el.createDiv("hwpx-preset-list");
    this.rebuildList(listEl);
  }

  private rebuildList(listEl: HTMLElement): void {
    listEl.empty();
    const presets = this.plugin.settings.presets || {};
    const active = this.plugin.settings.activePreset;

    for (const name of Object.keys(presets)) {
      const isActive = name === active;
      const item = listEl.createDiv(`hwpx-preset-item ${isActive ? "active" : ""}`);

      const nameEl = item.createDiv("hwpx-preset-name");
      nameEl.createEl("span", { text: isActive ? `● ${name}` : `○ ${name}` });

      const btns = item.createDiv("hwpx-preset-actions");

      // 적용
      if (!isActive) {
        const applyBtn = btns.createEl("button", {
          text: "적용", cls: "hwpx-preset-action-btn",
          attr: { title: "이 프리셋 적용" },
        });
        applyBtn.addEventListener("click", () => { void (async () => {
          await this.applyPreset(name);
          this.rebuildList(listEl);
        })(); });
      }

      // 복제
      const dupBtn = btns.createEl("button", {
        text: "📋", cls: "hwpx-preset-action-btn", attr: { title: "복제" },
      });
      dupBtn.addEventListener("click", () => { void (async () => {
        const newName = await promptText(this.plugin.app, "프리셋 복제", `${name} 사본`, "새 이름");
        if (!newName) return;
        this.plugin.settings.presets[newName] = JSON.parse(JSON.stringify(presets[name]));
        await this.plugin.saveSettings();
        this.rebuildList(listEl);
        new Notice(`📋 "${newName}" 복제됨`);
      })(); });

      // 내보내기
      const exportBtn = btns.createEl("button", {
        text: "📤", cls: "hwpx-preset-action-btn", attr: { title: "JSON 내보내기" },
      });
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
      const renameBtn = btns.createEl("button", {
        text: "✏️", cls: "hwpx-preset-action-btn", attr: { title: "이름 변경" },
      });
      renameBtn.addEventListener("click", () => { void (async () => {
        const newName = await promptText(this.plugin.app, "이름 변경", name, "새 이름");
        if (!newName || newName === name) return;
        this.plugin.settings.presets[newName] = presets[name];
        delete this.plugin.settings.presets[name];
        if (active === name) this.plugin.settings.activePreset = newName;
        await this.plugin.saveSettings();
        this.rebuildList(listEl);
        new Notice(`✏️ "${name}" → "${newName}"`);
      })(); });

      // 삭제 (기본은 삭제 불가)
      if (name !== "기본") {
        const delBtn = btns.createEl("button", {
          text: "🗑", cls: "hwpx-preset-action-btn hwpx-danger", attr: { title: "삭제" },
        });
        delBtn.addEventListener("click", () => { void (async () => {
          const ok = await confirmModal(
            this.plugin.app,
            "삭제 확인",
            `"${name}" 프리셋을 삭제하시겠습니까?`,
            "삭제",
            "취소",
          );
          if (!ok) return;
          delete this.plugin.settings.presets[name];
          if (active === name) this.plugin.settings.activePreset = "기본";
          await this.plugin.saveSettings();
          this.rebuildList(listEl);
          new Notice(`🗑 "${name}" 삭제됨`);
        })(); });
      }
    }
  }

  private refreshDropdown(selectEl: HTMLElement): void {
    selectEl.empty();
    const presets = this.plugin.settings.presets || {};
    selectEl.createEl("option", { text: "커스텀", value: "__custom__" });
    for (const name of Object.keys(presets)) {
      const opt = selectEl.createEl("option", { text: name, value: name });
      if (name === this.plugin.settings.activePreset) opt.selected = true;
    }
  }

  private async applyPreset(name: string): Promise<void> {
    const preset = this.plugin.settings.presets[name];
    if (!preset) return;

    const { presets, activeTemplateId } = this.plugin.settings;
    const defaults = stripPresetMeta(this.plugin.settings);
    Object.assign(this.plugin.settings, defaults, preset);
    this.plugin.settings.presets = presets;
    this.plugin.settings.activeTemplateId = activeTemplateId;
    this.plugin.settings.activePreset = name;
    await this.plugin.saveSettings();

    this.onAfterApply();
    new Notice(`✅ 프리셋 "${name}" 적용됨`);
  }
}
