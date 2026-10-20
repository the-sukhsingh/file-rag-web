import { putChunks, updateChunkEmbedding } from "@/lib/library/store";
import type { Chunk } from "@/lib/library/types";

import { embedTexts } from "./embeddings";

/**
 * The indexing pipeline.
 *
 * After a PDF is imported its chunks have text but no vectors. This fills in
 * the vectors, in batches, so the retriever can find passages by meaning and
 * not only by the exact words in the question.
 *
 * Indexing runs after the import has already been reported as done, so the
 * document is usable straight away with lexical search while the vectors
 * arrive in the background.
 */

/** How many chunks are embedded in one batch. */
const BATCH_SIZE = 16;

export interface IndexProgress {
  done: number;
  total: number;
}

export async function indexChunks(
  chunks: Chunk[],
  onProgress?: (progress: IndexProgress) => void
): Promise<number> {
  if (!chunks.length) return 0;

  const vectors = await embedTexts(chunks.map((chunk) => chunk.text));
  if (!vectors) {
    // The embedding model is unavailable. Lexical search still works, so this
    // is a downgrade and not a failure.
    return 0;
  }

  let done = 0;
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const batchVectors = vectors.slice(start, start + BATCH_SIZE);

    await Promise.all(
      batch.map((chunk, index) =>
        updateChunkEmbedding(chunk.id, batchVectors[index] ?? [])
      )
    );

    done += batch.length;
    onProgress?.({ done, total: chunks.length });

    // Let the browser paint between batches; the model and the UI share one
    // thread and a long import should not lock the page.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return done;
}

/**
 * Writes the vectors onto the chunks in one transaction, for the case where
 * the vectors were computed before the chunks were stored.
 */
export async function storeEmbeddings(
  chunks: Chunk[],
  vectors: number[][]
): Promise<void> {
  const withVectors = chunks.map((chunk, index) => ({
    ...chunk,
    embedding: vectors[index] ?? null,
  }));
  await putChunks(withVectors);
}
