import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

const render = (source: string) =>
  unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .processSync(source)
    .toString();

/**
 * A formula the model wrote with no delimiters at all. The markdown parser
 * does not treat it as maths on its own, so it has to be recognised.
 */
const BARE = [
  "P(\\text{rolling a 3}) = \\frac{\\text{favorable outcomes}}{\\text{total outcomes}} = \\frac{1}{6} \\approx 0.1667 [2].",
  "P(E) = \\frac{1}{2}",
  "\\frac{1}{2}",
];

describe("a formula with no delimiters", () => {
  for (const source of BARE) {
    it(`does not error on ${JSON.stringify(source).slice(0, 40)}`, () => {
      const html = render(source);
      expect(html).not.toContain("katex-error");
    });
  }

  it("shows what markdown does with a bare formula", () => {
    const html = render(BARE[0]);
    console.log("HTML:", html.slice(0, 400));
    console.log("ERROR?", html.includes("katex-error"));
  });
});
