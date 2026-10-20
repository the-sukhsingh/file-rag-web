/**
 * LaTeX delimiters and citation markers.
 *
 * A model asked to write maths reaches for `\[...\]` and `\(...\)` far more
 * often than for `$...$`, and the markdown maths parser only knows the
 * dollar forms. Left alone, the delimiters would be shown as literal text.
 *
 * The rewrite happens on the markdown source, before it is parsed, so the
 * maths parser sees the forms it knows. The contents are never touched.
 */

/** `\[ ... \]` becomes a display maths block. */
const DISPLAY = /\\\[([\s\S]*?)\\\]/g;

/** `\( ... \)` becomes inline maths. */
const INLINE = /\\\(([\s\S]*?)\\\)/g;

/** `$$ ... $$` on one line, which some models write inline. */
const DISPLAY_DOLLAR = /\$\$([^\n]+?)\$\$/g;

/**
 * Flattens a formula onto one line.
 *
 * A model writes a display formula across several lines, and the markdown
 * parser splits a `$$` block at a newline - so the second half of the formula
 * becomes a maths node of its own, which is not a formula and is rejected.
 * The line breaks inside the formula are not meaningful to LaTeX.
 */
function flatten(body: string): string {
  return body.replace(/\s*\n\s*/g, " ").trim();
}

/**
 * Rewrites the delimiters in a markdown document.
 *
 * Fenced code blocks are left alone, so a document that shows LaTeX in a
 * code sample still shows it as code.
 */
export function normalizeLatexDelimiters(markdown: string): string {
  const fences: string[] = [];

  // The code blocks are set aside while the delimiters are rewritten, and
  // put back afterwards.
  const withoutCode = markdown.replace(
    /```[\s\S]*?```|~~~[\s\S]*?~~~/g,
    (block) => {
      fences.push(block);
      return ` CODE${fences.length - 1} `;
    }
  );

  const rewritten = withoutCode
    .replace(DISPLAY_DOLLAR, (_match, body: string) => `$$${flatten(body)}$$`)
    .replace(DISPLAY, (_match, body: string) => `$$${flatten(body)}$$`)
    .replace(INLINE, (_match, body: string) => `$${flatten(body)}$`);

  return rewritten.replace(/ CODE(\d+) /g, (_match, index: string) =>
    fences[Number(index)] ?? ""
  );
}

/**
 * The citation markers a model writes, in the shapes it writes them.
 *
 * Most are `[1]`, but some models use the full-width `【1】`, and some attach
 * a line reference from a command's output - `【1†L4】` - which is not a
 * passage number and would confuse the reader.
 */
const CITATIONS = [
  // A passage with a line reference: `【1†L4】` or `[1:4]`.
  { pattern: /[【[]\s*(\d+)\s*[†:]\s*L?\d+\s*[】\]]/g, replacement: "[$1]" },
  // More than one, in the full-width brackets: `【1, 2】`.
  { pattern: /【\s*(\d+(?:\s*,\s*\d+)+)\s*】/g, replacement: "[$1]" },
  // The full-width brackets: `【1】`.
  { pattern: /【\s*(\d+)\s*】/g, replacement: "[$1]" },
];

/**
 * Normalises the citation markers in an answer.
 */
export function normalizeCitations(text: string): string {
  return CITATIONS.reduce(
    (current, { pattern, replacement }) =>
      current.replace(pattern, replacement),
    text
  );
}
