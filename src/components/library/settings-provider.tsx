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

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = React.useState("");
  const [model, setModelState] = React.useState(DEFAULT_MODEL);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setApiKeyState(loadApiKey());
    setModelState(loadModel());
    setReady(true);
  }, []);

  const setApiKey = React.useCallback((key: string) => {
    const trimmed = key.trim();
    setApiKeyState(trimmed);
    saveApiKey(trimmed);
  }, []);

  const setModel = React.useCallback((next: string) => {
    setModelState(next);
    saveModel(next);
  }, []);

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      apiKey,
      model,
      ready,
      hasKey: apiKey.length > 0,
      setApiKey,
      setModel,
    }),
    [apiKey, model, ready, setApiKey, setModel]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}
