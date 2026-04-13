/** XML 문자열 빌더 — 외부 의존성 없이 XML을 문자열로 생성. */

import { xmlEscape } from "./utils";

function openTag(name: string, attrs?: Record<string, string | undefined>, selfClosing = false): string {
  const parts = [`<${name}`];
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null) continue;
      parts.push(` ${key}="${xmlEscape(String(value))}"`);
    }
  }
  parts.push(selfClosing ? " />" : ">");
  return parts.join("");
}

function closeTag(name: string): string {
  return `</${name}>`;
}

export class XmlWriter {
  private lines: string[] = [];
  private indentStr: string;
  private depth = 0;

  constructor(indent = "  ") {
    this.indentStr = indent;
  }

  private get prefix(): string {
    return this.indentStr.repeat(this.depth);
  }

  decl(): void {
    this.lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>');
  }

  start(name: string, attrs?: Record<string, string | undefined>): void {
    this.lines.push(`${this.prefix}${openTag(name, attrs)}`);
    this.depth++;
  }

  end(name: string): void {
    this.depth--;
    this.lines.push(`${this.prefix}${closeTag(name)}`);
  }

  empty(name: string, attrs?: Record<string, string | undefined>): void {
    this.lines.push(`${this.prefix}${openTag(name, attrs, true)}`);
  }

  textElement(name: string, text: string, attrs?: Record<string, string | undefined>): void {
    this.lines.push(`${this.prefix}${openTag(name, attrs)}${xmlEscape(text)}${closeTag(name)}`);
  }

  inlineElement(name: string, text: string, attrs?: Record<string, string | undefined>): void {
    this.lines.push(`${this.prefix}${openTag(name, attrs)}${text}${closeTag(name)}`);
  }

  raw(text: string): void {
    this.lines.push(`${this.prefix}${text}`);
  }

  toString(): string {
    return this.lines.join("\n");
  }
}
