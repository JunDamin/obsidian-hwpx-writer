/** 표(Table) — Table, TableCell, 셀 병합. */

import { XmlWriter } from "./XmlBuilder";
import { boolToStr } from "./utils";
import { Paragraph } from "./Paragraph";

export class TableCell {
  paragraphs: Paragraph[] = [];
  colSpan = 1;
  rowSpan = 1;
  width = 0;
  height = 0;
  header = false;
  borderFillId = 1;
  protect = false;
  editable = false;
  marginLeft = 57;
  marginRight = 57;
  marginTop = 28;
  marginBottom = 28;
  textDirection = "HORIZONTAL";
  vertAlign = "CENTER";
  _colAddr = 0;
  _rowAddr = 0;

  addParagraph(textOrPara?: string | Paragraph, charPrId = 0, paraPrId = 0, styleId = 0): Paragraph {
    if (textOrPara instanceof Paragraph) {
      this.paragraphs.push(textOrPara);
      return textOrPara;
    }
    const p = new Paragraph(paraPrId, styleId);
    if (textOrPara) p.addRun(textOrPara, charPrId);
    this.paragraphs.push(p);
    return p;
  }

  toXml(w: XmlWriter): void {
    w.start("hp:tc", {
      name: "", header: boolToStr(this.header), hasMargin: "1",
      protect: boolToStr(this.protect), editable: boolToStr(this.editable),
      dirty: "0", borderFillIDRef: String(this.borderFillId),
    });
    w.start("hp:subList", {
      id: "", textDirection: this.textDirection, lineWrap: "BREAK",
      vertAlign: this.vertAlign, linkListIDRef: "0", linkListNextIDRef: "0",
      textWidth: "0", textHeight: "0", hasTextRef: "0", hasNumRef: "0",
    });
    if (this.paragraphs.length > 0) {
      for (const p of this.paragraphs) p.toXml(w);
    } else {
      new Paragraph().toXml(w);
    }
    w.end("hp:subList");
    w.empty("hp:cellAddr", { colAddr: String(this._colAddr), rowAddr: String(this._rowAddr) });
    w.empty("hp:cellSpan", { colSpan: String(this.colSpan), rowSpan: String(this.rowSpan) });
    w.empty("hp:cellSz", { width: String(this.width), height: String(this.height) });
    w.empty("hp:cellMargin", {
      left: String(this.marginLeft), right: String(this.marginRight),
      top: String(this.marginTop), bottom: String(this.marginBottom),
    });
    w.end("hp:tc");
  }
}

export class Table {
  rows: number;
  cols: number;
  colWidths: number[];
  totalWidth: number;
  rowHeight: number;
  pageBreak: string;
  repeatHeader: boolean;
  cellSpacing: number;
  borderFillId: number;
  treatAsChar: boolean;
  textWrap: string;
  textFlow: string;
  private cells: TableCell[][];

  constructor(opts: {
    rows: number; cols: number;
    colWidths?: number[]; totalWidth?: number;
    pageBreak?: string; repeatHeader?: boolean; cellSpacing?: number;
    borderFillId?: number; rowHeight?: number;
    treatAsChar?: boolean; textWrap?: string; textFlow?: string;
  }) {
    this.rows = opts.rows;
    this.cols = opts.cols;
    this.pageBreak = opts.pageBreak ?? "CELL";
    this.repeatHeader = opts.repeatHeader ?? false;
    this.cellSpacing = opts.cellSpacing ?? 0;
    this.borderFillId = opts.borderFillId ?? 1;
    this.treatAsChar = opts.treatAsChar ?? true;
    this.textWrap = opts.textWrap ?? "TOP_AND_BOTTOM";
    this.textFlow = opts.textFlow ?? "BOTH_SIDES";
    this.totalWidth = opts.totalWidth ?? 39686;
    this.rowHeight = opts.rowHeight ?? 2268;

    if (opts.colWidths) {
      this.colWidths = opts.colWidths;
    } else {
      const cw = Math.floor(this.totalWidth / this.cols);
      this.colWidths = Array(this.cols).fill(cw);
      this.colWidths[0] += this.totalWidth - cw * this.cols;
    }

    this.cells = [];
    for (let r = 0; r < this.rows; r++) {
      const row: TableCell[] = [];
      for (let c = 0; c < this.cols; c++) {
        const cell = new TableCell();
        cell._rowAddr = r;
        cell._colAddr = c;
        cell.width = this.colWidths[c];
        cell.height = this.rowHeight;
        row.push(cell);
      }
      this.cells.push(row);
    }
  }

  getCell(row: number, col: number): TableCell {
    return this.cells[row][col];
  }

  setCell(row: number, col: number, text = "", charPrId = 0, paraPrId = 0): TableCell {
    const cell = this.cells[row][col];
    cell.paragraphs = [];
    cell.addParagraph(text, charPrId, paraPrId);
    return cell;
  }

  setHeaderRow(texts: string[], opts?: {
    charPrId?: number; paraPrId?: number; headerBorderFillId?: number;
  }): void {
    for (let c = 0; c < Math.min(texts.length, this.cols); c++) {
      const cell = this.cells[0][c];
      cell.header = true;
      cell.paragraphs = [];
      cell.addParagraph(texts[c], opts?.charPrId ?? 0, opts?.paraPrId ?? 0);
      if (opts?.headerBorderFillId) cell.borderFillId = opts.headerBorderFillId;
    }
  }

  mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): void {
    const master = this.cells[startRow][startCol];
    master.colSpan = endCol - startCol + 1;
    master.rowSpan = endRow - startRow + 1;
    master.width = this.colWidths.slice(startCol, endCol + 1).reduce((a, b) => a + b, 0);
  }

  toXml(w: XmlWriter): void {
    const totalHeight = this.rowHeight * this.rows;
    w.start("hp:tbl", {
      id: "", zOrder: "0", numberingType: "TABLE",
      textWrap: this.textWrap, textFlow: this.textFlow,
      lock: "0", dropcapstyle: "None", pageBreak: this.pageBreak,
      repeatHeader: boolToStr(this.repeatHeader),
      rowCnt: String(this.rows), colCnt: String(this.cols),
      cellSpacing: String(this.cellSpacing),
      borderFillIDRef: String(this.borderFillId), noAdjust: "0",
    });
    w.empty("hp:sz", {
      width: String(this.totalWidth), widthRelTo: "ABSOLUTE",
      height: String(totalHeight), heightRelTo: "ABSOLUTE", protect: "0",
    });
    w.empty("hp:pos", {
      treatAsChar: boolToStr(this.treatAsChar), affectLSpacing: "0",
      flowWithText: "1", allowOverlap: "0", holdAnchorAndSO: "0",
      vertRelTo: "PARA", horzRelTo: "PARA", vertAlign: "TOP", horzAlign: "LEFT",
      vertOffset: "0", horzOffset: "0",
    });
    w.empty("hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });
    w.empty("hp:inMargin", { left: "0", right: "0", top: "0", bottom: "0" });

    for (let r = 0; r < this.rows; r++) {
      w.start("hp:tr");
      for (let c = 0; c < this.cols; c++) {
        this.cells[r][c].toXml(w);
      }
      w.end("hp:tr");
    }
    w.end("hp:tbl");
  }
}
