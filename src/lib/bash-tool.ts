import { createBashTool } from "bash-tool";
import type { ToolSet } from "ai";

import {
  WORKSPACE_ROOT,
  workspaceSandbox,
  workspaceSnapshot,
  type VfsFileInput,
} from "@/lib/server/vfs";

/**
 * Binds the server-side virtual file system to the single tool the model calls.
 *
 * The agent does not get one tool per command. It gets `bash`, and it sends the
 * whole command - a complete shell line, pipeline or multi-command script - in
 * one call. Listing, searching and reading are all the same tool:
 *
 *   ls -R
 *   grep -rn "cache key" . | head -20
 *   cat 'Chapter 1/chunk-004.md'
 *
 * That keeps the tool block to one schema, so every step of the agent loop
 * carries a fraction of the prompt a per-command tool set costs, and it lets the
 * model gather everything it needs in one round trip instead of one call per
 * command. `ls`, `grep` and `cat` stay shell commands; naming them as tools is
 * what the provider rejects.
 *
 * Files are materialized into the session sandbox before the tool is handed
 * over, so commands operate on the real workspace paths the client uploaded.
 */

/** Hard ceiling on tool calls per user turn, so one question cannot loop. */
export const MAX_AGENT_STEPS = 6;

/** Shared with both the bash tool description and the chat system prompt. */
export const AGENT_INSTRUCTIONS = [
  "The workspace mirrors the user's imported documents: one folder per chapter",
  "and one markdown file per chunk, all under the working directory.",
  "Send the whole command in one call: `ls -R` for the structure, then",
  "`grep -rn \"keyword\" .` to locate text, then `cat` the matching file to read",
  "it. Batch whatever you need into a single pipeline or script rather than",
  "spending a round trip per command.",
  `You get at most ${MAX_AGENT_STEPS} command rounds per question, and you must`,
  "finish with the written answer: the round after your last command is prose",
  "that answers the question, never another command. If you are near that limit,",
  "answer from what you have already read.",
  "Never invent file paths or contents, and quote the paths you actually read so",
  "the user can open them.",
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
 * Spells out that the listed names are the only callable tools, and that the
 * commands the agent reaches for are arguments to them. Calling a command by
 * name makes the provider reject the whole request, so this rule is stated in
 * both the populated and the empty-workspace prompts.
 */
export function buildToolNameRule(toolNames: string[]): string {
  return [
    `Available tools, by exact name: ${toolNames.join(", ")}.`,
    "Every retrieval action is a bash command you pass to it - `ls`, `grep`,",
    "`cat`, `find`, `head` and `tail` are commands, not tools, and the provider",
    "rejects the request when one is called by name.",
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

  // One tool. bash-tool also offers readFile and writeFile, but `cat` and shell
  // redirection already cover both through the same single schema.
  const tools: ToolSet = { bash: bashTools.bash };

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
    "You are a document retrieval assistant with shell access to a virtual file system.",
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
