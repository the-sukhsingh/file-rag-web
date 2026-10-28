import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Conversation } from "../library/types";

interface ChatSchema extends DBSchema {
  conversations: { key: string; value: Conversation };
  state: { key: string; value: string | null };
}

export interface ChatHistory {
  conversations: Conversation[];
  activeId: string | null;
}

let dbPromise: Promise<IDBPDatabase<ChatSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<ChatSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<ChatSchema>("quarry-chats", 1, {
      upgrade(db) {
        db.createObjectStore("conversations", { keyPath: "id" });
        db.createObjectStore("state");
      },
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function loadChatHistory(): Promise<ChatHistory> {
  const db = await getDb();
  const tx = db.transaction(["conversations", "state"], "readonly");
  const [conversations, activeId] = await Promise.all([
    tx.objectStore("conversations").getAll(),
    tx.objectStore("state").get("active"),
    tx.done,
  ]);

  return {
    conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt),
    activeId: conversations.some((conversation) => conversation.id === activeId)
      ? activeId ?? null
      : null,
  };
}

export async function writeChatHistory(input: {
  conversations: Conversation[];
  deletedIds: string[];
  activeId: string | null;
}): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["conversations", "state"], "readwrite");
  const pending: Promise<unknown>[] = [tx.done];

  try {
    const store = tx.objectStore("conversations");
    for (const conversation of input.conversations) {
      pending.push(store.put(conversation));
    }
    for (const id of input.deletedIds) {
      pending.push(store.delete(id));
    }
    pending.push(tx.objectStore("state").put(input.activeId, "active"));
    await Promise.all(pending);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // A transaction that already aborted cannot be aborted again.
    }
    await Promise.allSettled(pending);
    throw error;
  }
}

export function recoverConversation(conversation: Conversation): Conversation {
  if (!conversation.isStreaming) return conversation;

  const notice = "Response interrupted. Please ask again to continue.";
  for (let index = conversation.messages.length - 1; index >= 0; index--) {
    const message = conversation.messages[index];
    if (message.role !== "assistant") continue;

    const messages = [...conversation.messages];
    messages[index] = {
      ...message,
      content: message.content ? `${message.content}\n\n${notice}` : notice,
      ...(message.trace && {
        trace: message.trace.map((step) =>
          step.state === "running" ? { ...step, state: "failed" as const } : step
        ),
      }),
    };
    return { ...conversation, messages, isStreaming: false };
  }

  return { ...conversation, isStreaming: false };
}
