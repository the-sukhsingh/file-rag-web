import { createBashTool, type Sandbox } from "bash-tool";
import { Bash, type DefenseInDepthConfig } from "just-bash";

/**
 * Server-side virtual file system.
 *
 * The browser parses the PDF and owns the source of truth for a moment, but
 * every request ships the resulting chunks here, where they are mirrored into a
 * per-session in-memory workspace. The workspace is backed by a just-bash
 * sandbox, so the files are addressable as real paths and any bash command
 * (`ls`, `cat`, `grep`, `find`, `wc`, ...) can be run against them.
 *
 * State lives in module scope. That is deliberately simple: a dev server keeps
 * it for the lifetime of the process, and a redeploy starts from a clean
 * workspace that the client re-seeds on its next request.
 */

/** Where the sandbox mounts the workspace. Also the bash working directory. */
export const WORKSPACE_ROOT = "/workspace";

/** Used when a request does not carry a session id. */
export const DEFAULT_SESSION_ID = "default";

export interface VfsFileInput {
  /** Path relative to the workspace root, e.g. `Abstract/chunk-001.md`. */
  path: string;
  content: string;
}

export interface VfsFileMeta {
  path: string;
  size: number;
  updatedAt: string;
}

export interface VfsSummary {
  sessionId: string;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  fileNames: string[];
  createdAt: string;
  lastUsedAt: string;
  commandCount: number;
}

export interface CommandOutput {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** A single mirrored file plus the metadata the API reports back. */
interface WorkspaceFile {
  content: string;
  size: number;
  updatedAt: string;
}

interface WorkspaceState {
  sessionId: string;
  sandbox: Sandbox;
  files: Map<string, WorkspaceFile>;
  createdAt: number;
  lastUsedAt: number;
  commandCount: number;
}

const MAX_FILES = 1000;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_WORKSPACES = 24;
const WORKSPACE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_OUTPUT_LENGTH = 12_000;
const MAX_PATH_LENGTH = 240;
const MAX_COMMAND_LENGTH = 2_000;

/**
 * just-bash's defense-in-depth box is enabled by default, but it patches
 * process globals and, while a script is running, blocks those globals for any
 * async work that inherited the sandbox context - including host runtime work
 * such as Next's request handling and React's scheduler. That is why a plain
 * `/api/ask` request dies with:
 *
 *   SecurityViolationError: globalThis.performance.now is blocked during
 *   script execution
 *
 * The excluded types below are the host-runtime hooks (timers, timing, stack
 * traces, weak refs, proxies, module loading, env reads, late promise
 * callbacks) that the shell, Next and React all rely on. The actual escape
 * vectors stay enforced: `Function`, `eval` and the async/generator
 * constructors, `WebAssembly`, shared memory/atomics, `process.binding`/
 * `dlopen`/`exit`/`kill` and prototype/JSON/Math mutation. Because those
 * constructor guards are what gate every JavaScript escape, secondary hygiene
 * patches are not worth crashing the request path over.
 *
 * The box is a process-wide singleton whose config must match across every
 * `Bash` instance, so this object holds only comparable values - no callbacks,
 * which would compare by reference and conflict between dev module instances.
 * If a future just-bash release leaks another type, either add it here or set
 * `enabled: false` to drop the box entirely.
 */
export const DEFENSE_IN_DEPTH: DefenseInDepthConfig = {
  excludeViolationTypes: [
    "performance_timing",
    "process_timing",
    "error_prepare_stack_trace",
    "setTimeout",
    "setInterval",
    "setImmediate",
    "weak_ref",
    "finalization_registry",
    "reflect",
    "proxy",
    "process_env",
    "module_load",
    "module_resolve_filename",
    "promise_then_after_deactivate",
  ],
};

/**
 * Held on `globalThis` so a dev-server module reload (or a second bundle of
 * this module) reuses the same sandboxes instead of building new `Bash`
 * instances - which would also re-trigger the defense-config singleton check.
 */
const workspaceRegistry = globalThis as typeof globalThis & {
  __fileRagWorkspaces?: Map<string, WorkspaceState>;
  __fileRagWorkspaceCreations?: Map<string, Promise<WorkspaceState>>;
};

const workspaces: Map<string, WorkspaceState> =
  (workspaceRegistry.__fileRagWorkspaces ??= new Map());
const creations: Map<string, Promise<WorkspaceState>> =
  (workspaceRegistry.__fileRagWorkspaceCreations ??= new Map());

export class WorkspaceLimitError extends Error {}

/* -------------------------------------------------------------------------- */
/*  Paths and session ids                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Turns untrusted client input into a safe workspace-relative path, or null
 * when it cannot be one. Absolute paths are re-rooted, separators normalized,
 * control characters dropped, and anything escaping the root is rejected.
 */
export function normalizeWorkspacePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .replace(/\\/g, "/")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  const segments = cleaned.split("/").filter((s) => s && s !== ".");
  if (!segments.length) return null;
  if (segments.some((segment) => segment === "..")) return null;

