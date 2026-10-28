import "fake-indexeddb/auto";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { deleteDB, openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Conversation } from "../library/types";

let store: typeof import("./store");

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "chat-a",
    title: "A sourced answer",
    messages: [
      { id: "user", role: "user", content: "Explain this.", createdAt: 10 },
      {
        id: "assistant",
        role: "assistant",
        content: "An answer [1].",
        trace: [
          {
            id: "search",
            kind: "search",
            title: "Search passages",
            detail: "Found a passage",
            state: "done",
            chunkIds: ["chunk-1"],
            durationMs: 25,
          },
          {
            id: "command",
            kind: "command",
            title: "Read a file",
            state: "failed",
            exitCode: 1,
          },
          { id: "answer", kind: "answer", title: "Answer", state: "running" },
        ],
        citations: ["chunk-1"],
        createdAt: 20,
      },
    ],
    documentIds: ["document-1"],
    sources: [
      {
        chunk: {
          id: "chunk-1",
          documentId: "document-1",
          section: "Introduction",
          index: 1,
          startPage: 2,
          endPage: 3,
          text: "The original cited passage.",
        },
        name: "Research.pdf",
      },
    ],
    isStreaming: false,
    createdAt: 10,
    updatedAt: 30,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  store = await import("./store");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("chat history persistence", () => {
  it("loads empty storage without touching an open library database", async () => {
    const library = await openDB("quarry-library", 1, {
      upgrade(db) {
        db.createObjectStore("existing");
      },
    });
    try {
      await library.put("existing", "untouched", "record");
      const open = vi.spyOn(indexedDB, "open");
      expect(await store.loadChatHistory()).toEqual({ conversations: [], activeId: null });
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith("quarry-chats", 1);
      expect(await library.get("existing", "record")).toBe("untouched");
      expect(library.version).toBe(1);
    } finally {
      library.close();
    }
  });

  it("roundtrips full messages, traces, cited snapshots, and selection after reopening", async () => {
    const original = conversation({ isStreaming: true });
    await store.writeChatHistory({ conversations: [original], deletedIds: [], activeId: original.id });
    vi.resetModules();
    store = await import("./store");
    expect(await store.loadChatHistory()).toEqual({ conversations: [original], activeId: original.id });

    const db = await openDB("quarry-chats", 1);
    try {
      expect([...db.objectStoreNames]).toEqual(["conversations", "state"]);
      expect(db.transaction("conversations").store.keyPath).toBe("id");
      expect(db.transaction("state").store.keyPath).toBeNull();
      expect(await db.get("state", "active")).toBe(original.id);
    } finally {
      db.close();
    }
  });

  it("sorts by latest update and reorders changed records without clobbering others", async () => {
    const older = conversation();
    const newer = conversation({ id: "chat-b", updatedAt: 50 });
    await store.writeChatHistory({ conversations: [older, newer], deletedIds: [], activeId: newer.id });
    expect((await store.loadChatHistory()).conversations).toEqual([newer, older]);

    const updated = { ...older, title: "Renamed", updatedAt: 60 };
    await store.writeChatHistory({ conversations: [updated], deletedIds: [], activeId: older.id });
    expect(await store.loadChatHistory()).toEqual({ conversations: [updated, newer], activeId: older.id });
  });

  it("preserves all records when only the selection changes", async () => {
    const first = conversation();
    const second = conversation({ id: "chat-b", updatedAt: 40 });
    await store.writeChatHistory({ conversations: [first, second], deletedIds: [], activeId: first.id });
    await store.writeChatHistory({ conversations: [], deletedIds: [], activeId: second.id });
    expect(await store.loadChatHistory()).toEqual({ conversations: [second, first], activeId: second.id });
  });

  it("deletes specified records and persists an explicit null selection", async () => {
    const first = conversation();
    const second = conversation({ id: "chat-b" });
    await store.writeChatHistory({ conversations: [first, second], deletedIds: [], activeId: first.id });
    await store.writeChatHistory({ conversations: [], deletedIds: [first.id, "missing"], activeId: null });
    expect(await store.loadChatHistory()).toEqual({ conversations: [second], activeId: null });
    const db = await openDB("quarry-chats", 1);
    try {
      expect(await db.get("state", "active")).toBeNull();
    } finally {
      db.close();
    }
  });

  it("returns null for a selection that no longer matches a conversation", async () => {
    const original = conversation();
    await store.writeChatHistory({ conversations: [original], deletedIds: [], activeId: original.id });
    await store.writeChatHistory({ conversations: [], deletedIds: [original.id], activeId: original.id });
    expect(await store.loadChatHistory()).toEqual({ conversations: [], activeId: null });
  });

  it("retries a failed open and caches the successful connection", async () => {
    const incompatible = await openDB("quarry-chats", 2);
    incompatible.close();
    const open = vi.spyOn(indexedDB, "open");
    await expect(store.loadChatHistory()).rejects.toMatchObject({ name: "VersionError" });
    await deleteDB("quarry-chats");
    expect(await Promise.all([store.loadChatHistory(), store.loadChatHistory()])).toEqual([
      { conversations: [], activeId: null },
      { conversations: [], activeId: null },
    ]);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("propagates transaction failure even after requests succeed and rolls back the whole write", async () => {
    const original = conversation();
    await store.writeChatHistory({ conversations: [original], deletedIds: [], activeId: original.id });
    const nativePut = IDBObjectStore.prototype.put;
    const succeeded = vi.fn();
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof nativePut>
    ) {
      const request = nativePut.apply(this, args);
      request.addEventListener("success", () => {
        succeeded(this.name);
        if (this.name === "state") queueMicrotask(() => this.transaction.abort());
      });
      return request;
    });

    const replacement = conversation({ id: "chat-b" });
    await expect(store.writeChatHistory({
      conversations: [replacement],
      deletedIds: [original.id],
      activeId: replacement.id,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(succeeded.mock.calls).toEqual([["conversations"], ["state"]]);
    expect(await store.loadChatHistory()).toEqual({ conversations: [original], activeId: original.id });
  });

  it("propagates synchronous write errors without committing earlier requests", async () => {
    const original = conversation();
    await store.writeChatHistory({ conversations: [original], deletedIds: [], activeId: original.id });
    const invalid = conversation({ id: "invalid" });
    Object.assign(invalid, { uncloneable: () => undefined });
    await expect(store.writeChatHistory({
      conversations: [{ ...original, title: "Must not persist" }, invalid],
      deletedIds: [],
      activeId: null,
    })).rejects.toMatchObject({ name: "DataCloneError" });
    expect(await store.loadChatHistory()).toEqual({ conversations: [original], activeId: original.id });
  });
});

describe("conversation recovery", () => {
  it.each(["Partial answer [1].", ""])("recovers a streaming reply containing %j immutably", (content) => {
    const original = conversation({ isStreaming: true });
    const reply = original.messages[1];
    reply.content = content;
    const previous = { ...reply, id: "previous", content: "Earlier answer." };
    const trailing = { ...original.messages[0], id: "trailing" };
    original.messages = [previous, original.messages[0], reply, trailing];
    const snapshot = structuredClone(original);
    const recovered = store.recoverConversation(original);
    const notice = "Response interrupted. Please ask again to continue.";

    expect(original).toEqual(snapshot);
    expect(recovered).not.toBe(original);
    expect(recovered).toEqual({
      ...original,
      isStreaming: false,
      messages: [previous, original.messages[1], {
        ...reply,
        content: content ? `${content}\n\n${notice}` : notice,
        trace: reply.trace!.map((step) => step.state === "running" ? { ...step, state: "failed" } : step),
      }, trailing],
    });
    expect(recovered.messages[0]).toBe(previous);
    expect(recovered.messages[1]).toBe(original.messages[1]);
    expect(recovered.messages[3]).toBe(trailing);
    expect(recovered.messages[2].trace![0]).toBe(reply.trace![0]);
    expect(recovered.messages[2].trace![1]).toBe(reply.trace![1]);
    expect(recovered.messages[2].trace![2]).not.toBe(reply.trace![2]);
    expect(recovered.messages[2].citations).toBe(reply.citations);
    expect(recovered.sources).toBe(original.sources);
    expect(recovered.documentIds).toBe(original.documentIds);
    expect(store.recoverConversation(recovered)).toBe(recovered);
  });

  it("leaves finished records identical even when their traces contain running steps", () => {
    const original = conversation();
    const snapshot = structuredClone(original);
    expect(store.recoverConversation(original)).toBe(original);
    expect(original).toEqual(snapshot);
  });

  it("does not add an absent trace or citations", () => {
    const original = conversation({
      isStreaming: true,
      messages: [{ id: "assistant", role: "assistant", content: "", createdAt: 20 }],
    });
    expect(store.recoverConversation(original).messages[0]).toEqual({
      ...original.messages[0],
      content: "Response interrupted. Please ask again to continue.",
    });
  });

  it.each([{ messages: [] }, { messages: [conversation().messages[0]] }])(
    "does not create a reply when no assistant exists: $messages",
    ({ messages }) => {
      const original = conversation({ isStreaming: true, messages });
      const recovered = store.recoverConversation(original);
      expect(recovered).toEqual({ ...original, isStreaming: false });
      expect(recovered.messages).toBe(original.messages);
      expect(original.isStreaming).toBe(true);
    }
  );
});
