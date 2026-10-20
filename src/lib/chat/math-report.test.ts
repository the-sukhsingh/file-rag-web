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
 * The answer the model wrote, captured verbatim, and the one from the report.
 */
const REPORTS = [
  `Thus, the probability is \\(\\displaystyle \\frac{1}{6}\\) (about 16.7%).`,
  `P(\\text{rolling a 3}) = \\frac{\\text{favorable outcomes}}{\\text{total outcomes}} = \\frac{1}{6} \\approx 0.1667 \\$ [2].`,
  `P(\\text{rolling a 3}) = \\frac{\\text{favorable outcomes}}{\\text{total outcomes}} = \\frac{1}{6} \\approx 0.1667 [2].`,
];

describe("the answers that were reported as broken", () => {
  for (const report of REPORTS) {
    it(`renders ${JSON.stringify(report).slice(0, 44)}`, () => {
      const html = render(report);
      expect(html).not.toContain("katex-error");
    });
  }
});

describe("a stray dollar sign", () => {
  it("does not break the formula next to it", () => {
    // A literal dollar in the same line as a formula makes the markdown
    // parser open a maths span on it, and the formula ends up inside that
    // span with a dollar in it - which KaTeX cannot parse.
    const html = render(
      "It costs $5 and P = \\frac{1}{6} \\approx 0.1667 [2]."
    );

    expect(html).not.toContain("katex-error");
  });

  it("does not break a formula that follows a stray dollar", () => {
    // The shape from the report: a formula on its own line, after a line
    // that has a literal dollar in it.
    const html = render(
      "It costs $5 or $6 depending.\n\nP(\\text{rolling a 3}) = \\frac{1}{6} \\approx 0.1667 [2]."
    );

    expect(html).not.toContain("katex-error");
  });
});
