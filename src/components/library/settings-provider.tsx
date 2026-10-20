"use client";

import * as React from "react";

import {
  DEFAULT_MODEL,
  loadApiKey,
  loadModel,
  saveApiKey,
  saveModel,
} from "@/lib/groq/client";

/**
 * The user's own key and model choice.
 *
 * Both live in `localStorage` and are read on the client only, so the key is
 * never part of a server render and never leaves the browser except in the
 * request to Groq.
 *
 * The stored values are read through `useSyncExternalStore`, so the first
 * paint already has them and there is no "loading, then pop" flash.
 */

interface SettingsContextValue {
  apiKey: string;
  model: string;
  /** True once the settings have been read from storage. */
  ready: boolean;
  hasKey: boolean;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside the settings provider");
  }
  return context;
}

/** The empty snapshot, used before the browser has been read. */
const EMPTY_SNAPSHOT = { apiKey: "", model: DEFAULT_MODEL };

let listeners: (() => void)[] = [];
let snapshot: { apiKey: string; model: string } = EMPTY_SNAPSHOT;
let loaded = false;

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

function getSnapshot() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    snapshot = { apiKey: loadApiKey(), model: loadModel() };
  }
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const stored = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setApiKey = React.useCallback((key: string) => {
    const trimmed = key.trim();
    saveApiKey(trimmed);
    snapshot = { ...snapshot, apiKey: trimmed };
    for (const listener of listeners) listener();
  }, []);

  const setModel = React.useCallback((next: string) => {
    saveModel(next);
    snapshot = { ...snapshot, model: next };
    for (const listener of listeners) listener();
  }, []);

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      apiKey: stored.apiKey,
      model: stored.model,
      ready: typeof window !== "undefined",
      hasKey: stored.apiKey.length > 0,
      setApiKey,
      setModel,
    }),
    [stored.apiKey, stored.model, setApiKey, setModel]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}
