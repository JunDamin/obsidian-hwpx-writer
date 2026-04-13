/** 수식(Equation) -- 한컴 수식 스크립트 및 LaTeX 변환. */

import { xmlEscape, boolToStr } from "./utils";
import { XmlWriter } from "./XmlBuilder";
import { mm } from "./units";

export interface EquationInit {
  script?: string;
  latex?: string;
  width?: number;
  height?: number;
  inline?: boolean;
  version?: string;
  baseLine?: number;
  textColor?: string;
  baseUnit?: number;
  lineMode?: number;
  fontName?: string;
}

export class Equation {
  script: string;
  width: number;
  height: number;
  inline: boolean;
  version: string;
  baseLine: number;
  textColor: string;
  baseUnit: number;
  lineMode: number;
  fontName: string | undefined;

  constructor(init: EquationInit = {}) {
    if (init.latex) {
      this.script = LatexToHancomConverter.convert(init.latex);
    } else if (init.script) {
      this.script = init.script;
    } else {
      this.script = "";
    }

    this.width = init.width ?? mm(30);
    this.height = init.height ?? mm(10);
    this.inline = init.inline ?? true;
    this.version = init.version ?? "60";
    this.baseLine = init.baseLine ?? 0;
    this.textColor = init.textColor ?? "0";
    this.baseUnit = init.baseUnit ?? 1000;
    this.lineMode = init.lineMode ?? 0;
    this.fontName = init.fontName;
  }

  static fromLatex(latexStr: string): Equation {
    return new Equation({ latex: latexStr });
  }

  toXml(w: XmlWriter): void {
    w.start("hp:equation", {
      id: "",
      zOrder: "0",
      numberingType: "EQUATION",
      textWrap: "TOP_AND_BOTTOM",
      textFlow: "BOTH_SIDES",
      lock: "0",
      dropcapstyle: "None",
    });

    w.empty("hp:sz", {
      width: String(this.width),
      widthRelTo: "ABSOLUTE",
      height: String(this.height),
      heightRelTo: "ABSOLUTE",
      protect: "0",
    });

    w.empty("hp:pos", {
      treatAsChar: boolToStr(this.inline),
      affectLSpacing: "0",
      flowWithText: "1",
      allowOverlap: "0",
      holdAnchorAndSO: "0",
      vertRelTo: "PARA",
      horzRelTo: "PARA",
      vertAlign: "TOP",
      horzAlign: "LEFT",
      vertOffset: "0",
      horzOffset: "0",
    });

    w.empty("hp:outMargin", { left: "0", right: "0", top: "0", bottom: "0" });

    // equation script
    w.start("hp:script", {
      version: this.version,
      baseLine: String(this.baseLine),
      textColor: this.textColor,
      baseUnit: String(this.baseUnit),
      lineMode: String(this.lineMode),
    });
    w.raw(xmlEscape(this.script));
    w.end("hp:script");

    w.end("hp:equation");
  }
}


export class LatexToHancomConverter {
  /** LaTeX -> Hancom equation script basic converter. */

