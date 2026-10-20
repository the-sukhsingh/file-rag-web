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
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(
      normalizeLatexDelimiters(normalizeCitations(source))
    )
    .toString();

/**
 * The shapes a model writes a formula in. Each one has to end up as maths and
 * not as an error.
 */
const FORMS = [
  // A display formula in the model's own delimiters.
  "\\[\nP(\\text{rolling a 3}) = \\frac{\\text{favorable outcomes}}{\\text{total outcomes}} = \\frac{1}{6} \\approx 0.1667\n\\]",
  // The same, inline.
  "The chance is \\(P = \\frac{1}{6}\\) exactly.",
  // The dollar forms.
  "The chance is $P = \\frac{1}{6}$ exactly.",
  "$$P = \\frac{1}{6}$$",
  // A formula with a citation right after it.
  "The chance is \\(P = \\frac{1}{6}\\) [2].",
  // A formula that stands alone with a citation.
  "P(\\text{rolling a 3}) = \\frac{1}{6} \\approx 0.1667 [2].",
  // A formula the model escaped the dollar sign in.
  "P(\\text{rolling a 3}) = \\frac{1}{6} \\approx 0.1667 \\$ [2].",
  // A formula with a text command holding punctuation.
  "\\(\\text{P(favorable outcomes)} = \\frac{1}{2}\\)",
  // A formula with a percent sign.
  "\\(P = 50\\%\\)",
  // A formula with an ampersand, which needs escaping.
  "\\(P(A \\& B)\\)",
  // Two formulas in one line.
  "\\(P = \\frac{1}{6}\\) and \\(Q = \\frac{1}{2}\\)",
  // A formula with a comma inside a text command.
  "\\(\\text{one, two} = \\frac{1}{2}\\)",
];

describe("every shape of formula", () => {
  for (const form of FORMS) {
    it(`renders ${JSON.stringify(form).slice(0, 46)}`, () => {
      const html = render(form);
      expect(html).not.toContain("katex-error");
    });
  }
});
