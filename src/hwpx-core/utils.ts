/** 유틸리티: XML 이스케이프, ID 관리, 색상 변환. */

export function xmlEscape(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function boolToStr(value: boolean): string {
  return value ? "1" : "0";
}

export function colorToHwpx(color: string): string {
  if (!color || color === "none") return "none";
  if (color.startsWith("#")) return color.toUpperCase();
  return color;
}

export class IdCounter {
  private _next: number;

  constructor(start: number = 0) {
    this._next = start;
  }

  next(): number {
    return this._next++;
  }

  get current(): number {
    return this._next - 1;
  }

  get count(): number {
    return this._next;
  }
}

export function generateBinId(): string {
  return `img_${Date.now()}_${Math.floor(Math.random() * 9000) + 1000}`;
}
