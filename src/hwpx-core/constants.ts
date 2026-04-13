/** 상수 및 네임스페이스 정의. */

export const NS: Record<string, string> = {
  hh: "http://www.hancom.co.kr/hwpml/2011/head",
  hp: "http://www.hancom.co.kr/hwpml/2011/paragraph",
  hs: "http://www.hancom.co.kr/hwpml/2011/section",
  hc: "http://www.hancom.co.kr/hwpml/2011/core",
  ha: "http://www.hancom.co.kr/hwpml/2011/app",
  hv: "http://www.hancom.co.kr/hwpml/2011/version",
  hm: "http://www.hancom.co.kr/hwpml/2011/master-page",
  hhs: "http://www.hancom.co.kr/hwpml/2011/history",
  hp10: "http://www.hancom.co.kr/hwpml/2016/paragraph",
  hpf: "http://www.hancom.co.kr/schema/2011/hpf",
  hwpunitchar: "http://www.hancom.co.kr/hwpml/2016/HwpUnitChar",
  ocf: "urn:oasis:names:tc:opendocument:xmlns:container",
  opf: "http://www.idpf.org/2007/opf/",
  config: "urn:oasis:names:tc:opendocument:xmlns:config:1.0",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
};

export const MIMETYPE = "application/hwp+zip";
export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';

export const PAPER_A4: [number, number] = [59530, 84190];
export const PAPER_A3: [number, number] = [84190, 119060];
export const PAPER_B5: [number, number] = [49951, 70866];
export const PAPER_B4: [number, number] = [72816, 103034];
export const PAPER_LETTER: [number, number] = [61200, 79200];
export const PAPER_LEGAL: [number, number] = [61200, 100800];

export const LANG_GROUPS = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
