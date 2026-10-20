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
 * The answer arrives a token at a time, and the markdown is re-parsed on
 * every one of them. A half-written formula is not a formula yet, so the
 * parser has to cope with the pieces.
 */
const STREAM = [
  "",
  "P",
  "P(",
  "P(\\",
  "P(\\t",
  "P(\\text",
  "P(\\text{rolling",
  "P(\\text{rolling a 3",
  "P(\\text{rolling a 3})",
  "P(\\text{rolling a 3}) =",
  "P(\\text{rolling a 3}) = \\frac",
  "P(\\text{rolling a 3}) = \\frac{1}",
  "P(\\text{rolling a 3}) = \\frac{1}{6}",
  "P(\\text{rolling a 3}) = \\frac{1}{6} \\approx",
  "P(\\text{rolling a 3}) = \\frac{1}{6} \\approx 0.1667",
  "P(\\text{rolling a 3}) = \\frac{1}{6} \\approx 0.1667 [2].",
];

describe("a formula arriving a token at a time", () => {
  it("never renders an error while it is being written", () => {
    for (const frame of STREAM) {
      const html = render(frame);
      // A half-written formula may be shown as text, but it must never be
      // shown as a broken formula.
      expect(
        html,
        `failed on ${JSON.stringify(frame)}`
      ).not.toContain("katex-error");
    }
  });
});
