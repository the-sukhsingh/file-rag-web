import type { Chunk, RetrievedChunk, TraceStep } from "@/lib/library/types";
import { renderContext, searchChunks } from "@/lib/retrieval/search";

import { complete, stream, type GroqMessage, type GroqOptions } from "./client";

/**
 * The retrieval agent.
 *
 * A question is answered in up to `MAX_ROUNDS` rounds. Each round retrieves
 * passages from the folder and asks the model whether they answer the
 * question; when they do not, the model rewrites the question into a better
 * search query and the next round runs with it. The last round streams the
 * answer, grounded in everything retrieved so far.
 *
 * The loop runs in the browser, against the user's own key, so the only
 * network call is to Groq.
 */

/** How many retrieve-then-check rounds run before the answer is written. */
export const MAX_ROUNDS = 3;

/** Below this retrieval score, the model is asked for a better query. */
const WEAK_RETRIEVAL_SCORE = 0.18;

const PLANNER_SYSTEM = [
  "You rewrite a user's question into a single search query for a document",
  "retrieval system. Reply with the query text only - no quotes, no preamble,",
  "no explanation. Keep the key nouns, names and identifiers of the original",
  "question, and drop anything conversational.",
].join(" ");

const ASSESS_SYSTEM = [
  "You judge whether retrieved document passages answer a user's question.",
  "Reply with exactly two lines:",
  "SUFFICIENT: yes or no",
  "QUERY: a better search query, or NONE if no better query exists.",
  "If the passages contain the answer, the answer is yes and the query is NONE.",
  "If they do not, the answer is no and the query must be a different phrasing",
  "of the same question that is likely to match other passages.",
].join(" ");

const ANSWER_SYSTEM = [
  "You answer questions about a folder of documents using only the retrieved",
  "passages you are given.",
  "",
  "Rules:",
  "- Use only what the passages say. Never invent facts, numbers or names.",
  "- Cite the passages you used with their bracketed number, like [1] or [2].",
  "- If the passages do not answer the question, say so directly and suggest",
  "  what to ask instead.",
  "- Answer in the language of the question.",
  "- Be concise and specific. Quote the phrases that matter.",
].join(" ");

