import { NextResponse } from "next/server";
import {
  isStepCount,
  streamText,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { createGroq } from "@ai-sdk/groq";

import {
  MAX_AGENT_STEPS,
  buildToolNameRule,
  buildWorkspaceSystemPrompt,
  createWorkspaceToolkit,
  type WorkspaceToolkit,
} from "@/lib/bash-tool";
import {
  WorkspaceLimitError,
  normalizeSessionId,
  type VfsFileInput,
} from "@/lib/server/vfs";
import type { AskStreamEvent } from "@/lib/chat";

export const runtime = "nodejs";

/** Keep each reported command small; the tool already caps its own output. */
const MAX_REPORT_CHARS = 4_000;

/** Said instead of silence when the agent searches but never writes an answer. */
const NO_ANSWER_AFTER_SEARCH =
  "I searched the workspace but did not manage to write an answer. The steps above show the commands I ran and what they returned.";
const NO_ANSWER = "I could not produce an answer for that request.";

/** What the model is told when its turn ends before it has written anything. */
const ANSWER_NUDGE = [
  "Stop searching and answer the question now, in prose, using only the command",
  "output above. Quote the paths of the files you read. Do not run any more",
  "commands, and do not describe what you would look up next.",
].join(" ");

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const model = groq("openai/gpt-oss-120b");

const encoder = new TextEncoder();

function readFiles(value: unknown): VfsFileInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { path, content } = entry as { path?: unknown; content?: unknown };
    if (typeof path !== "string" || typeof content !== "string") return [];
    return [{ path, content }];
  });
}

function trim(value: string): { text: string; truncated: boolean } {
  if (value.length <= MAX_REPORT_CHARS) return { text: value, truncated: false };
  return {
    text: `${value.slice(0, MAX_REPORT_CHARS)}\n[... ${value.length - MAX_REPORT_CHARS} more characters]`,
    truncated: true,
  };
}

/** Renders a tool call the way the user would have typed it. */
function describeCall(toolName: string, input: unknown): string {
  const args = (input ?? {}) as { command?: unknown; path?: unknown };

  if (typeof args.command === "string") return args.command;
  if (typeof args.path === "string") return `${toolName} ${args.path}`;
  return toolName;
}

/** Normalizes whatever a tool returned into the fields the trace renders. */
function toResultFields(output: unknown): {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated?: boolean;
} {
  const result = (output ?? {}) as {
    stdout?: unknown;
    stderr?: unknown;
    exitCode?: unknown;
    content?: unknown;
    success?: unknown;
  };

  if (
    typeof result.stdout === "string" ||
    typeof result.stderr === "string" ||
    typeof result.exitCode === "number"
  ) {
    const stdout = trim(typeof result.stdout === "string" ? result.stdout : "");
    const stderr = trim(typeof result.stderr === "string" ? result.stderr : "");
    return {
      stdout: stdout.text,
      stderr: stderr.text,
      exitCode: typeof result.exitCode === "number" ? result.exitCode : 0,
      truncated: stdout.truncated || stderr.truncated,
    };
  }

  if (typeof result.content === "string") {
    const stdout = trim(result.content);
    return { stdout: stdout.text, stderr: "", exitCode: 0, truncated: stdout.truncated };
  }

  const stdout = trim(
    typeof output === "string" ? output : JSON.stringify(output ?? null)
  );
  return {
    stdout: stdout.text,
    stderr: "",
    exitCode: result.success === false ? 1 : 0,
    truncated: stdout.truncated,
  };
}

/**
 * Matches the provider error raised when the model calls a tool that was never
 * advertised: `attempted to call tool 'cat' which was not in request.tools`.
 */
const UNKNOWN_TOOL =
  /attempted to call tool '([^']+)' which was not in request\.tools/i;

/** Pulls the offending tool name out of a provider error, if that is what it is. */
function attemptedToolName(error: unknown): string | undefined {
  const body = (error as { responseBody?: unknown })?.responseBody;
  const text = [
    error instanceof Error ? error.message : String(error),
    typeof body === "string" ? body : "",
  ].join("\n");

  return UNKNOWN_TOOL.exec(text)?.[1];
}

/**
 * Streams a closing answer for a turn that ended without one.
 *
 * The agent often spends its whole command budget searching, or its last step
 * comes back empty; either way the research is in the step transcript, not in
 * the conversation, so it is replayed with the tool declared but not callable
 * (`toolChoice: "none"`) and the model is told to answer from it. That turns
 * "ran six commands and said nothing" into prose the user can read, grounded in
 * output the model actually saw.
 */
async function* streamClosingAnswer({
  system,
  messages,
  transcript,
  tools,
  fallback,
  signal,
}: {
  system: string;
  messages: ModelMessage[];
  transcript: ModelMessage[];
  tools: ToolSet;
  fallback: string;
  signal?: AbortSignal;
}): AsyncGenerator<AskStreamEvent> {
  try {
    const result = streamText({
      model,
      system,
      messages: [...messages, ...transcript, { role: "user", content: ANSWER_NUDGE }],
      tools,
      // The tool stays declared so the tool calls in the transcript remain
      // valid, but the model cannot reach for it while answering.
      toolChoice: "none",
      abortSignal: signal,
    });

    let wrote = false;

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        if (part.text) {
          wrote = true;
          yield { type: "text", delta: part.text };
        }
      } else if (part.type === "error") {
        throw part.error instanceof Error
          ? part.error
          : new Error(String(part.error));
      }
    }

    if (wrote) return;
  } catch (error) {
    // A cancelled request (the reader closed the page) needs no report.
    if (signal?.aborted) return;

    console.error("Error writing the closing answer:", error);
  }

  yield { type: "text", delta: fallback };
}