  const path = segments.join("/");
  return path.length <= MAX_PATH_LENGTH ? path : null;
}

export function normalizeSessionId(raw: unknown): string {
  if (typeof raw === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.trim())) {
    return raw.trim();
  }
  return DEFAULT_SESSION_ID;
}

/**
 * Validates, deduplicates and caps an incoming file list. Later entries win, so
 * a client can update a chunk by sending the same path again.
 */
function normalizeFiles(files: VfsFileInput[]): VfsFileInput[] {
  const byPath = new Map<string, VfsFileInput>();
  let totalBytes = 0;

  for (const file of files) {
    if (!file || typeof file.content !== "string") continue;
    const path = normalizeWorkspacePath(file.path);
    if (!path) continue;

    totalBytes -= byPath.get(path)?.content.length ?? 0;
    totalBytes += file.content.length;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new WorkspaceLimitError(
        `Workspace is limited to ${MAX_TOTAL_BYTES / (1024 * 1024)} MB of text.`
      );
    }

    byPath.set(path, { path, content: file.content });
  }

  if (byPath.size > MAX_FILES) {
    throw new WorkspaceLimitError(
      `Workspace is limited to ${MAX_FILES} files, received ${byPath.size}.`
    );
  }

  return [...byPath.values()];
}

/* -------------------------------------------------------------------------- */
/*  Workspace lifecycle                                                       */
/* -------------------------------------------------------------------------- */

