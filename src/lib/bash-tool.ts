import { createBashTool } from "bash-tool";
import type { ToolSet } from "ai";

import {
  WORKSPACE_ROOT,
  workspaceSandbox,
  workspaceSnapshot,
  type VfsFileInput,
} from "@/lib/server/vfs";
import { createWorkspaceTools } from "@/lib/workspace-tools";

/**
 * Binds the server-side virtual file system to the tools the model can call.
 *
 * Two layers are merged:
 *
 * - `bash`, `readFile` and `writeFile` from bash-tool, which run arbitrary
 *   commands and stream whole files.
 * - The retrieval tools from `workspace-tools` (`ls`, `tree`, `find`, `grep`,
 *   `cat`, `head`, `tail`, `wc`), the commands a model reaches for by name when
 *   it goes looking for information. Providers reject a tool call whose name
 *   was never advertised, so those names have to exist as tools too.
 *
 * Files are materialized into the session sandbox before the tools are handed
 * over, so every tool operates on the real workspace paths the client uploaded.
 */

/** Hard ceiling on tool calls per user turn, so one question cannot loop. */
export const MAX_AGENT_STEPS = 6;

/** Shared with both the bash tool description and the chat system prompt. */
export const AGENT_INSTRUCTIONS = [
  "The workspace mirrors the user's imported documents: one folder per chapter",
  "and one markdown file per chunk, all under the working directory.",
  "Search before you answer: use the grep tool to find a keyword, then the cat,",
  "head or tail tool to read the matching chunks. Never invent file paths or",
  "contents, and quote the paths you actually read so the user can open them.",
].join(" ");

export interface WorkspaceToolkit {
  tools: ToolSet;
  /** Names of every tool handed to the model, in the order they are given. */
  toolNames: string[];
  /** Description of the sandbox for logging and diagnostics. */
  workspace: {
    workingDirectory: string;
    fileCount: number;
    folderCount: number;
    filePaths: string[];
  };
}

/**
 * Tells the model which tool names exist. Naming them explicitly, and saying
 * that anything else aborts the request, is what keeps the model from
 * inventing a tool the provider then rejects.
 */
export function buildToolNameRule(toolNames: string[]): string {
  return [
    `Available tools, by exact name: ${toolNames.join(", ")}.`,
    "Call only those names - the provider rejects the whole request when a tool",
    "you call was not advertised.",
  ].join(" ");
}

export async function createWorkspaceToolkit({
  sessionId,
  files = [],
}: {
  sessionId: string;
  files?: VfsFileInput[];
}): Promise<WorkspaceToolkit> {
  const snapshot = await workspaceSnapshot(sessionId, files);
  const sandbox = await workspaceSandbox(sessionId);

  const { tools: bashTools } = await createBashTool({
    sandbox,
    files: Object.fromEntries(snapshot.map((file) => [file.path, file.content])),
    destination: WORKSPACE_ROOT,
    extraInstructions: AGENT_INSTRUCTIONS,
  });

  const tools: ToolSet = {
    ...bashTools,
    ...createWorkspaceTools(sessionId),
  };

  return {
    tools,
    toolNames: Object.keys(tools),
    workspace: {
      workingDirectory: WORKSPACE_ROOT,
      fileCount: snapshot.length,
      folderCount: new Set(
        snapshot
          .map((file) => file.path.split("/").slice(0, -1).join("/"))
          .filter(Boolean)
      ).size,
      filePaths: snapshot.map((file) => file.path),
    },
  };
}

/** Instruction block prepended to chat requests that carry a workspace. */
export function buildWorkspaceSystemPrompt(toolkit: WorkspaceToolkit): string {
  const { workingDirectory, fileCount, folderCount } = toolkit.workspace;

  return [
    "You are a document retrieval assistant with access to a virtual file system.",
    "",
    `The file system is mounted at ${workingDirectory} (your current working directory).`,
    `It holds ${fileCount} file(s) across ${folderCount} folder(s) in markdown.`,
    AGENT_INSTRUCTIONS,
    buildToolNameRule(toolkit.toolNames),
    "",
    "Answer with the retrieved text only. If the workspace does not contain the",
    "answer, say so instead of guessing.",
  ].join("\n");
}
