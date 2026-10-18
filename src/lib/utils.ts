export { cn } from "cn"

/**
 * Formats a count with the correct noun form, e.g. `pluralize(1, "chunk")`
 * becomes `"1 chunk"` while `pluralize(3, "chunk")` becomes `"3 chunks"`.
 * Pass `plural` for irregular nouns such as `pluralize(n, "entry", "entries")`.
 */
export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${count} ${count === 1 ? singular : plural}`
}
