/**
 * Styles aggregator — 하위호환용 re-export.
 *
 * 이 파일은 과거에 Font/FontFace, CharProperties, ParaProperties,
 * BorderLine/BorderFill, SolidFill/GradientFill/ImageFill, Style 을
 * 한 파일(987줄)에 모두 담았다. Phase 2 리팩토링으로 개념별 파일로 분리했으며
 * 기존 `import ... from "./Styles"` 경로를 깨지 않기 위해 이 aggregator가 존재한다.
 *
 * 새 코드는 각 개념 파일에서 직접 import할 것을 권장한다.
 */

export { Font, FontFace, type FontInit, type FontFaceInit } from "./Font";
export { CharProperties, type CharPropertiesInit } from "./CharProperties";
export { ParaProperties, type ParaPropertiesInit } from "./ParaProperties";
export {
  SolidFill, GradientFill, ImageFill,
  type SolidFillInit, type GradientFillInit, type ImageFillInit,
  type FillType,
} from "./Fills";
export { BorderLine, BorderFill, type BorderLineInit, type BorderFillInit } from "./BorderFill";
export { Style, createDefaultFontfaces, createDefaultStyles, type StyleInit } from "./Style";
