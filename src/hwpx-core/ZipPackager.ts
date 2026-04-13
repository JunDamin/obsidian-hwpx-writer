/** HWPX ZIP 패키징 — JSZip 사용, mimetype STORED 규칙 준수. */

import JSZip from "jszip";
import { MIMETYPE, NS } from "./constants";

export class HwpxZipPackager {
  private zip: JSZip;
  private fileOrder: string[] = [];

  constructor() {
    this.zip = new JSZip();
  }

  addMimetype(): void {
    this.zip.file("mimetype", MIMETYPE, { compression: "STORE" });
    this.fileOrder.push("mimetype");
  }

  addVersionXml(): void {
    const content = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>',
      `<hv:HCFVersion xmlns:hv="${NS.hv}"`,
      '  tagetApplication="WORDPROCESSOR"',
      '  major="5" minor="1" micro="1" buildNumber="0"',
      '  os="10" xmlVersion="1.5"',
      '  application="hwpx-generator"',
      '  appVersion="0.1.0" />',
    ].join("\n");
    this.zip.file("version.xml", content, { compression: "STORE" });
  }

  addXml(path: string, content: string): void {
    this.zip.file(path, content, { compression: "DEFLATE" });
  }

  addBinary(path: string, data: Uint8Array): void {
    this.zip.file(path, data, { compression: "STORE" });
  }

  async toBytes(): Promise<Uint8Array> {
    return this.zip.generateAsync({ type: "uint8array" });
  }

  async toBlob(): Promise<Blob> {
    return this.zip.generateAsync({ type: "blob" });
  }

  /** Node.js 환경에서 파일 저장. */
  async save(filepath: string): Promise<void> {
    const data = await this.toBytes();
    const fs = await import("fs");
    fs.writeFileSync(filepath, data);
  }
}