/**
 * Streams one agent turn, as events the client can render while they arrive:
 * answer text as it is written, and each command as it starts and finishes.
 *
 * Throws on a model or provider failure, which the caller turns into an `error`
 * event (or a retry).
 */
async function* streamTurn({
  system,
  messages,
  tools,
  signal,
}: {
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
  signal?: AbortSignal;
}): AsyncGenerator<AskStreamEvent> {
  const result = streamText({
    model,
    system,
    messages,
    tools,
    stopWhen: isStepCount(MAX_AGENT_STEPS),
    abortSignal: signal,
  });

  let ranCommand = false;
  let reasoningChars = 0;

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        if (part.text) yield { type: "text", delta: part.text };
        break;

      case "reasoning-delta":
        reasoningChars += part.text?.length ?? 0;
        break;

      case "tool-call":
        ranCommand = true;
        yield {
          type: "command",
          id: part.toolCallId,
          tool: part.toolName,
          command: describeCall(part.toolName, part.input),
        };
        break;

      case "tool-result":
        yield { type: "result", id: part.toolCallId, ...toResultFields(part.output) };
        break;

      case "error":
        throw part.error instanceof Error
          ? part.error
          : new Error(String(part.error));

      default:
        break;
    }
  }

  // A turn that ran commands but wrote nothing used to end the request with a
  // 500: `result.output` throws NoOutputGeneratedError unless an output schema
  // was requested, and `result.text` was empty. `text` is the last step's text,
  // so an empty one means the model stopped mid-search - out of steps, or an
  // empty completion - rather than that it answered earlier in the turn.
  const text = (await result.text)?.trim() ?? "";
  if (text) return;

  const steps = await result.steps;
  console.warn(
    `[ask] no answer after ${steps.length} step(s), ${reasoningChars} reasoning char(s), last step ran ${ranCommand ? "commands" : "nothing"}; asking for a closing answer.`
  );

  yield* streamClosingAnswer({
    system,
    messages,
    transcript: steps.flatMap((step) => step.response.messages),
    tools,
    fallback: ranCommand ? NO_ANSWER_AFTER_SEARCH : NO_ANSWER,
    signal,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
    files?: unknown;
    sessionId?: unknown;
  } | null;

  const messages: ModelMessage[] = Array.isArray(body?.messages)
    ? (body.messages as ModelMessage[])
    : [];

  if (!messages.length) {
    return NextResponse.json(
      { error: "Message content is required" },
      { status: 400 }
    );
  }

  let toolkit: WorkspaceToolkit;
  const sessionId = normalizeSessionId(body?.sessionId);

  try {
    // The client ships its whole workspace; the server mirrors it into the
    // session's virtual file system before the model gets the bash tool.
    toolkit = await createWorkspaceToolkit({
      sessionId,
      files: readFiles(body?.files),
    });
  } catch (error) {
    console.error("Error preparing the workspace:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while preparing the workspace",
      },
      { status: error instanceof WorkspaceLimitError ? 413 : 500 }
    );
  }

  const system =
    toolkit.workspace.fileCount > 0
      ? buildWorkspaceSystemPrompt(toolkit)
      : [
          "You are a document retrieval assistant with access to a virtual file system.",
          "The file system is empty: no documents have been imported yet.",
          "Tell the user to import a PDF so there is something to search.",
          buildToolNameRule(toolkit.toolNames),
        ].join(" ");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;

      const send = (event: AskStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client went away mid-stream.
          open = false;
        }
      };

      try {
        send({ type: "start", sessionId });

        let emitted = false;
        let failure: unknown;
        let attemptMessages = messages;

        // Providers reject the whole request - non-retryably - when the model
        // invents a tool name. Retry once with a correction, as long as nothing
        // has been streamed yet, so a mistake costs a round trip and not a turn.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          failure = undefined;

          try {
            for await (const event of streamTurn({
              system,
              messages: attemptMessages,
              tools: toolkit.tools,
              signal: request.signal,
            })) {
              emitted = true;
              send(event);
            }
          } catch (error) {
            failure = error;
          }

          if (!failure) break;

          const attempted = attemptedToolName(failure);
          if (emitted || !attempted) break;

          console.warn(
            `Model called unadvertised tool "${attempted}"; retrying with the tool list.`
          );

          attemptMessages = [
            ...messages,
            {
              role: "user",
              content: [
                `You called a tool named "${attempted}", which does not exist.`,
                buildToolNameRule(toolkit.toolNames),
                "Retry the request using that tool.",
              ].join(" "),
            },
          ];
        }

        if (failure) {
          send({
            type: "error",
            message:
              failure instanceof Error
                ? failure.message
                : "The request failed while streaming the answer",
          });
        } else {
          send({ type: "done" });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by the client cancelling the response.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
