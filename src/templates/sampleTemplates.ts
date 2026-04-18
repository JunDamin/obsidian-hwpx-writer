/**
 * 샘플 템플릿 — md2hwpx-gui 번들 보고양식 단일 소스.
 *
 * 이전 버전(v1)에서는 hwpx-core 로 자체 조립한 4종(기본보고서/공문양식/학술논문/회의록)
 * 도 시드했으나, 이들은 md2hwpx placeholder 컨벤션(`{{H1}}~{{H9}}`, `{{CELL_*}}`,
 * `{{LIST_*}}` 등)을 따르지 않아 converter 가 스타일을 추출할 수 없었다.
 * Phase B 부터는 md2hwpx 원본 보고양식 하나만 시드하고, 사용자가 이를 복제·편집해
 * 자신만의 스타일 견본을 만들 수 있게 한다.
 */

import { decodeBogoyangsikBytes } from "./bogoyangsikBundle";

export interface SampleTemplate {
  /** 파일명 stem (확장자 제외). */
  name: string;
  /** 한 줄 설명. */
  description: string;
  /** HWPX ZIP 바이트. */
  bytes: Uint8Array;
}

/** 현재 샘플 세트 버전. 번들이 바뀌거나 세트를 바꿀 때 bump. */
export const CURRENT_SAMPLE_VERSION = 3;

/** 전체 샘플 템플릿. */
export function createAllSampleTemplates(): SampleTemplate[] {
  return [
    {
      name: "보고양식 (md2hwpx)",
      description:
        "md2hwpx-gui 원본 · H1~H9 · BODY/CODE/LINK · 12개 CELL_* · 14개 LIST_* " +
        "플레이스홀더로 모든 스타일 견본을 제공. 한컴에서 편집해 자신의 스타일로 변형 가능.",
      bytes: decodeBogoyangsikBytes(),
    },
  ];
}
