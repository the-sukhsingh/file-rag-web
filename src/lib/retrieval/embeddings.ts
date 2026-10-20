/**
 * Client-side embeddings.
 *
 * The library is embedded in the browser with a small sentence-transformer
 * (all-MiniLM-L6-v2, ~23 MB quantized) that is fetched once and cached by the
 * browser. No document text leaves the machine - which is the same promise
 * the BYOK model call keeps.
 *
 * If the model cannot be fetched (offline, blocked CDN, no WebAssembly), the
 * pipeline reports itself unavailable and retrieval falls back to BM25 alone.
 * The app stays usable, it just answers with lexical matches only.
 */

/**
 * The callable shape of the pipeline. The published type describes the class,
 * but the factory hands back a plain function with the same options.
 */
type Extractor = (
  texts: string | string[],
  options?: { pooling?: "mean" | "cls"; normalize?: boolean }
) => Promise<{ data: Float32Array; dims: number[] }>;

export type EmbeddingStatus =
  | { state: "idle" }
  | { state: "loading"; progress: number; message: string }
  | { state: "ready"; model: string; dimensions: number }
  | { state: "unavailable"; reason: string };

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

let pipelinePromise: Promise<Extractor> | null = null;
let cachedExtractor: Extractor | null = null;
let status: EmbeddingStatus = { state: "idle" };

const listeners = new Set<(status: EmbeddingStatus) => void>();

function setStatus(next: EmbeddingStatus) {
  status = next;
  for (const listener of listeners) listener(next);
}

/** Subscribes to the loading state, so the UI can show progress. */
export function onEmbeddingStatus(
  listener: (status: EmbeddingStatus) => void
): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getEmbeddingStatus(): EmbeddingStatus {
  return status;
}

/** True when vectors are available for semantic search. */
export function hasEmbeddings(): boolean {
  return status.state === "ready" && cachedExtractor !== null;
}

async function loadExtractor(): Promise<Extractor> {
  if (cachedExtractor) return cachedExtractor;

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      setStatus({ state: "loading", progress: 0, message: "Fetching the model" });

      const { pipeline, env } = await import("@huggingface/transformers");

      // Everything runs locally: the model is fetched once from the hub and
      // then cached by the browser.
      env.allowLocalModels = false;

      const extractor = (await pipeline("feature-extraction", EMBEDDING_MODEL, {
        // The quantized weights are a single ~23 MB file, which the browser
        // caches and never has to fetch again.
        dtype: "q8",
        progress_callback: (info: unknown) => {
          const payload = info as {
            status?: string;
            progress?: number;
          };
          if (
            payload.status === "progress" &&
            typeof payload.progress === "number"
          ) {
            setStatus({
              state: "loading",
              progress: Math.round(payload.progress),
              message: `Downloading the model (${Math.round(payload.progress)}%)`,
            });
          } else if (payload.status === "done") {
            setStatus({ state: "loading", progress: 99, message: "Warming up" });
          }
        },
      })) as Extractor;

      return extractor;
    })().catch((error: unknown) => {
      pipelinePromise = null;
      const reason =
        error instanceof Error
          ? error.message
          : "The embedding model could not be loaded";
      setStatus({ state: "unavailable", reason });
      throw error;
    });
  }

  cachedExtractor = await pipelinePromise;
  setStatus({
    state: "ready",
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return cachedExtractor;
}

/**
 * Loads the model ahead of time, so the first import does not wait for it.
 */
export async function warmUpEmbeddings(): Promise<void> {
  try {
    await loadExtractor();
  } catch {
    // The status already carries the reason; retrieval works without it.
  }
}

/**
 * Embeds a batch of texts.
 *
 * Returns null when the model is unavailable, which tells the caller to
 * retrieve with BM25 only rather than pretending the search was semantic.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!texts.length) return [];

  try {
    const extractor = await loadExtractor();
    const output = await extractor(texts, { pooling: "mean", normalize: true });

    const data = output.data;
    const width = output.dims[output.dims.length - 1];

    const rows: number[][] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const offset = i * width;
      const row: number[] = new Array(width);
      for (let j = 0; j < width; j += 1) {
        row[j] = data[offset + j];
      }
      rows.push(row);
    }
    return rows;
  } catch {
    return null;
  }
}

/** Embeds a single text. */
export async function embedText(text: string): Promise<number[] | null> {
  const result = await embedTexts([text]);
  return result ? result[0] ?? null : null;
}

/** Cosine similarity of two normalized vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
}