export interface AgentRequest {
  question: string;
  folderName: string;
  /** The chunks of the folder being searched. */
  chunks: Chunk[];
  /** Chunk ids the user pinned into the context. */
  pinnedChunkIds?: string[];
  /** Chunks the user explicitly removed from the context. */
  excludedChunkIds?: string[];
  /** The conversation so far, oldest first. */
  history?: { role: "user" | "assistant"; content: string }[];
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

export interface AgentCallbacks {
  onTrace: (step: TraceStep) => void;
  onText: (delta: string) => void;
  onCitations: (chunkIds: string[]) => void;
  onDone?: () => void;
}

function createStep(
  kind: TraceStep["kind"],
  title: string,
  extra: Partial<TraceStep> = {}
): TraceStep {
  return {
    id: `step-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    kind,
    title,
    state: "running",
    ...extra,
  };
}

/** The context window the model gets: the passages retrieved so far. */
function buildContext(
  results: RetrievedChunk[],
  folderName: string
): { text: string; citations: { chunkId: string; label: string }[] } {
  return renderContext(results, { folderName });
}

/**
 * Runs one agent turn, streaming the answer and the trace as they happen.
 */
export async function runAgent(
  request: AgentRequest,
  callbacks: AgentCallbacks
): Promise<void> {
  const options: GroqOptions = {
    apiKey: request.apiKey,
    model: request.model,
    signal: request.signal,
  };

  const excluded = new Set(request.excludedChunkIds ?? []);
  const candidates = request.chunks.filter(
    (chunk) => !excluded.has(chunk.id)
  );

  if (!candidates.length) {
    callbacks.onText(
      "This folder has no indexed content yet. Import a PDF into it, or remove the context filters, and try again."
    );
    callbacks.onTrace(
      createStep("answer", "Nothing to search", { state: "done" })
    );
    callbacks.onDone?.();
    return;
  }

  /* ---- Round 1: the question as asked ------------------------------- */

  const planStep = createStep("plan", "Reading the question");
  callbacks.onTrace(planStep);

  let query = request.question;
  let accumulated: RetrievedChunk[] = [];
  const seen = new Set<string>();
  let rounds = 0;

  while (rounds < MAX_ROUNDS) {
    rounds += 1;

    const searchStep = createStep(
      "search",
      `Searching for "${truncate(query, 60)}"`,
      { detail: `Round ${rounds} of ${MAX_ROUNDS}` }
    );
    callbacks.onTrace(searchStep);

    const started = Date.now();
    const { results, semantic } = await searchChunks(candidates, query, {
      topK: 6,
      pinnedChunkIds: request.pinnedChunkIds,
    });

    const fresh = results.filter((entry) => !seen.has(entry.chunk.id));
    for (const entry of fresh) seen.add(entry.chunk.id);
    accumulated = [...accumulated, ...fresh];

    searchStep.state = "done";
    searchStep.durationMs = Date.now() - started;
    searchStep.chunkIds = fresh.map((entry) => entry.chunk.id);
    searchStep.detail = semantic
      ? `${fresh.length} passage${fresh.length === 1 ? "" : "s"} by meaning and keyword`
      : `${fresh.length} passage${fresh.length === 1 ? "" : "s"} by keyword`;
    callbacks.onTrace(searchStep);

    if (!accumulated.length) {
      // Nothing at all matched. Try one rewritten query, then give up.
      if (rounds >= MAX_ROUNDS) break;

      const rewritten = await rewriteQuery(request.question, query, options);
      if (!rewritten || rewritten.toLowerCase() === query.toLowerCase()) break;
      query = rewritten;
      continue;
    }

    if (rounds >= MAX_ROUNDS) break;

    /* ---- Ask the model whether this is enough ----------------------- */

    const bestScore = Math.max(...results.map((entry) => entry.score));
    if (bestScore >= 0.45) break;

    const assessment = await assessResults(
      request.question,
      accumulated,
      request.folderName,
      options
    );

    if (assessment.sufficient || !assessment.query) break;

    query = assessment.query;
  }

  /* ---- Final: write the answer -------------------------------------- */

  const answerStep = createStep("answer", "Writing the answer");
  callbacks.onTrace(answerStep);

  const { text, citations } = buildContext(accumulated, request.folderName);
  callbacks.onCitations(citations.map((citation) => citation.chunkId));

  const messages: GroqMessage[] = [
    { role: "system", content: ANSWER_SYSTEM },
    ...(request.history ?? []).map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: `${text}\n\nQuestion: ${request.question}` },
  ];

  const started = Date.now();
  try {
    await stream(messages, options, callbacks.onText);
    answerStep.state = "done";
  } catch (error) {
    answerStep.state = "failed";
    callbacks.onTrace(answerStep);
    throw error;
  }
  answerStep.durationMs = Date.now() - started;
  callbacks.onTrace(answerStep);
}

/**
 * Asks the model for a better search query for the question.
 */
async function rewriteQuery(
  question: string,
  previousQuery: string,
  options: GroqOptions
): Promise<string | null> {
  try {
    const reply = await complete(
      [
        { role: "system", content: PLANNER_SYSTEM },
        {
          role: "user",
          content: `Question: ${question}\nPrevious query: ${previousQuery}\nNew query:`,
        },
      ],
      options
    );
    const cleaned = reply.trim().split("\n")[0]?.trim() ?? "";
    return cleaned || null;
  } catch {
    return null;
  }
}

/**
 * Asks the model whether the retrieved passages are enough, and for a better
 * query if they are not.
 */
async function assessResults(
  question: string,
  results: RetrievedChunk[],
  folderName: string,
  options: GroqOptions
): Promise<{ sufficient: boolean; query: string | null }> {
  const { text } = buildContext(results, folderName);

  try {
    const reply = await complete(
      [
        { role: "system", content: ASSESS_SYSTEM },
        {
          role: "user",
          content: `Question: ${question}\n\nPassages:\n${text}`,
        },
      ],
      options
    );

    const sufficient = /sufficient:\s*yes/i.test(reply);
    const queryMatch = /query:\s*(.+)/i.exec(reply);
    const query = queryMatch?.[1]?.trim() ?? "";
    const usable = query && query.toUpperCase() !== "NONE" ? query : null;

    return { sufficient, query: usable };
  } catch {
    // If the assessment fails, the current results are the best we have.
    return { sufficient: true, query: null };
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
