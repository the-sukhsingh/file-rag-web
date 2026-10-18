import { createBashTool, type BashToolkit } from "bash-tool";

import {
  WORKSPACE_ROOT,
  workspaceSandbox,
  workspaceSnapshot,
  type VfsFileInput,
} from "@/lib/server/vfs";

/**
 * Binds the server-side virtual file system to bash tools the model can call.
 *
 * Files are materialized into the session sandbox before the tools are handed
 * over, so `ls`, `cat`, `grep` and friends all operate on the real workspace
 * paths the client uploaded.
 */

/** Hard ceiling on tool calls per user turn, so one question cannot loop. */
export const MAX_AGENT_STEPS = 6;

/** Shared with both the bash tool description and the chat system prompt. */
export const AGENT_INSTRUCTIONS = [
  "The workspace mirrors the user's imported documents: one folder per chapter",
  "and one markdown file per chunk, all under the working directory.",
  "Search with the bash tool before answering - grep for keywords, then cat or",
  "head the matching chunks. Never invent file paths or contents, and quote the",
  "paths you actually read so the user can open them.",
].join(" ");

export interface WorkspaceToolkit {
  tools: BashToolkit["tools"];
  /** Description of the sandbox for logging and diagnostics. */
  workspace: {
    workingDirectory: string;
    fileCount: number;
    folderCount: number;
    filePaths: string[];
  };
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

  const { tools } = await createBashTool({
    sandbox,
    files: Object.fromEntries(snapshot.map((file) => [file.path, file.content])),
    destination: WORKSPACE_ROOT,
    extraInstructions: AGENT_INSTRUCTIONS,
  });

  return {
    tools,
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
    "You are a document retrieval assistant with a bash tool.",
    "",
    `A virtual file system is mounted at ${workingDirectory} (your current working directory).`,
    `It holds ${fileCount} file(s) across ${folderCount} folder(s) in markdown.`,
    AGENT_INSTRUCTIONS,
    "",
    "Answer with the retrieved text only. If the workspace does not contain the",
    "answer, say so instead of guessing.",
  ].join("\n");
}
