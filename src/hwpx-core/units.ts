/** HWPUNIT 단위 변환 함수. */

const PT_TO_HWPUNIT = 100;
const MM_TO_HWPUNIT = 283.465;
const CM_TO_HWPUNIT = 2834.65;
const INCH_TO_HWPUNIT = 7200;
const PX_TO_HWPUNIT = 75;
const CHAR_TO_HWPUNIT = 500;
const TWIPS_TO_HWPUNIT = 5;

export const pt = (value: number): number => Math.round(value * PT_TO_HWPUNIT);
export const mm = (value: number): number => Math.round(value * MM_TO_HWPUNIT);
export const cm = (value: number): number => Math.round(value * CM_TO_HWPUNIT);
export const inch = (value: number): number => Math.round(value * INCH_TO_HWPUNIT);
export const px = (value: number): number => Math.round(value * PX_TO_HWPUNIT);
export const char = (value: number): number => Math.round(value * CHAR_TO_HWPUNIT);
export const twips = (value: number): number => Math.round(value * TWIPS_TO_HWPUNIT);

export const hwpunitToPt = (value: number): number => value / PT_TO_HWPUNIT;
export const hwpunitToMm = (value: number): number => value / MM_TO_HWPUNIT;