  private static readonly _REPLACEMENTS: [RegExp, string][] = [
    // fractions
    [/\\frac\{([^}]*)\}\{([^}]*)\}/g, "{$1} over {$2}"],
    // square root
    [/\\sqrt\{([^}]*)\}/g, "sqrt{$1}"],
    // super/subscript (braced)
    [/\^{([^}]*)}/g, "^{$1}"],
    [/_{([^}]*)}/g, "_{$1}"],
    // super/subscript (single char)
    [/\^(\w)/g, "^$1"],
    [/_(\w)/g, "_$1"],
    // Greek letters (lowercase)
    [/\\alpha/g, "alpha"], [/\\beta/g, "beta"], [/\\gamma/g, "gamma"],
    [/\\delta/g, "delta"], [/\\epsilon/g, "epsilon"], [/\\zeta/g, "zeta"],
    [/\\eta/g, "eta"], [/\\theta/g, "theta"], [/\\iota/g, "iota"],
    [/\\kappa/g, "kappa"], [/\\lambda/g, "lambda"], [/\\mu/g, "mu"],
    [/\\nu/g, "nu"], [/\\xi/g, "xi"], [/\\pi/g, "pi"],
    [/\\rho/g, "rho"], [/\\sigma/g, "sigma"], [/\\tau/g, "tau"],
    [/\\phi/g, "phi"], [/\\chi/g, "chi"], [/\\psi/g, "psi"],
    [/\\omega/g, "omega"],
    // Greek letters (uppercase)
    [/\\Alpha/g, "ALPHA"], [/\\Beta/g, "BETA"], [/\\Gamma/g, "GAMMA"],
    [/\\Delta/g, "DELTA"], [/\\Sigma/g, "SIGMA"], [/\\Omega/g, "OMEGA"],
    [/\\Pi/g, "PI"], [/\\Phi/g, "PHI"], [/\\Psi/g, "PSI"],
    // Large operators
    [/\\sum/g, "sum"], [/\\prod/g, "prod"],
    [/\\int/g, "int"], [/\\iint/g, "iint"], [/\\iiint/g, "iiint"],
    [/\\oint/g, "oint"],
    [/\\lim/g, "lim"],
    // Operators
    [/\\times/g, "times"], [/\\cdot/g, "cdot"], [/\\div/g, "div"],
    [/\\pm/g, "+-"], [/\\mp/g, "-+"],
    [/\\leq/g, "leq"], [/\\geq/g, "geq"], [/\\neq/g, "!="],
    [/\\approx/g, "approx"], [/\\equiv/g, "equiv"],
    // Arrows
    [/\\rightarrow/g, "rarrow"], [/\\leftarrow/g, "larrow"],
    [/\\Rightarrow/g, "drarrow"], [/\\Leftarrow/g, "dlarrow"],
    [/\\leftrightarrow/g, "lrarrow"],
    // Sets/logic
    [/\\in/g, "in"], [/\\notin/g, "notin"],
    [/\\subset/g, "subset"], [/\\supset/g, "supset"],
    [/\\cup/g, "union"], [/\\cap/g, "inter"],
    [/\\forall/g, "forall"], [/\\exists/g, "exists"],
    [/\\land/g, "land"], [/\\lor/g, "lor"], [/\\lnot/g, "lnot"],
    // Misc
    [/\\infty/g, "inf"], [/\\partial/g, "partial"],
    [/\\nabla/g, "nabla"], [/\\cdots/g, "cdots"],
    [/\\ldots/g, "ldots"], [/\\vdots/g, "vdots"],
    // Functions
    [/\\sin/g, "sin"], [/\\cos/g, "cos"], [/\\tan/g, "tan"],
    [/\\log/g, "log"], [/\\ln/g, "ln"], [/\\exp/g, "exp"],
    [/\\det/g, "det"], [/\\gcd/g, "gcd"],
    [/\\min/g, "min"], [/\\max/g, "max"],
    // Brackets
    [/\\left\(/g, "left ("], [/\\right\)/g, "right )"],
    [/\\left\[/g, "left ["], [/\\right\]/g, "right ]"],
    [/\\left\\{/g, "left lbrace"], [/\\right\\}/g, "right rbrace"],
    [/\\left\|/g, "left |"], [/\\right\|/g, "right |"],
    // Formatting
    [/\\mathbf\{([^}]*)\}/g, "bf{$1}"],
    [/\\mathrm\{([^}]*)\}/g, "rm{$1}"],
    [/\\mathit\{([^}]*)\}/g, "it{$1}"],
    [/\\mathcal\{([^}]*)\}/g, "cal{$1}"],
    // Decorations
    [/\\hat\{([^}]*)\}/g, "hat $1"],
    [/\\bar\{([^}]*)\}/g, "bar $1"],
    [/\\vec\{([^}]*)\}/g, "vec $1"],
    [/\\tilde\{([^}]*)\}/g, "tilde $1"],
    [/\\dot\{([^}]*)\}/g, "dot $1"],
    [/\\overline\{([^}]*)\}/g, "overline{$1}"],
    [/\\underline\{([^}]*)\}/g, "underline{$1}"],
    // Cleanup: remove remaining spacing commands
    [/\\,/g, " "], [/\\;/g, " "], [/\\!/g, ""], [/\\quad/g, "  "],
  ];

  static convert(latex: string): string {
    let result = latex;
    for (const [pattern, replacement] of LatexToHancomConverter._REPLACEMENTS) {
      result = result.replace(pattern, replacement);
    }
    // remaining \command -> command
    result = result.replace(/\\([a-zA-Z]+)/g, "$1");
    return result;
  }
}
