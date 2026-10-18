import { NextResponse } from "next/server";

import {
  WorkspaceLimitError,
  ensureWorkspaceSummary,
  listWorkspaceFiles,
  normalizeSessionId,
  resetWorkspace,
  writeWorkspaceFiles,
  type VfsFileInput,
} from "@/lib/server/vfs";

export const runtime = "nodejs";

/**
 * Workspace API for the server-side virtual file system.
 *
 * GET    /api/vfs?session=<id>  -> listing and stats
 * POST   /api/vfs               -> upload/update files, returns the listing
 * DELETE /api/vfs?session=<id>  -> drop the workspace
 */

function sessionFrom(request: Request): string {
  const url = new URL(request.url);
  return normalizeSessionId(url.searchParams.get("session"));
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

function fail(error: unknown, fallback: string) {
  const status = error instanceof WorkspaceLimitError ? 413 : 500;
  const message = error instanceof Error ? error.message : fallback;
  console.error("Workspace API error:", error);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const sessionId = sessionFrom(request);

  try {
    const files = await listWorkspaceFiles(sessionId);
    const summary = await ensureWorkspaceSummary(sessionId);
    return NextResponse.json({ ...summary, files });
  } catch (error) {
    return fail(error, "Could not read the workspace.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: unknown;
      files?: unknown;
    };
    const sessionId = normalizeSessionId(body.sessionId);
    const files = readFiles(body.files);

    if (!files.length) {
      return NextResponse.json(
        { error: "Provide at least one { path, content } file to upload." },
        { status: 400 }
      );
    }

    const saved = await writeWorkspaceFiles(sessionId, files);
    const summary = await ensureWorkspaceSummary(sessionId);

    return NextResponse.json({
      ...summary,
      uploaded: files.length,
      files: saved,
    });
  } catch (error) {
    return fail(error, "Could not write to the workspace.");
  }
}

export async function DELETE(request: Request) {
  const sessionId = sessionFrom(request);

  try {
    const existed = resetWorkspace(sessionId);
    return NextResponse.json({ sessionId, reset: existed });
  } catch (error) {
    return fail(error, "Could not reset the workspace.");
  }
}
