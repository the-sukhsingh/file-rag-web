/**
 * Shared chat contracts between the client and `/api/ask`.
 *
 * The server answers with prose plus a report of every bash command it ran
 * against the workspace, streamed as newline-delimited JSON events so the reply
 * and its reasoning trail appear while the agent is still working.
 */

/** One tool invocation the agent made while answering. */
export interface CommandReport {
  /** Matches the `command` event with the `result` that completes it. */
  id?: string;
  /** Tool that ran. The agent has a single `bash` tool today. */
  tool: string;
  /** The complete command line the agent sent. */
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True when the server clipped the output before sending it. */
  truncated?: boolean;
  /** `running` from the moment the call streams in until its output lands. */
  state?: "running" | "done";
}

/** Newline-delimited JSON frames of a `/api/ask` response. */
export type AskStreamEvent =
  | { type: "start"; sessionId: string }
  | { type: "text"; delta: string }
  | { type: "command"; id: string; tool: string; command: string }
  | {
      type: "result";
      id: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      truncated?: boolean;
    }
  | { type: "done" }
  | { type: "error"; message: string };

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
