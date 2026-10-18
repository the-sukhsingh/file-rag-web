import { NextResponse } from "next/server";
import { generateText, isStepCount, type ModelMessage } from "ai";
import { createGroq } from "@ai-sdk/groq";

import {
  MAX_AGENT_STEPS,
  buildWorkspaceSystemPrompt,
  createWorkspaceToolkit,
} from "@/lib/bash-tool";
import {
  WorkspaceLimitError,
  normalizeSessionId,
  type VfsFileInput,
} from "@/lib/server/vfs";
import type { CommandReport } from "@/lib/chat";

export const runtime = "nodejs";

/** Keep each reported command small; the tool already caps its own output. */
const MAX_REPORT_CHARS = 4_000;

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const model = groq("openai/gpt-oss-120b");

interface ToolCallLike {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

interface ToolResultLike {
  toolCallId: string;
  output: unknown;
}

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

  if (toolName === "bash" && typeof args.command === "string") {
    return args.command;
  }
  if (typeof args.path === "string") {
    return `${toolName === "readFile" ? "cat" : toolName} ${args.path}`;
  }
  return toolName;
}

function toCommandReport(
  call: ToolCallLike,
  output: unknown
): CommandReport {
  const command = describeCall(call.toolName, call.input);
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
      tool: call.toolName,
      command,
      stdout: stdout.text,
      stderr: stderr.text,
      exitCode:
        typeof result.exitCode === "number" ? result.exitCode : 0,
      truncated: stdout.truncated || stderr.truncated,
    };
  }

  if (typeof result.content === "string") {
    const stdout = trim(result.content);
    return {
      tool: call.toolName,
      command,
      stdout: stdout.text,
      stderr: "",
      exitCode: 0,
      truncated: stdout.truncated,
    };
  }

  return {
    tool: call.toolName,
    command,
    stdout: typeof output === "string" ? output : JSON.stringify(output ?? null),
    stderr: "",
    exitCode: result.success === false ? 1 : 0,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: unknown;
      files?: unknown;
      sessionId?: unknown;
    };

    const messages: ModelMessage[] = Array.isArray(body.messages)
      ? (body.messages as ModelMessage[])
      : [];

    if (!messages.length) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    // The client ships its whole workspace; the server mirrors it into the
    // session's virtual file system before the model gets the bash tool.
    const sessionId = normalizeSessionId(body.sessionId);
    const files = readFiles(body.files);

    const toolkit = await createWorkspaceToolkit({ sessionId, files });

    const system =
      toolkit.workspace.fileCount > 0
        ? buildWorkspaceSystemPrompt(toolkit)
        : [
            "You are a document retrieval assistant with a bash tool.",
            "The virtual file system is empty: no documents have been imported yet.",
            "Tell the user to import a PDF so there is something to search.",
          ].join(" ");

    const response = await generateText({
      model,
      system,
      messages,
      tools: toolkit.tools,
      stopWhen: isStepCount(MAX_AGENT_STEPS),
    });

    const commands = (response.toolCalls as ToolCallLike[]).map((call) => {
      const result = (response.toolResults as ToolResultLike[]).find(
        (candidate) => candidate.toolCallId === call.toolCallId
      );
      return toCommandReport(call, result?.output);
    });

    const message =
      response.text?.trim() ||
      (typeof response.output === "string" ? response.output.trim() : "");

    return NextResponse.json({
      message: message || "The workspace was searched, but no answer was produced.",
      commands,
      sessionId,
      workspace: {
        ...toolkit.workspace,
        stepCount: response.steps.length,
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);

    const status = error instanceof WorkspaceLimitError ? 413 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while processing your request",
      },
      { status }
    );
  }
}
