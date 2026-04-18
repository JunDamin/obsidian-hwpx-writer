/**
 * 템플릿 관리 UI — md2hwpx-gui 의 template 관리 기능 포팅.
 *
 * 기능:
 *   - 파일에서 가져오기 (기존 HWPX 임포트)
 *   - 새 템플릿 만들기 (온라인 에디터 모달)
 *   - 목록 표시 + 각 템플릿별: 적용 / 복제 편집(한컴) / 이름변경 / 폴더열기 / 삭제
 *   - 템플릿 폴더 열기 / 새로고침
 *
 * copy-on-edit 패턴: 편집은 반드시 타임스탬프 복제 후 한컴으로 연다.
 */

import { Notice } from "obsidian";
import { log } from "../logger";
import type HwpxWriterPlugin from "../main";
import { TemplateStore, TemplateInfo } from "../templates/TemplateStore";
import { promptText, confirmModal } from "../ui/prompts";
import { readTemplate } from "../converter/TemplateReader";
import { buildTemplateFromSettings } from "../templates/buildTemplateFromSettings";
import { DEFAULT_SETTINGS } from "../settings";

export class TemplateManager {
  private store: TemplateStore;

  constructor(
    private plugin: HwpxWriterPlugin,
    /** 목록이 바뀌면 사이드바 드롭다운도 새로고침하기 위한 콜백 */
    private onChange: () => void,
    /**
     * "적용" 버튼 클릭 시 호출 — 템플릿 id 받아 해당 템플릿의 스타일을 settings 로 복사.
     * (HwpxSidebarView.applyTemplateToSettings 와 연결)
     */
    private onApplyTemplate: (id: string) => Promise<void> = async () => {},
  ) {
    this.store = new TemplateStore(plugin.app, plugin);
  }

  /** 현재 저장된 템플릿 목록 (사이드바 드롭다운이 사용) */
  list(): TemplateInfo[] {
    return this.store.list();
  }

  getStore(): TemplateStore {
    return this.store;
  }

  /** 접이식 섹션 본체 — 버튼 + 목록 */
  render(el: HTMLElement): void {
    const btnRow = el.createDiv("hwpx-btn-row");

    // 파일에서 가져오기
    const importBtn = btnRow.createEl("button", {
      text: "📥 가져오기", cls: "hwpx-action-btn",
      attr: { title: ".hwpx 파일 임포트" },
    });
    importBtn.addEventListener("click", () => this.importFromFile());

    // 샘플 템플릿 시드
    const sampleBtn = btnRow.createEl("button", {
      text: "📋 샘플", cls: "hwpx-action-btn",
      attr: { title: "기본 보고서 · 공문 양식 · 학술 논문 샘플 템플릿을 추가" },
    });
    sampleBtn.addEventListener("click", () => this.seedSamples());

    // 현재 설정으로 템플릿 저장 — 언제든 이 설정으로 복원 가능
    const saveFromSettingsBtn = btnRow.createEl("button", {
      text: "💾 현재 설정", cls: "hwpx-action-btn",
      attr: { title: "현재 settings 값을 md2hwpx 컨벤션 템플릿으로 저장 (복원용)" },
    });
    saveFromSettingsBtn.addEventListener("click", () => this.saveFromCurrentSettings());

    // 기본 설정 템플릿 — DEFAULT_SETTINGS 로 완전한 md2hwpx-컨벤션 템플릿 생성
    const defaultsBtn = btnRow.createEl("button", {
      text: "🆕 기본 설정", cls: "hwpx-action-btn",
      attr: { title: "플러그인 기본 설정값으로 템플릿 생성 (복원용 스냅샷)" },
    });
    defaultsBtn.addEventListener("click", () => this.saveFromDefaults());

    // 폴더 열기
    const folderBtn = btnRow.createEl("button", {
      text: "📂 폴더", cls: "hwpx-action-btn",
      attr: { title: "템플릿 저장 폴더 열기" },
    });
    folderBtn.addEventListener("click", () => {
      this.store.openTemplatesFolder();
    });

    // 새로고침
    const refreshBtn = btnRow.createEl("button", {
      text: "🔄", cls: "hwpx-action-btn", attr: { title: "목록 새로고침" },
    });
    refreshBtn.addEventListener("click", () => {
      this.rebuildList(listEl);
      this.onChange();
    });

    // 안내
    el.createEl("div", {
      text: "💡 편집은 '한컴 편집' 버튼으로 복사본을 만들어 한컴오피스에서 수정하세요.",
      cls: "hwpx-label",
    });

    // 목록
    const listEl = el.createDiv("hwpx-preset-list");
    this.rebuildList(listEl);
  }

