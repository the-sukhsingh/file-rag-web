import type { Chunk, RetrievedChunk } from "@/lib/library/types";

import { cosineSimilarity, embedText } from "./embeddings";
import { stem, tokenize } from "./tokenize";

/**
 * Hybrid retrieval.
 *
 * Two scorers run over the same candidate set and their results are blended:
 *
 *  - BM25, which is very good at the exact identifiers people paste in
 *    (a section number, a person's surname, `TCP handshake`).
 *  - Cosine similarity over the client-side embeddings, which finds the
 *    passage that means the right thing even when it shares no words with
 *    the question.
 *
 * The blend is a weighted sum, so a chunk that both scores well wins, and a
 * chunk that only one scorer likes still surfaces when the other finds
 * nothing.
 */

/** How much of the final score comes from the vector score. */
const SEMANTIC_WEIGHT = 0.6;
/** How much comes from the lexical score. */
const LEXICAL_WEIGHT = 0.4;

/** BM25 parameters, the usual defaults. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** How many chunks are handed to the model. */
export const DEFAULT_TOP_K = 6;

/** BM25 only returns a score above zero for a chunk that shares a term. */
const LEXICAL_FLOOR = 0.02;
/** Below this cosine similarity a semantic hit is not worth showing. */
const SEMANTIC_FLOOR = 0.2;

interface Bm25Index {
  /** Term -> how many chunks contain it. */
  documentFrequency: Map<string, number>;
  /** Term -> term frequency per chunk. */
  termFrequency: Map<string, number[]>;
  /** Length of every chunk, in tokens. */
  lengths: number[];
  averageLength: number;
}

function buildBm25Index(chunks: Chunk[]): Bm25Index {
  const documentFrequency = new Map<string, number>();
  const termFrequency = new Map<string, number[]>();
  const lengths: number[] = [];

  chunks.forEach((chunk, index) => {
    const tokens = chunk.tokens.length ? chunk.tokens : tokenize(chunk.text);
    lengths.push(tokens.length);

    const counts = new Map<string, number>();
    for (const token of tokens) {
      const term = stem(token);
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }

    for (const [term, count] of counts) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      const existing = termFrequency.get(term);
      if (existing) existing[index] = count;
      else termFrequency.set(term, [count]);
    }
  });

  const total = lengths.reduce((sum, length) => sum + length, 0);
  const averageLength = chunks.length ? total / chunks.length : 0;

  return { documentFrequency, termFrequency, lengths, averageLength };
}

function scoreBm25(
  index: Bm25Index,
  queryTokens: string[],
  chunkCount: number
): number[] {
  const scores = new Array<number>(chunkCount).fill(0);
  if (!chunkCount || !index.averageLength) return scores;

  for (const token of queryTokens) {
    const term = stem(token);
    const frequency = index.termFrequency.get(term);
    if (!frequency) continue;

    const df = index.documentFrequency.get(term) ?? 0;
    if (!df) continue;

    // BM25+ style idf floor, so a term that appears in every chunk cannot
    // push the score negative.
    const idf = Math.log(1 + (chunkCount - df + 0.5) / (df + 0.5));

    for (let i = 0; i < chunkCount; i += 1) {
      const tf = frequency[i] ?? 0;
      if (!tf) continue;

      const length = index.lengths[i] || 1;
      const denominator =
        tf + BM25_K1 * (1 - BM25_B + (BM25_B * length) / index.averageLength);
      scores[i] += idf * ((tf * (BM25_K1 + 1)) / denominator);
    }
  }

  return scores;
}

function normalize(values: number[]): number[] {
  const max = values.reduce((best, value) => Math.max(best, value), 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((value) => value / max);
}

export interface SearchOptions {
  /** How many chunks to return. */
  topK?: number;
  /** Chunks the user pinned into the context; they always come first. */
  pinnedChunkIds?: string[];
  /** Skip the embedding model and search lexically only. */
  lexicalOnly?: boolean;
}

export interface SearchResult {
  results: RetrievedChunk[];
  /** True when the vector part of the search actually ran. */
  semantic: boolean;
  /** The query as the retriever understood it. */
  queryTokens: string[];
}

/**
 * Searches a folder's chunks for the passages that answer a question.
 */
export async function searchChunks(
  chunks: Chunk[],
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const queryTokens = tokenize(query);

  if (!chunks.length) {
    return { results: [], semantic: false, queryTokens };
  }

  const index = buildBm25Index(chunks);
  const lexicalRaw = scoreBm25(index, queryTokens, chunks.length);
  const lexical = normalize(lexicalRaw);

  let semantic: number[] = new Array(chunks.length).fill(0);
  let usedSemantic = false;

  if (!options.lexicalOnly && query.trim()) {
    const queryVector = await embedText(query);
    if (queryVector) {
      usedSemantic = true;
      semantic = chunks.map((chunk) =>
        chunk.embedding ? cosineSimilarity(queryVector, chunk.embedding) : 0
      );
    }
  }

  const semanticNorm = usedSemantic ? normalize(semantic) : semantic;

  const scored: RetrievedChunk[] = chunks.map((chunk, index) => {
    const semanticScore = semanticNorm[index] ?? 0;
    const lexicalScore = lexical[index] ?? 0;
    const score = usedSemantic
      ? SEMANTIC_WEIGHT * semanticScore + LEXICAL_WEIGHT * lexicalScore
      : lexicalScore;

    let reason: RetrievedChunk["reason"] = "hybrid";
    if (!usedSemantic) reason = "lexical";
    else if (semanticScore > 0 && lexicalScore === 0) reason = "semantic";
    else if (semanticScore === 0 && lexicalScore > 0) reason = "lexical";

    return {
      chunk,
      score,
      semantic: usedSemantic ? semanticScore : undefined,
      lexical: lexicalScore,
      reason,
    };
  });

  // A chunk is only interesting if one of the scorers actually matched it.
  const relevant = scored.filter((entry) => {
    const lexicalHit = (entry.lexical ?? 0) >= LEXICAL_FLOOR;
    const semanticHit = (entry.semantic ?? 0) >= SEMANTIC_FLOOR;
    return lexicalHit || semanticHit;
  });

  relevant.sort((a, b) => b.score - a.score);

  const pinned = new Set(options.pinnedChunkIds ?? []);
  const pinnedResults = relevant.filter((entry) => pinned.has(entry.chunk.id));
  const rest = relevant.filter((entry) => !pinned.has(entry.chunk.id));
  const ordered = [...pinnedResults, ...rest].slice(0, topK);

  return { results: ordered, semantic: usedSemantic, queryTokens };
}

/**
 * Renders the retrieved passages as the numbered context blocks the model
 * reads. Each block carries its source so the answer can cite it.
 */
export function renderContext(
  results: RetrievedChunk[],
  options: { folderName: string }
): { text: string; citations: { chunkId: string; label: string }[] } {
  const citations: { chunkId: string; label: string }[] = [];

  const blocks = results.map((entry, index) => {
    const label = `[${index + 1}] ${entry.chunk.section} - ${
      entry.chunk.startPage ? `p.${entry.chunk.startPage}` : "chunk"
    }`;
    citations.push({ chunkId: entry.chunk.id, label });
    return `<source id="${index + 1}" title="${escapeXml(label)}">\n${entry.chunk.text}\n</source>`;
  });

  const text = [
    `Context from the folder "${options.folderName}".`,
    `Use the numbered sources below to answer. Cite them as [1], [2] and so on.`,
    `If the sources do not contain the answer, say so plainly.`,
    "",
    ...blocks,
  ].join("\n");

  return { text, citations };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
