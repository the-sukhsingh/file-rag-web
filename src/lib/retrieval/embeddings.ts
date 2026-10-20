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

export type EmbeddingStatus =
  | { state: "idle" }
  | { state: "loading"; progress: number; message: string }
  | { state: "ready"; model: string; dimensions: number }
  | { state: "unavailable"; reason: string };

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

type FeatureExtractor = (
  input: string | string[],
  options?: { pooling?: "mean" | "cls"; normalize?: boolean }
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

type PipelineFactory = (
  task: "feature-extraction",
  model: string,
  options?: Record<string, unknown>
) => Promise<FeatureExtractor>;

let pipelinePromise: Promise<FeatureExtractor> | null = null;
let cachedExtractor: FeatureExtractor | null = null;
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

async function loadExtractor(): Promise<FeatureExtractor> {
  if (cachedExtractor) return cachedExtractor;

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      setStatus({ state: "loading", progress: 0, message: "Fetching the model" });

      const transformers = (await import("@huggingface/transformers")) as unknown as {
        pipeline: PipelineFactory;
        env?: { allowLocalModels?: boolean; backends?: Record<string, unknown> };
      };

      // Everything runs locally: no model is pulled from a remote host other
      // than the model hub itself.
      if (transformers.env) {
        transformers.env.allowLocalModels = false;
        transformers.env.backends = transformers.env.backends ?? {};
      }

      const extractor = await transformers.pipeline(
        "feature-extraction",
        EMBEDDING_MODEL,
        {
          dtype: "q8",
          progress_callback: (info: unknown) => {
            const payload = info as {
              status?: string;
              progress?: number;
              file?: string;
            };
            if (payload.status === "progress" && typeof payload.progress === "number") {
              setStatus({
                state: "loading",
                progress: Math.round(payload.progress),
                message: `Downloading the model (${Math.round(payload.progress)}%)`,
              });
            } else if (payload.status === "done") {
              setStatus({ state: "loading", progress: 99, message: "Warming up" });
            }
          },
        }
      );

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
    const dims = output.dims ?? [texts.length, EMBEDDING_DIMENSIONS];

    const rows: number[][] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const offset = i * dims[dims.length - 1];
      const row: number[] = [];
      for (let j = 0; j < dims[dims.length - 1]; j += 1) {
        row.push(data[offset + j]);
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
