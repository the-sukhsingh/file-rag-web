/**
 * Shared chat contracts between the client and `/api/ask`.
 *
 * The server answers with prose plus a report of every bash command it ran
 * against the workspace, which the chat renders under the reply.
 */

/** One tool invocation the agent made while answering. */
export interface CommandReport {
  /** Tool that ran: `bash`, `readFile` or `writeFile`. */
  tool: string;
  /** The command line, or the equivalent for the file tools. */
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True when the server clipped the output before sending it. */
  truncated?: boolean;
}

/** Server-side workspace stats attached to a reply. */
export interface WorkspaceStats {
  workingDirectory: string;
  fileCount: number;
  folderCount: number;
  filePaths: string[];
  stepCount: number;
}

export interface AskResponse {
  message: string;
  commands?: CommandReport[];
  sessionId?: string;
  workspace?: WorkspaceStats;
  error?: string;
}

const SESSION_STORAGE_KEY = "file-rag-workspace-session";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ses-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  }
  return `ses-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

/**
 * Stable workspace id for this browser, so the server can keep the uploaded
 * chunks between requests instead of rebuilding the sandbox every time.
 */
export function loadOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return stored;

    const created = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    // Private mode or blocked storage: fall back to a per-request id.
    return createSessionId();
  }
}