  /** 목록 UI 재구성 */
  private rebuildList(listEl: HTMLElement): void {
    listEl.empty();
    const templates = this.store.list();
    const activeId = this.plugin.settings.activeTemplateId;

    if (templates.length === 0) {
      const empty = listEl.createDiv();
      empty.style.padding = "8px";
      empty.style.textAlign = "center";
      empty.style.border = "1px dashed var(--background-modifier-border)";
      empty.style.borderRadius = "4px";
      empty.style.background = "var(--background-secondary)";
      const msg = empty.createEl("div", { text: "등록된 템플릿이 없습니다." });
      msg.style.color = "var(--text-muted)";
      msg.style.marginBottom = "6px";
      msg.style.fontSize = "12px";
      const quickBtn = empty.createEl("button", {
        text: "📋 샘플 템플릿 3종 받기",
        cls: "hwpx-action-btn",
      });
      quickBtn.style.fontSize = "11px";
      quickBtn.addEventListener("click", () => this.seedSamples());
      return;
    }

    for (const t of templates) {
      const isActive = t.id === activeId;
      const item = listEl.createDiv(`hwpx-preset-item ${isActive ? "active" : ""}`);

      // 이름 + 메타
      const nameEl = item.createDiv("hwpx-preset-name");
      nameEl.createEl("span", { text: isActive ? `● ${t.name}` : `○ ${t.name}` });
      const kb = Math.max(1, Math.round(t.sizeBytes / 1024));
      nameEl.createEl("span", {
        text: ` (${kb} KB)`,
        cls: "hwpx-label",
      });

      // 활성 템플릿이면 폰트 정보 표시
      if (isActive) {
        const metaLine = item.createDiv("hwpx-label");
        metaLine.style.fontSize = "11px";
        metaLine.style.marginTop = "2px";
        metaLine.setText("📝 템플릿 정보 읽는 중...");
        readTemplate(t.absPath).then((meta) => {
          if (meta.bodyFontHangul) {
            const latinPart = meta.bodyFontLatin && meta.bodyFontLatin !== meta.bodyFontHangul
              ? ` · ${meta.bodyFontLatin}`
              : "";
            metaLine.setText(
              `✓ 본문 폰트: ${meta.bodyFontHangul}${latinPart} · 스타일 ${meta.styleNames.length}개`,
            );
          } else {
            metaLine.setText("⚠️ 템플릿에서 폰트 정보를 읽지 못했습니다");
          }
        }).catch(() => {
          metaLine.setText("⚠️ 템플릿 파싱 실패");
        });
      }

      // 버튼 묶음
      const btns = item.createDiv("hwpx-preset-actions");

      // 적용/해제
      const applyBtn = btns.createEl("button", {
        text: isActive ? "해제" : "적용",
        cls: "hwpx-preset-action-btn",
        attr: { title: isActive ? "템플릿 사용 해제" : "이 템플릿을 기본으로 설정" },
      });
      applyBtn.addEventListener("click", async () => {
        if (isActive) {
          // 해제 — activeTemplateId 만 null 로. settings 값은 유지 (사용자 편집 보존)
          this.plugin.settings.activeTemplateId = null;
          await this.plugin.saveSettings();
          new Notice("템플릿 해제됨 (설정값은 유지)");
        } else {
          // 적용 — activeTemplateId 설정 + 템플릿 스타일을 settings 에 복사
          this.plugin.settings.activeTemplateId = t.id;
          await this.onApplyTemplate(t.id);
          await this.plugin.saveSettings();
          // Notice 는 onApplyTemplate 안에서 이미 띄움
        }
        this.rebuildList(listEl);
        this.onChange();
      });

      // 한컴에서 복제 편집 (copy-on-edit)
      const editBtn = btns.createEl("button", {
        text: "📝", cls: "hwpx-preset-action-btn",
        attr: { title: "복제본을 한컴오피스에서 열어 편집" },
      });
      editBtn.addEventListener("click", () => {
        const copy = this.store.copyForEdit(t.id);
        if (!copy) { new Notice("❌ 복제 실패"); return; }
        if (this.store.openExternal(copy.id)) {
          new Notice(`📝 "${copy.name}" 한컴오피스에서 엶`);
        } else {
          new Notice("⚠️ 기본 연결 프로그램에서 열지 못했습니다. 폴더에서 수동으로 여세요.");
        }
        this.rebuildList(listEl);
        this.onChange();
      });

      // 이름 변경
      const renameBtn = btns.createEl("button", {
        text: "✏️", cls: "hwpx-preset-action-btn", attr: { title: "이름 변경" },
      });
      renameBtn.addEventListener("click", async () => {
        const newName = await promptText(this.plugin.app, "이름 변경", t.name, "새 이름 (확장자 제외)");
        if (!newName || newName === t.name) return;
        const updated = this.store.rename(t.id, newName);
        if (!updated) { new Notice("❌ 이름 변경 실패 (중복 또는 잘못된 이름)"); return; }
        // active였다면 새 ID로 따라가기
        if (activeId === t.id) {
          this.plugin.settings.activeTemplateId = updated.id;
          await this.plugin.saveSettings();
        }
        this.rebuildList(listEl);
        this.onChange();
        new Notice(`✏️ "${t.name}" → "${updated.name}"`);
      });

      // 플레이스홀더 확인
      const phBtn = btns.createEl("button", {
        text: "🔍", cls: "hwpx-preset-action-btn",
        attr: { title: "플레이스홀더 검사 ({{H1}} 등)" },
      });
      phBtn.addEventListener("click", async () => {
        const phs = await this.store.extractPlaceholders(t.id);
        if (phs.length === 0) {
          new Notice("플레이스홀더 없음");
        } else {
          new Notice(`플레이스홀더 ${phs.length}개: ${phs.join(", ")}`, 8000);
        }
      });

      // 폴더에서 보기
      const locateBtn = btns.createEl("button", {
        text: "📂", cls: "hwpx-preset-action-btn",
        attr: { title: "탐색기에서 파일 위치 열기" },
      });
      locateBtn.addEventListener("click", () => {
        this.store.revealInFolder(t.id);
      });

      // 삭제
      const delBtn = btns.createEl("button", {
        text: "🗑", cls: "hwpx-preset-action-btn hwpx-danger",
        attr: { title: "삭제" },
      });
      delBtn.addEventListener("click", async () => {
        const ok = await confirmModal(
          this.plugin.app,
          "삭제 확인",
          `"${t.name}" 템플릿을 삭제하시겠습니까?`,
          "삭제",
          "취소",
        );
        if (!ok) return;
        if (this.store.delete(t.id)) {
          if (activeId === t.id) {
            this.plugin.settings.activeTemplateId = null;
            await this.plugin.saveSettings();
          }
          this.rebuildList(listEl);
          this.onChange();
          new Notice(`🗑 "${t.name}" 삭제됨`);
        } else {
          new Notice("❌ 삭제 실패");
        }
      });
    }
  }

