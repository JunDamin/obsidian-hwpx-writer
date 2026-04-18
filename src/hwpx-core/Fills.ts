/**
 * 채우기(Fill) 클래스들 — BorderFill의 `fill` 속성으로 사용됨.
 *
 * - SolidFill: 단색 (faceColor + hatch 옵션)
 * - GradientFill: 그라데이션 (선형/방사형/원뿔/사각)
 * - ImageFill: 이미지 패턴 (BinData 참조)
 */

export interface SolidFillInit {
  faceColor?: string;
  hatchColor?: string;
  hatchStyle?: string;
  alpha?: number;
}

export class SolidFill {
  faceColor: string;
  hatchColor: string;
  hatchStyle: string;
  alpha: number;

  constructor(init: SolidFillInit = {}) {
    this.faceColor = init.faceColor ?? "#FFFFFF";
    this.hatchColor = init.hatchColor ?? "none";
    this.hatchStyle = init.hatchStyle ?? "NONE";
    this.alpha = init.alpha ?? 0;
  }
}


export interface GradientFillInit {
  type?: string;
  angle?: number;
  centerX?: number;
  centerY?: number;
  step?: number;
  colors?: string[];
  stepCenter?: number;
}

export class GradientFill {
  type: string;       // "LINEAR" | "RADIAL" | "CONICAL" | "SQUARE"
  angle: number;
  centerX: number;
  centerY: number;
  step: number;
  colors: string[];
  stepCenter: number;

  constructor(init: GradientFillInit = {}) {
    this.type = init.type ?? "LINEAR";
    this.angle = init.angle ?? 0;
    this.centerX = init.centerX ?? 0;
    this.centerY = init.centerY ?? 0;
    this.step = init.step ?? 50;
    this.colors = init.colors ?? ["#FF0000", "#0000FF"];
    this.stepCenter = init.stepCenter ?? 50;
  }
}


export interface ImageFillInit {
  mode?: string;
  imageRef?: string;
  bright?: number;
  contrast?: number;
  effect?: string;
  alpha?: number;
}

export class ImageFill {
  mode: string;          // "TILE" | "CENTER" | "STRETCH" | "FIT"
  imageRef: string;      // BinData 참조
  bright: number;
  contrast: number;
  effect: string;        // "REAL_PIC" | "GRAY_SCALE" | "BLACK_WHITE"
  alpha: number;

  constructor(init: ImageFillInit = {}) {
    this.mode = init.mode ?? "TILE";
    this.imageRef = init.imageRef ?? "";
    this.bright = init.bright ?? 0;
    this.contrast = init.contrast ?? 0;
    this.effect = init.effect ?? "REAL_PIC";
    this.alpha = init.alpha ?? 0;
  }
}


export type FillType = SolidFill | GradientFill | ImageFill;
