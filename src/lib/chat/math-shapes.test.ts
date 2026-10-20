import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

import {
  normalizeCitations,
  normalizeLatexDelimiters,
} from "@/lib/chat/remark-latex";

const render = (source: string) =>
  unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { throwOnError: false })
    .use(rehypeStringify)
    .processSync(
      normalizeLatexDelimiters(normalizeCitations(source))
    )
    .toString();

/**
 * Every way a model can write a formula, and every way it can go wrong.
 *
 * The failure that was reported - a formula in red - happens when the maths
 * parser is handed something with a dollar sign in it, or with a stray
 * bracket. Both are legal in an answer and neither is legal in maths.
 */
const SHAPES = [
  // The model's own display delimiters.
  "\\[\nP = \\frac{1}{6}\n\\]",
  // Its inline delimiters.
  "The chance \\(P = \\frac{1}{6}\\) here.",
  // The dollar forms.
  "The chance $P = \\frac{1}{6}$ here.",
  "$$P = \\frac{1}{6}$$",
  // A literal dollar next to a formula.
  "It costs $5, and P = \\frac{1}{6}.",
  // A literal dollar inside the model's own delimiters.
  "The chance is \\(P = \\frac{1}{6}\\), so $5 of it.",
  // A formula and a citation.
  "P = \\frac{1}{6} [2].",
  // A formula and a full-width citation.
  "P = \\frac{1}{6} 【2】.",
  // A formula with a percent.
  "\\(P = 50\\%\\)",
  // A formula with an ampersand.
  "\\(P(A \\& B)\\)",
  // A formula with a comma in the text.
  "\\(\\text{one, two} = \\frac{1}{2}\\)",
  // A formula with a square root.
  "\\(P = \\sqrt{\\frac{1}{2}}\\)",
  // A formula with an underscore.
  "\\(P_x = \\frac{1}{6}\\)",
  // A formula with a line break inside it.
  "\\[P = \\frac{1}{6}\n\\approx 0.1667\\]",
  // A formula with a trailing period.
  "\\[P = \\frac{1}{6}.\\]",
  // A formula with a trailing comma.
  "\\[P = \\frac{1}{6},\\]",
];

describe("every shape a formula can take", () => {
  for (const shape of SHAPES) {
    it(`renders ${JSON.stringify(shape).slice(0, 44)}`, () => {
      const html = render(shape);
      expect(
        html,
        `the formula was rejected: ${JSON.stringify(shape)}`
      ).not.toContain("katex-error");
    });
  }
});
