import { describe, it, expect } from "vitest";

import { normalizeLatexDelimiters } from "@/lib/chat/remark-latex";

describe("normalizeLatexDelimiters", () => {
  it("turns a display formula into a dollar block", () => {
    expect(normalizeLatexDelimiters("\\[x = y\\]")).toBe("$$x = y$$");
  });

  it("turns inline maths into a dollar span", () => {
    expect(normalizeLatexDelimiters("the value \\(x\\) here")).toBe(
      "the value $x$ here"
    );
  });

  it("keeps a formula that spans lines in one block", () => {
    const input = "before\n\n\\[\nP = \\frac{4}{52}\n\\]\n\nafter";
    // The line breaks are kept: a dollar block on its own lines is display
    // maths, which is what the model meant.
    expect(normalizeLatexDelimiters(input)).toBe(
      "before\n\n$$\nP = \\frac{4}{52}\n$$\n\nafter"
    );
  });

  it("leaves the dollar form alone", () => {
    expect(normalizeLatexDelimiters("$x$ and $$y$$")).toBe("$x$ and $$y$$");
  });

  it("leaves code samples alone", () => {
    const input = "```latex\n\\[ x = y \\]\n```";
    expect(normalizeLatexDelimiters(input)).toBe(input);
  });

  it("leaves a plain backslash path alone", () => {
    const input = "C:\\Users\\files and 50%";
    expect(normalizeLatexDelimiters(input)).toBe(input);
  });

  it("keeps the contents of a formula untouched", () => {
    expect(normalizeLatexDelimiters("\\[\\frac{1}{13}\\]")).toBe(
      "$$\\frac{1}{13}$$"
    );
  });
});
