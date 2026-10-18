import { NextResponse } from "next/server";

import {
  WorkspaceLimitError,
  normalizeSessionId,
  runWorkspaceCommand,
  type VfsFileInput,
} from "@/lib/server/vfs";

export const runtime = "nodejs";

/**
 * Runs a bash command against the session workspace.
 *
 * The workspace is the same just-bash sandbox the model's bash tool uses, so
 * `curl http -d '{"command":"grep -rn online ."}'` is a quick way to check what
 * the agent would see. The sandbox is simulated: it has no network access and no
 * host file system, only the in-memory workspace.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: unknown;
      command?: unknown;
      files?: unknown;
    };

    const sessionId = normalizeSessionId(body.sessionId);
    const command = typeof body.command === "string" ? body.command : "";
    const files: VfsFileInput[] = Array.isArray(body.files)
      ? (body.files as VfsFileInput[])
      : [];

    if (!command.trim()) {
      return NextResponse.json(
        { error: "Provide a bash command to run." },
        { status: 400 }
      );
    }

    const result = await runWorkspaceCommand(sessionId, command, files);

    return NextResponse.json({ sessionId, ...result });
  } catch (error) {
    const status = error instanceof WorkspaceLimitError ? 413 : 500;
    console.error("Workspace exec error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not run the command.",
      },
      { status }
    );
  }
}