  /** HTML file picker로 .hwpx 임포트 */
  private importFromFile(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".hwpx,.hwp";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const bytes = await file.arrayBuffer();
        const info = this.store.importFromBytes(bytes, file.name);
        new Notice(`📥 "${info.name}" 가져오기 완료`);
        // 목록 재빌드를 위해 전체 onChange — 호출하면 상위가 재렌더링하지만
        // 이 메서드는 리스트 DOM 참조가 없으므로 전체 리빌드에 맡긴다.
        this.onChange();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        new Notice(`❌ 가져오기 실패: ${msg}`);
      }
    });
    input.click();
  }

  /**
   * DEFAULT_SETTINGS 로부터 완전한 md2hwpx-컨벤션 템플릿 생성·저장.
   *
   * 이전 "빈 템플릿" 은 placeholder 가 거의 없는 최소 HWPX 라 실용성이 떨어졌다.
   * 대신 플러그인 기본값 스냅샷을 담은 전체 템플릿을 생성 — 사용자가 설정을
   * 많이 바꾼 뒤 "기본값으로 복귀" 하고 싶을 때 적용하면 됨.
   */
  private async saveFromDefaults(): Promise<void> {
    const defaultName = `기본 설정 ${new Date().toISOString().slice(0, 10)}`;
    const name = await promptText(
      this.plugin.app, "기본 설정 템플릿 저장", defaultName, "이름 (확장자 제외)",
    );
    if (!name) return;

    try {
      const bytes = await buildTemplateFromSettings(DEFAULT_SETTINGS);
      const info = this.store.importFromBytes(bytes, `${name}.hwpx`);
      new Notice(`🆕 "${info.name}" 생성됨 (${Math.round(bytes.length / 1024)} KB)`);
      this.onChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`❌ 생성 실패: ${msg}`);
      log.error("saveFromDefaults error:", e);
    }
  }

  /**
   * 현재 settings 로부터 완전한 md2hwpx-컨벤션 템플릿 HWPX 를 생성·저장.
   * 생성된 템플릿은 모든 placeholder(H1~H6, BODY, CODE, LINK, CELL_*, LIST_*) 를
   * 포함하며, 나중에 "적용" 시 현재 설정을 복원할 수 있다.
   */
  private async saveFromCurrentSettings(): Promise<void> {
    const defaultName = `내 설정 ${new Date().toISOString().slice(0, 10)}`;
    const name = await promptText(
      this.plugin.app,
      "템플릿으로 저장",
      defaultName,
      "이름 (확장자 제외)",
    );
    if (!name) return;

    try {
      const bytes = await buildTemplateFromSettings(this.plugin.settings);
      const info = this.store.importFromBytes(bytes, `${name}.hwpx`);
      new Notice(`💾 "${info.name}" 저장됨 (${Math.round(bytes.length / 1024)} KB)`);
      this.onChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`❌ 저장 실패: ${msg}`);
      log.error("saveFromCurrentSettings error:", e);
    }
  }

  /**
   * 샘플 템플릿 3종(기본 보고서/공문 양식/학술 논문) 을 폴더에 시드.
   * 이미 같은 이름이 있으면 건너뜀(비파괴). 처음 써보는 사용자용.
   */
  private async seedSamples(): Promise<void> {
    try {
      const added = await this.store.seedSampleTemplates();
      if (added === 0) {
        new Notice("ℹ️ 모든 샘플이 이미 존재합니다.");
      } else {
        new Notice(`📋 샘플 템플릿 ${added}개 추가됨`);
      }
      this.onChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`❌ 샘플 생성 실패: ${msg}`);
      log.error("seedSamples error:", e);
    }
  }

  /**
   * (제거됨) 온라인 에디터 — @rhwp/editor 가 오프라인 불가 + 저장 API 부재로 실용성 없어 삭제.
   *          한컴에서 직접 편집(✏️ 한컴 편집 버튼)으로 대체.
   */
}
