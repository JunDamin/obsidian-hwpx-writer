/**
 * BorderLine / BorderFill — 셀/문단의 테두리와 배경 정의.
 *
 * 중요: borderFill의 id는 **1부터 시작**한다 (0은 "없음"을 의미하는 특수값).
 */

import { XmlWriter } from "./XmlBuilder";
import { boolToStr, colorToHwpx } from "./utils";
import { SolidFill, GradientFill, ImageFill, type FillType } from "./Fills";

export interface BorderLineInit {
  type?: string;
  width?: string;
  color?: string;
}

export class BorderLine {
  type: string;
  width: string;
  color: string;

  constructor(init: BorderLineInit = {}) {
    this.type = init.type ?? "NONE";
    this.width = init.width ?? "0.1 mm";
    this.color = init.color ?? "#000000";
  }
}


export interface BorderFillInit {
  id?: number;

  threeD?: boolean;
  shadow?: boolean;
  centerLine?: string;

  leftBorder?: BorderLine | null;
  rightBorder?: BorderLine | null;
  topBorder?: BorderLine | null;
  bottomBorder?: BorderLine | null;
  diagonal?: BorderLine | null;

  slashType?: string;
  slashCrooked?: boolean;
  slashIsCounter?: boolean;
  backSlashType?: string;
  backSlashCrooked?: boolean;
  backSlashIsCounter?: boolean;

  fill?: FillType | null;
}

export class BorderFill {
  id: number;  // borderFill은 1부터 시작

  threeD: boolean;
  shadow: boolean;
  centerLine: string;

  leftBorder: BorderLine | null;
  rightBorder: BorderLine | null;
  topBorder: BorderLine | null;
  bottomBorder: BorderLine | null;
  diagonal: BorderLine | null;

  slashType: string;
  slashCrooked: boolean;
  slashIsCounter: boolean;
  backSlashType: string;
  backSlashCrooked: boolean;
  backSlashIsCounter: boolean;

  fill: FillType | null;

  constructor(init: BorderFillInit = {}) {
    this.id = init.id ?? 1;

    this.threeD = init.threeD ?? false;
    this.shadow = init.shadow ?? false;
    this.centerLine = init.centerLine ?? "NONE";

    this.leftBorder = init.leftBorder ?? null;
    this.rightBorder = init.rightBorder ?? null;
    this.topBorder = init.topBorder ?? null;
    this.bottomBorder = init.bottomBorder ?? null;
    this.diagonal = init.diagonal ?? null;

    this.slashType = init.slashType ?? "NONE";
    this.slashCrooked = init.slashCrooked ?? false;
    this.slashIsCounter = init.slashIsCounter ?? false;
    this.backSlashType = init.backSlashType ?? "NONE";
    this.backSlashCrooked = init.backSlashCrooked ?? false;
    this.backSlashIsCounter = init.backSlashIsCounter ?? false;

    this.fill = init.fill ?? null;
  }

  toXml(w: XmlWriter): void {
    w.start("hh:borderFill", {
      id: String(this.id),
      threeD: boolToStr(this.threeD),
      shadow: boolToStr(this.shadow),
      centerLine: this.centerLine,
      breakCellSeparateLine: "0",
    });

    // slash
    w.empty("hh:slash", {
      type: this.slashType,
      Crooked: boolToStr(this.slashCrooked),
      isCounter: boolToStr(this.slashIsCounter),
    });
    w.empty("hh:backSlash", {
      type: this.backSlashType,
      Crooked: boolToStr(this.backSlashCrooked),
      isCounter: boolToStr(this.backSlashIsCounter),
    });

    // borders (4방향 + diagonal)
    const sides: [string, BorderLine | null][] = [
      ["hh:leftBorder", this.leftBorder],
      ["hh:rightBorder", this.rightBorder],
      ["hh:topBorder", this.topBorder],
      ["hh:bottomBorder", this.bottomBorder],
      ["hh:diagonal", this.diagonal],
    ];
    for (const [side, border] of sides) {
      const b = border ?? new BorderLine();
      w.empty(side, {
        type: b.type,
        width: b.width,
        color: colorToHwpx(b.color),
      });
    }

    // fill
    if (this.fill) {
      w.start("hc:fillBrush");
      if (this.fill instanceof SolidFill) {
        w.empty("hc:winBrush", {
          faceColor: colorToHwpx(this.fill.faceColor),
          hatchColor: colorToHwpx(this.fill.hatchColor),
          hatchStyle: this.fill.hatchStyle,
          alpha: String(this.fill.alpha),
        });
      } else if (this.fill instanceof GradientFill) {
        const gf = this.fill;
        w.start("hc:gradation", {
          type: gf.type,
          angle: String(gf.angle),
          centerX: String(gf.centerX),
          centerY: String(gf.centerY),
          step: String(gf.step),
          colorNum: String(gf.colors.length),
          stepCenter: String(gf.stepCenter),
        });
        for (const color of gf.colors) {
          w.textElement("hc:color", colorToHwpx(color));
        }
        w.end("hc:gradation");
      } else if (this.fill instanceof ImageFill) {
        const imf = this.fill;
        w.start("hc:imgBrush", { mode: imf.mode });
        w.empty("hc:img", {
          binaryItemIDRef: imf.imageRef,
          bright: String(imf.bright),
          contrast: String(imf.contrast),
          effect: imf.effect,
          alpha: String(imf.alpha),
        });
        w.end("hc:imgBrush");
      }
      w.end("hc:fillBrush");
    }

    w.end("hh:borderFill");
  }
}
