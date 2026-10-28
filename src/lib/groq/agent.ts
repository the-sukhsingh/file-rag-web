import type { Chunk, RetrievedChunk, TraceStep } from "@/lib/library/types";
import { normalizeCitations } from "@/lib/chat/remark-latex";
import { renderContext, searchChunks } from "@/lib/retrieval/search";
import {
  SHELL_INSTRUCTIONS,
  createWorkspaceShell,
  type WorkspaceShell,
} from "@/lib/shell/workspace-shell";

import {
  complete,
  stream,
  streamWithTools,
  type GroqMessage,
  type GroqOptions,
  type GroqTool,
} from "./client";

/**
 * The retrieval agent.
 *
 * The agent has two ways of reaching the library, and it uses both:
 *
 *  - The vector search finds passages by meaning, which is how it finds the
 *    passage that answers a question nobody worded exactly.
 *  - The shell reaches the same passages as files, which is how it finds an
 *    exact term, a name, a number, or reads a whole chapter in order.
 *
 * A question is answered in up to `MAX_ROUNDS` rounds. Each round retrieves
 * passages and asks the model whether they answer the question; when they do
 * not, the model rewrites the question into a better search query and the
 * next round runs with it. The last round streams the answer, grounded in
 * everything retrieved so far.
 *
 * The loop runs in the browser, against the user's own key, so the only
 * network call is to Groq.
 */

/** How many retrieve-then-check rounds run before the answer is written. */
export const MAX_ROUNDS = 3;

/**
 * A retrieval above this score is trusted without asking the model whether it
 * is enough, which saves a round trip on the common case.
 */
const CONFIDENT_RETRIEVAL_SCORE = 0.45;

/** How many shell commands the agent may run in one question. */
const MAX_SHELL_COMMANDS = 4;

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
  "passages and the files you read with the shell.",
  "",
  "Rules:",
  "- Use only what the passages and files say. Never invent facts, numbers or",
  "  names.",
  "- Cite every passage you used with its bracketed number, like [1] or [2].",
  "  The numbers are the ones in front of the passages you were given - the",
  "  passages are labelled 1, 2, 3 and so on.",
  "- Never cite a line number from a command's output. A citation is always a",
  "  passage number, never something like [1:4].",
  "- If the passages do not answer the question, say so directly and suggest",
  "  what to ask instead.",
  "- If no passage matched at all, say that the folder does not seem to cover",
  "  the question, and name what it does cover.",
  "- Answer in the language of the question.",
  "- Be concise and specific. Quote the phrases that matter.",
].join(" ");

/** The tool the agent uses to reach the passages as files. */
const SHELL_TOOL: GroqTool = {
  name: "shell",
  description: [
    "Run a shell command over the passages of this folder, which are mounted",
    "as markdown files. Use grep to find an exact term across every passage,",
    "ls to list the documents and chapters, and cat to read a passage.",
    "The working directory is /workspace.",
  ].join(" "),
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "The command line to run, for example: grep -rn \"probability\" /workspace",
      },
    },
    required: ["command"],
  },
};

export interface AgentRequest {
  question: string;
  folderName: string;
  /** The chunks of the folder being searched. */
  chunks: Chunk[];
  /** The document names, so the files are mounted under readable names. */
  documentNames?: Map<string, string>;
  /** Chunk ids the user pinned into the context. */
  pinnedChunkIds?: string[];
  /** Chunk ids the user explicitly removed from the context. */
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
 * The passages the answer actually leaned on.
 *
 * The model cites them as `[1]`, `[2]` and so on, in the order they were
 * given to it. The answer is scanned for those markers and only the passages
 * behind them are kept, so the sources row lists what was used rather than
 * everything that was retrieved.
 */
export function extractCitedChunks(
  answer: string,
  results: RetrievedChunk[]
): string[] {
  const cited = new Set<string>();

  // The markers are `[1]`, but the model sometimes writes `[1, 2]` or `[1][2]`,
  // and it sometimes uses the full-width brackets `【1】` instead. The markers
  // are normalised first, so one shape is matched.
  const pattern = /\[(\d+(?:\s*[,;]\s*\d+)*)\]/g;

  for (const match of normalizeCitations(answer).matchAll(pattern)) {
    for (const part of match[1].split(/[,;]/)) {
      const index = Number.parseInt(part.trim(), 10);
      if (Number.isNaN(index)) continue;

      const entry = results[index - 1];
      if (entry) cited.add(entry.chunk.id);
    }
  }

  return [...cited];
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
  planStep.state = "done";
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
    if (bestScore >= CONFIDENT_RETRIEVAL_SCORE) break;

    const assessment = await assessResults(
      request.question,
      accumulated,
      request.folderName,
      options
    );

    if (assessment.sufficient || !assessment.query) break;

    query = assessment.query;
  }

  /* ---- Give the model the shell as well ---------------------------- */

