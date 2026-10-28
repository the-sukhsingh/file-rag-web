"use client";

import * as React from "react";

import { loadChatHistory, recoverConversation, writeChatHistory, type ChatHistory } from "@/lib/chat/store";
import type { Conversation } from "@/lib/library/types";

export function useChatHistory() {
  const [history, setHistory] = React.useState<ChatHistory>({ conversations: [], activeId: null });
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadVersion, setLoadVersion] = React.useState(0);
  const saved = React.useRef(new Map<string, Conversation>());
  const savedActiveId = React.useRef<string | null>(null);
  const latest = React.useRef(history);
  const queue = React.useRef(Promise.resolve());
  const mounted = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void loadChatHistory().then((stored) => {
      if (cancelled) return;
      saved.current = new Map(stored.conversations.map((conversation) => [conversation.id, conversation]));
      savedActiveId.current = stored.activeId;
      setHistory({ ...stored, conversations: stored.conversations.map(recoverConversation) });
      setError(null);
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError("Saved chats couldn’t be loaded. Retry before starting a conversation.");
    });
    return () => { cancelled = true; };
  }, [loadVersion]);

  const persist = React.useCallback((snapshot: ChatHistory) => {
    queue.current = queue.current.then(async () => {
      const conversations = snapshot.conversations.filter((conversation) => saved.current.get(conversation.id) !== conversation);
      const ids = new Set(snapshot.conversations.map((conversation) => conversation.id));
      const deletedIds = [...saved.current.keys()].filter((id) => !ids.has(id));
      if (!conversations.length && !deletedIds.length && savedActiveId.current === snapshot.activeId) {
        if (mounted.current) setError(null);
        return;
      }
      await writeChatHistory({ conversations, deletedIds, activeId: snapshot.activeId });
      saved.current = new Map(snapshot.conversations.map((conversation) => [conversation.id, conversation]));
      savedActiveId.current = snapshot.activeId;
      if (mounted.current) setError(null);
    }).catch(() => {
      if (mounted.current) setError("Changes couldn’t be saved. They’re still in this tab. Retry before closing it.");
    });
    return queue.current;
  }, []);

  React.useEffect(() => {
    latest.current = history;
    if (!ready) return;
    const active = history.conversations.find((conversation) => conversation.id === history.activeId);
    const previous = active && saved.current.get(active.id);
    const isStreamingUpdate = active?.isStreaming && previous?.isStreaming && active.messages.length === previous.messages.length;
    if (saveTimer.current !== null) {
      if (isStreamingUpdate) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!isStreamingUpdate) {
      void persist(history);
      return;
    }
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(latest.current);
    }, 300);
  }, [history, ready, persist]);

  React.useEffect(() => {
    if (!ready) return;
    const flush = () => { void persist(latest.current); };
    const onVisibilityChange = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ready, persist]);

  const createConversation = React.useCallback((conversation: Conversation) => {
    setHistory((previous) => ({ conversations: [conversation, ...previous.conversations], activeId: conversation.id }));
  }, []);

  const updateConversation = React.useCallback((id: string, update: (conversation: Conversation) => Conversation) => {
    setHistory((previous) => ({
      ...previous,
      conversations: previous.conversations.map((conversation) => conversation.id === id ? { ...update(conversation), updatedAt: Date.now() } : conversation).toSorted((a, b) => b.updatedAt - a.updatedAt),
    }));
  }, []);

  const selectConversation = React.useCallback((id: string | null) => {
    setHistory((previous) => ({ ...previous, activeId: id }));
  }, []);

  const deleteConversation = React.useCallback((id: string) => {
    setHistory((previous) => ({ conversations: previous.conversations.filter((conversation) => conversation.id !== id), activeId: previous.activeId === id ? null : previous.activeId }));
  }, []);

  const retry = () => {
    if (ready) void persist(latest.current);
    else setLoadVersion((value) => value + 1);
  };

  return { ...history, activeConversation: history.conversations.find((conversation) => conversation.id === history.activeId), ready, error, retry, createConversation, updateConversation, selectConversation, deleteConversation };
}
