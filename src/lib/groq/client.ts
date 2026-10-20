/**
 * The BYOK model client.
 *
 * The user supplies their own Groq key, and every request goes from the
 * browser straight to Groq. There is no server in the middle and no key on
 * our side. The key is kept in `localStorage` so it survives a reload, and it
 * is never sent anywhere except to `api.groq.com`.
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const API_KEY_STORAGE_KEY = "quarry-groq-api-key";
const MODEL_STORAGE_KEY = "quarry-groq-model";

/** The model used when the user has not chosen one. */
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * The models offered in the picker.
 *
 * Groq's catalogue depends on the key's tier, so this list is only the
 * fallback. The real list is fetched from the models endpoint and shows
 * exactly what the key can reach.
 */
export const MODELS = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", note: "Reasoning" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", note: "Fast" },
  { id: "moonshotai/kimi-k2-instruct", name: "Kimi K2", note: "Long context" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", note: "Light" },
] as const;

/**
 * The models that cannot answer a chat message: audio transcription and the
 * safety classifiers.
 */
const NOT_CHAT_MODELS = [
  "whisper",
  "prompt-guard",
  "safeguard",
  "guard",
];

export interface GroqModel {
  id: string;
  name: string;
  note: string;
}

/**
 * Turns a model id into something readable: `moonshotai/kimi-k2-instruct`
 * becomes `Kimi K2 Instruct`.
 */
export function describeModel(id: string): { name: string; note: string } {
  const bare = id.split("/").pop() ?? id;

  const name = bare
    .replace(/-instruct$/i, "")
    .replace(/-versatile$/i, "")
    .replace(/-v\d+-\d+-preview$/i, "")
    .split("-")
    .filter(Boolean)
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");

  const note =
    /gpt-oss-120b/i.test(id)
      ? "Reasoning"
      : /gpt-oss-20b/i.test(id)
        ? "Light"
        : /versatile/i.test(id)
          ? "Fast"
          : /kimi/i.test(id)
            ? "Long context"
            : "Chat";

  return { name: name || bare, note };
}

/**
 * Lists the models the key can reach.
 *
 * A key's tier decides which models it may use, so the list is fetched rather
 * than assumed. Returns an empty list when the key cannot read it.
 */
export async function listModels(apiKey: string): Promise<GroqModel[]> {
  if (!apiKey.trim()) return [];

  try {
    const response = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
    if (!response.ok) return [];

    const payload = (await response.json()) as { data?: { id?: string }[] };
    const ids = (payload.data ?? [])
      .map((entry) => entry.id)
      .filter((id): id is string => Boolean(id))
      .filter(
        (id) =>
          !NOT_CHAT_MODELS.some((skip) => id.toLowerCase().includes(skip))
      );

    return ids.map((id) => ({ id, ...describeModel(id) }));
  } catch {
    return [];
  }
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqOptions {
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/* -------------------------------------------------------------------------- */
/*  Key and model storage                                                     */
/* -------------------------------------------------------------------------- */

export function loadApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    if (key) window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
    else window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the key still works for this session.
  }
}

export function loadModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function saveModel(model: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  } catch {
    // Non-fatal.
  }
}

/* -------------------------------------------------------------------------- */
/*  Requests                                                                  */
/* -------------------------------------------------------------------------- */

export class GroqError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "GroqError";
  }
}

/**
 * One non-streaming completion.
 */
export async function complete(
  messages: GroqMessage[],
  options: GroqOptions
): Promise<string> {
  const response = await request(messages, options, false);
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (payload.error?.message) {
    throw new GroqError(payload.error.message, response.status);
  }

  return payload.choices?.[0]?.message?.content ?? "";
}

/**
 * A streaming completion. `onDelta` is called with each piece of text as it
 * arrives, so the answer can be shown while it is being written.
 */
export async function stream(
  messages: GroqMessage[],
  options: GroqOptions,
  onDelta: (delta: string) => void
): Promise<string> {
  const response = await request(messages, options, true);
  const body = response.body;
  if (!body) throw new GroqError("The response had no body", response.status);

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // The stream is a sequence of `data: {...}` lines, ended by `data: [DONE]`.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      try {
        const frame = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = frame.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // A frame that cannot be parsed is skipped, not fatal.
      }
    }
  }

  return full;
}

async function request(
  messages: GroqMessage[],
  options: GroqOptions,
  streaming: boolean
): Promise<Response> {
  if (!options.apiKey) {
    throw new GroqError("Add your Groq API key to start asking questions.");
  }

  let response: Response;
  try {
    response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_MODEL,
        messages,
        stream: streaming,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GroqError(
      "Could not reach Groq. Check your connection and try again."
    );
  }

  if (!response.ok) {
    throw new GroqError(await readError(response), response.status);
  }

  return response;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string } | string;
    };
    const raw = payload.error;
    const message = typeof raw === "string" ? raw : raw?.message;
    if (message) {
      if (/model/i.test(message) && /not found|deprecat|not available/i.test(message)) {
        return "That model is not available to your key. Pick another one in the settings.";
      }
      return message;
    }
  } catch {
    // Fall through to the status-based message.
  }

  if (response.status === 401) {
    return "That API key was rejected. Check that it is correct and still active.";
  }
  if (response.status === 429) {
    return "Groq is rate limiting this key. Wait a moment and try again.";
  }
  return `Groq returned ${response.status}.`;
}

/**
 * Checks a key against the models endpoint. Used by the settings panel to
 * confirm the key works before it is saved.
 */
export async function verifyApiKey(apiKey: string): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!apiKey.trim()) {
    return { ok: false, message: "The key is empty." };
  }

  try {
    const response = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });

    if (!response.ok) {
      return {
        ok: false,
        message:
          response.status === 401
            ? "Groq rejected that key."
            : `Groq returned ${response.status}.`,
      };
    }

    return { ok: true, message: "The key works." };
  } catch {
    return { ok: false, message: "Could not reach Groq." };
  }
}