  const shell = await createWorkspaceShell(
    candidates,
    request.documentNames ?? new Map()
  );

  const { text: finalText, citations, passages } = await answerWithShell({
    question: request.question,
    folderName: request.folderName,
    accumulated,
    shell,
    history: request.history,
    options,
    onTrace: callbacks.onTrace,
    onText: callbacks.onText,
  });

  /* ---- Only the passages the answer used ---------------------------- */

  const usedIds = new Set(extractCitedChunks(finalText, accumulated));
  const usedCitations = citations.filter((citation) =>
    usedIds.has(citation.chunkId)
  );

  callbacks.onCitations(usedCitations.map((citation) => citation.chunkId));

  void passages;
}

/**
 * Writes the answer, giving the model the shell to reach for more passages
 * while it writes.
 */
async function answerWithShell({
  question,
  folderName,
  accumulated,
  shell,
  history,
  options,
  onTrace,
  onText,
}: {
  question: string;
  folderName: string;
  accumulated: RetrievedChunk[];
  shell: WorkspaceShell;
  history?: { role: "user" | "assistant"; content: string }[];
  options: GroqOptions;
  onTrace: AgentCallbacks["onTrace"];
  onText: (delta: string) => void;
}): Promise<{
  text: string;
  citations: { chunkId: string; label: string }[];
  passages: RetrievedChunk[];
}> {
  const { text: context, citations } = buildContext(accumulated, folderName);

  const messages: GroqMessage[] = [
    {
      role: "system",
      content: [ANSWER_SYSTEM, "", SHELL_INSTRUCTIONS].join("\n"),
    },
    ...(history ?? []).map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    {
      role: "user",
      content: `${context}\n\nQuestion: ${question}`,
    },
  ];

  // The model may ask for a command before it writes. Each command is run
  // and its output handed back, until the model answers.
  let commandsRun = 0;
  let toolCalls: GroqMessage["toolCalls"];

  while (commandsRun < MAX_SHELL_COMMANDS) {
    // The text is streamed, so the reader watches the answer being written
    // rather than waiting for the whole thing. A tool call comes back whole,
    // because it has to run before the answer can continue.
    const reply = await streamWithTools(
      messages,
      { ...options, tools: [SHELL_TOOL] },
      onText
    );

    if (!reply.toolCalls.length) {
      // The model has written its answer.
      return { text: reply.content, citations, passages: accumulated };
    }

    toolCalls = reply.toolCalls;
    messages.push({
      role: "assistant",
      content: reply.content,
      toolCalls,
    });

    const results = toolCalls.map((call) => {
      const command = parseCommand(call.arguments);
      return { call, command };
    });

    const outputs: { id: string; content: string }[] = [];

    for (const { call, command } of results) {
      commandsRun += 1;

      const commandStep = createStep("command", command);
      const started = Date.now();
      onTrace(commandStep);

      try {
        const result = await shell.run(command);
        onTrace({
          ...commandStep,
          state: result.exitCode === 0 ? "done" : "failed",
          detail: truncate((result.stderr || result.stdout).trim(), 160),
          exitCode: result.exitCode,
          durationMs: Date.now() - started,
          chunkIds: chunkIdsForOutput(result.stdout, shell),
        });
        outputs.push({
          id: call.id,
          content: result.stdout || result.stderr || "(no output)",
        });
      } catch (error) {
        onTrace({
          ...commandStep,
          state: "failed",
          detail: error instanceof Error ? error.message : "The command could not be completed.",
          durationMs: Date.now() - started,
        });
        throw error;
      }
    }

    messages.push({ role: "assistant", content: "", toolResults: outputs });
  }

  // The model kept asking for commands. It gets the last word now, with
  // whatever the shell found.
  let answer = "";
  await stream(
    [
      ...messages,
      {
        role: "user",
        content:
          "Answer the question now, using the passages and the command output above. Cite the passages you used.",
      },
    ],
    options,
    (delta) => {
      answer += delta;
      onText(delta);
    }
  );

  return { text: answer, citations, passages: accumulated };
}

/**
 * Pulls the command out of the arguments the model produced.
 */
function parseCommand(args: string): string {
  try {
    const parsed = JSON.parse(args) as { command?: unknown };
    if (typeof parsed.command === "string") return parsed.command;
  } catch {
    // The model produced something that is not JSON; try the raw string.
  }
  return String(args).replace(/^["']|["']$/g, "").trim();
}

/**
 * The passages a command's output came from.
 */
function chunkIdsForOutput(
  stdout: string,
  shell: WorkspaceShell
): string[] {
  const ids = new Set<string>();

  for (const [path, chunkId] of shell.chunkByPath) {
    // The file name appears in the output when grep or cat is used.
    const name = path.split("/").pop();
    if (name && stdout.includes(name)) ids.add(chunkId);
  }

  return [...ids];
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