function toMeta(state: WorkspaceState): VfsFileMeta[] {
  return [...state.files.entries()]
    .map(([path, file]) => ({
      path,
      size: file.size,
      updatedAt: file.updatedAt,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

async function syncFiles(state: WorkspaceState, files: VfsFileInput[]) {
  const writes: Array<{ path: string; content: string }> = [];
  const now = new Date().toISOString();

  for (const file of files) {
    // Skip no-op uploads so re-sending the whole workspace stays cheap.
    if (state.files.get(file.path)?.content === file.content) continue;
    writes.push({ path: `${WORKSPACE_ROOT}/${file.path}`, content: file.content });
  }

  if (writes.length) await state.sandbox.writeFiles(writes);

  for (const file of files) {
    state.files.set(file.path, {
      content: file.content,
      size: file.content.length,
      updatedAt: now,
    });
  }
}

async function createWorkspace(
  sessionId: string,
  files: VfsFileInput[]
): Promise<WorkspaceState> {
  // The sandbox is built here rather than by `createBashTool` because the
  // defense-in-depth configuration is only settable on the Bash instance.
  const bash = new Bash({
    // Paths must be absolute under the destination: just-bash writes relative
    // keys to the file-system root, not to `cwd`.
    files: Object.fromEntries(
      files.map((file) => [`${WORKSPACE_ROOT}/${file.path}`, file.content])
    ),
    cwd: WORKSPACE_ROOT,
    defenseInDepth: DEFENSE_IN_DEPTH,
  });

  const { sandbox } = await createBashTool({
    sandbox: bash,
    destination: WORKSPACE_ROOT,
    maxFiles: MAX_FILES,
    maxOutputLength: MAX_OUTPUT_LENGTH,
  });

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const state: WorkspaceState = {
    sessionId,
    sandbox,
    files: new Map(
      files.map((file) => [
        file.path,
        { content: file.content, size: file.content.length, updatedAt: nowIso },
      ])
    ),
    createdAt: now,
    lastUsedAt: now,
    commandCount: 0,
  };

  return state;
}

function evictStaleWorkspaces() {
  const cutoff = Date.now() - WORKSPACE_TTL_MS;
  for (const [sessionId, state] of workspaces) {
    if (state.lastUsedAt < cutoff) workspaces.delete(sessionId);
  }
}

function evictOldestWorkspaces() {
  while (workspaces.size > MAX_WORKSPACES) {
    const oldest = [...workspaces.values()].sort(
      (a, b) => a.lastUsedAt - b.lastUsedAt
    )[0];
    if (!oldest) return;
    workspaces.delete(oldest.sessionId);
  }
}

/**
 * Returns the session workspace, seeding or updating it with `files`. Safe to
 * call from every request: uploads are diffed, and concurrent first requests
 * share one creation promise.
 */
export async function ensureWorkspace(
  sessionId: string,
  files: VfsFileInput[] = []
): Promise<WorkspaceState> {
  const incoming = normalizeFiles(files);
  evictStaleWorkspaces();

  const existing = workspaces.get(sessionId);
  if (existing) {
    if (incoming.length) await syncFiles(existing, incoming);
    existing.lastUsedAt = Date.now();
    return existing;
  }

  let creation = creations.get(sessionId);
  if (!creation) {
    creation = createWorkspace(sessionId, incoming);
    creations.set(sessionId, creation);
  }

  try {
    const state = await creation;
    if (incoming.length) await syncFiles(state, incoming);
    state.lastUsedAt = Date.now();
    workspaces.set(sessionId, state);
    evictOldestWorkspaces();
    return state;
  } finally {
    creations.delete(sessionId);
  }
}

/* -------------------------------------------------------------------------- */
/*  Public workspace API                                                      */
/* -------------------------------------------------------------------------- */

export async function writeWorkspaceFiles(
  sessionId: string,
  files: VfsFileInput[]
): Promise<VfsFileMeta[]> {
  const state = await ensureWorkspace(sessionId, files);
  return toMeta(state);
}

export async function listWorkspaceFiles(
  sessionId: string,
  files: VfsFileInput[] = []
): Promise<VfsFileMeta[]> {
  const state = await ensureWorkspace(sessionId, files);
  return toMeta(state);
}

/** Full snapshot, used to re-materialize the sandbox for the bash tools. */
export async function workspaceSnapshot(
  sessionId: string,
  files: VfsFileInput[] = []
): Promise<VfsFileInput[]> {
  const state = await ensureWorkspace(sessionId, files);
  return [...state.files.entries()].map(([path, file]) => ({
    path,
    content: file.content,
  }));
}

export function workspaceSummary(sessionId: string): VfsSummary | null {
  const state = workspaces.get(sessionId);
  if (!state) return null;

  const paths = [...state.files.keys()];
  const folders = new Set(
    paths.map((path) => path.split("/").slice(0, -1).join("/")).filter(Boolean)
  );

  return {
    sessionId: state.sessionId,
    fileCount: state.files.size,
    folderCount: folders.size,
    totalBytes: [...state.files.values()].reduce((sum, f) => sum + f.size, 0),
    fileNames: paths.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    createdAt: new Date(state.createdAt).toISOString(),
    lastUsedAt: new Date(state.lastUsedAt).toISOString(),
    commandCount: state.commandCount,
  };
}

/** Snapshot that is guaranteed to exist, for API responses. */
export async function ensureWorkspaceSummary(
  sessionId: string,
  files: VfsFileInput[] = []
): Promise<VfsSummary> {
  await ensureWorkspace(sessionId, files);
  const summary = workspaceSummary(sessionId);
  if (!summary) throw new Error("Workspace vanished while reading its summary.");
  return summary;
}

export async function readWorkspaceFile(
  sessionId: string,
  path: string
): Promise<string> {
  const normalized = normalizeWorkspacePath(path);
  if (!normalized) throw new Error(`Invalid workspace path: ${path}`);

  const state = await ensureWorkspace(sessionId);
  const cached = state.files.get(normalized);
  if (cached) return cached.content;

  // Files created inside the sandbox (by the agent) are not mirrored here, so
  // fall back to reading them straight out of the sandbox.
  return state.sandbox.readFile(`${WORKSPACE_ROOT}/${normalized}`);
}

/**
 * Runs a command against the workspace. This is the same path the bash tool
 * takes, which is what makes the workspace inspectable from the API as well.
 */
export async function runWorkspaceCommand(
  sessionId: string,
  command: string,
  files: VfsFileInput[] = []
): Promise<CommandOutput> {
  const trimmed = typeof command === "string" ? command.trim() : "";
  if (!trimmed) throw new Error("A non-empty command is required.");
  if (trimmed.length > MAX_COMMAND_LENGTH) {
    throw new Error(`Commands are limited to ${MAX_COMMAND_LENGTH} characters.`);
  }

  const state = await ensureWorkspace(sessionId, files);
  const result = await state.sandbox.executeCommand(trimmed);
  state.commandCount += 1;
  state.lastUsedAt = Date.now();

  return {
    command: trimmed,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

/** Drops a workspace so the next request rebuilds it from scratch. */
export function resetWorkspace(sessionId: string): boolean {
  const state = workspaces.get(sessionId);
  workspaces.delete(sessionId);
  return Boolean(state);
}

/** Exposes the sandbox for tool bindings without leaking the whole state. */
export async function workspaceSandbox(
  sessionId: string,
  files: VfsFileInput[] = []
): Promise<Sandbox> {
  const state = await ensureWorkspace(sessionId, files);
  state.lastUsedAt = Date.now();
  return state.sandbox;
}
