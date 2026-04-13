/** HWPX Generator -- re-exports all public API. */

// Units
export { pt, mm, cm, inch, px, char, twips, hwpunitToPt, hwpunitToMm } from "./units";

// Constants
export {
  NS, MIMETYPE, XML_DECL,
  PAPER_A4, PAPER_A3, PAPER_B5, PAPER_B4, PAPER_LETTER, PAPER_LEGAL,
  LANG_GROUPS,
} from "./constants";

// Utilities
export { xmlEscape, boolToStr, colorToHwpx, IdCounter, generateBinId } from "./utils";

// XML Builder
export { XmlWriter } from "./XmlBuilder";

// ZIP Packager
export { HwpxZipPackager } from "./ZipPackager";

// Styles
export {
  Font, FontFace,
  CharProperties, ParaProperties,
  BorderLine, BorderFill,
  SolidFill, GradientFill, ImageFill,
  Style,
  createDefaultFontfaces, createDefaultStyles,
} from "./Styles";

// Paragraph
export { Paragraph, TextRun } from "./Paragraph";

// Table
export { Table, TableCell } from "./Table";

// Image
export { Image, Caption } from "./Image";

// Equation
export { Equation, LatexToHancomConverter } from "./Equation";

// Fields
export {
  FieldBase,
  Hyperlink, Bookmark, CrossRef, Citation, Bibliography,
  DateField, DocInfoField, ClickHere, Memo,
  Footnote, Endnote,
} from "./Fields";

// Header / Footer
export { Header, Footer, PageNum } from "./HeaderFooter";

// Drawing
export {
  DrawingObject,
  Rect, Ellipse, Line,
  TextBox, Arc,
  Polygon, Curve, ConnectLine,
} from "./Drawing";

// Section
export { Section, ColumnSetting } from "./Section";

// Document (top-level)
export { HwpxDocument } from "./Document";
