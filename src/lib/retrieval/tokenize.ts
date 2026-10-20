/**
 * A small tokenizer for lexical search.
 *
 * Words are lowercased, split on anything that is not a letter or a digit,
 * and the common English stop words are dropped. Numbers survive, because
 * "2024" is often the thing the user is looking for.
 */

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "all", "am", "an", "and", "any",
  "are", "as", "at", "be", "because", "been", "before", "being", "below",
  "between", "both", "but", "by", "can", "did", "do", "does", "doing", "down",
  "during", "each", "few", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "herself", "him", "himself", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me",
  "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on",
  "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over",
  "own", "s", "same", "she", "should", "so", "some", "such", "t", "than",
  "that", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "we", "were", "what", "when", "where", "which",
  "while", "who", "whom", "why", "will", "with", "would", "you", "your",
  "yours", "yourself", "yourselves",
]);

/** Words that are too short to be meaningful on their own. */
const MIN_TOKEN_LENGTH = 2;

/**
 * Splits text into lowercase tokens with the stop words removed.
 */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g);
  if (!matches) return [];

  const tokens: string[] = [];
  for (const match of matches) {
    const token = match.replace(/^['-]+|['-]+$/g, "");
    if (token.length < MIN_TOKEN_LENGTH) continue;
    if (STOP_WORDS.has(token)) continue;
    tokens.push(token);
  }
  return tokens;
}

/**
 * A light suffix stripper, so "chapters" and "chapter" land on the same stem.
 * It is deliberately shallow: enough to bridge the most common inflections
 * without mangling technical words.
 */
export function stem(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith("ies") && token.length > 5) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ing") && token.length > 6) {
    return token.slice(0, -3);
  }
  if (token.endsWith("ed") && token.length > 5) {
    return token.slice(0, -2);
  }
  if (token.endsWith("es") && token.length > 5) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}
