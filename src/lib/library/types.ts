/**
 * The shape of the library.
 *
 * A library is a tree of folders. A folder holds documents; a document holds
 * chunks. Chunks are the unit of retrieval - they carry the text, the vector
 * and the position of the passage they came from.
 */

/** A folder in the library tree. Folders nest; they never hold text. */
export interface Folder {
  id: string;
  name: string;
  /** Path from the library root, e.g. `Research/Deep learning`. */
  path: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  /** Free-form colour hint used for the folder's icon stroke. */
  accent?: FolderAccent;
}

export type FolderAccent = "indigo" | "terracotta" | "teal" | "green";

/** A document that was imported into a folder. */
export interface DocumentRecord {
  id: string;
  folderId: string;
  name: string;
  /** Original file name, kept for the download/open action. */
  fileName: string;
  pageCount: number;
  /** How many chunks the document was split into. */
  chunkCount: number;
  /** True when the PDF had a usable outline and therefore real chapters. */
  usedOutline: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * A passage of text. The vector is stored as a plain number array so it can be
 * persisted to IndexedDB without any typed-array marshalling.
 */
export interface Chunk {
  id: string;
  documentId: string;
  folderId: string;
  /** Chapter or section the chunk came from. */
  section: string;
  /** 1-based index of the chunk inside its document. */
  index: number;
  /** Page range the chunk was extracted from, when known. */
  startPage?: number;
  endPage?: number;
  text: string;
  /** Normalized embedding, or null while the document is still indexing. */
  embedding: number[] | null;
  /** Tokens of the chunk, lowercased. Kept so BM25 needs no re-tokenising. */
  tokens: string[];
  /** The name the passage has as a file, e.g. `003.md`. */
  fileName?: string;
  createdAt: number;
  updatedAt?: number;
}

/** The whole library, as stored in IndexedDB. */
export interface Library {
  folders: Folder[];
  documents: DocumentRecord[];
  chunks: Chunk[];
}

/** A retrieved passage, with the scores that got it there. */
export interface RetrievedChunk {
  chunk: Chunk;
  score: number;
  /** Cosine similarity, when the chunk has a vector. */
  semantic?: number;
  /** BM25 score, when the query had lexical matches. */
  lexical?: number;
  /** Why the chunk was pulled in, shown to the user in the trace. */
  reason: "semantic" | "lexical" | "pinned" | "hybrid";
}

/** One step of the agent's work, shown as a trace in the chat. */
export interface TraceStep {
  id: string;
  kind: "plan" | "search" | "read" | "command" | "answer";
  title: string;
  detail?: string;
  state: "running" | "done" | "failed";
  exitCode?: number;
  /** Chunk ids that were consulted in this step. */
  chunkIds?: string[];
  /** How long the step took, in milliseconds. */
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Trace of the agent's work, attached to assistant messages. */
  trace?: TraceStep[];
  /** Chunk ids the answer was grounded in. */
  citations?: string[];
  createdAt: number;
}

export type SourceChunk = Pick<Chunk, "id" | "documentId" | "section" | "index" | "startPage" | "endPage" | "text">;

export interface ChatSource {
  chunk: SourceChunk;
  name: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  documentIds: string[];
  sources: ChatSource[];
  isStreaming: boolean;
  createdAt: number;
  updatedAt: number;
}

/** The result of one agent turn, streamed to the UI. */
export type AgentEvent =
  | { type: "trace"; step: TraceStep }
  | { type: "text"; delta: string }
  | { type: "citations"; chunkIds: string[] }
  | { type: "done" }
  | { type: "error"; message: string };
