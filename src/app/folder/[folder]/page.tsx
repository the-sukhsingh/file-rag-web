"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  ContextPanel,
  type ContextSelection,
} from "@/components/chat/context-panel";
import { MessageList } from "@/components/chat/message-list";
import { PromptBox } from "@/components/chat/prompt-box";
import { SettingsDialog } from "@/components/layout/settings-dialog";
import { TopNav } from "@/components/layout/top-nav";
import { useLibrary } from "@/components/library/library-provider";
import { useSettings } from "@/components/library/settings-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createMessageId, now } from "@/lib/chat/ids";
import { runAgent } from "@/lib/groq/agent";
import type { ChatMessage, TraceStep } from "@/lib/library/types";
import { onEmbeddingStatus } from "@/lib/retrieval/embeddings";
import { pluralize } from "@/lib/utils";

/**
 * The folder workspace.
 *
 * The left is the conversation, the right is the context. The conversation is
 * scoped to one folder: the retriever only ever sees the chunks of that
 * folder and its sub-folders, and the user can pin or exclude passages to
 * steer the answer.
 */
export default function FolderPage() {
  const params = useParams<{ folder: string }>();
  const library = useLibrary();
  const settings = useSettings();

  const folderId = params?.folder ?? "";
  const folder = library.getFolder(folderId);

  const [chunks, setChunks] = React.useState<
    Awaited<ReturnType<typeof library.loadChunks>>
  >([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [selection, setSelection] = React.useState<ContextSelection>({
    pinned: new Set(),
    excluded: new Set(),
  });
  const [isBusy, setIsBusy] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [lastRetrieved, setLastRetrieved] = React.useState<string[]>([]);
  const [embedding, setEmbedding] = React.useState<{ state: string; message?: string }>({
    state: "idle",
  });
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(
    () =>
      onEmbeddingStatus((next) =>
        setEmbedding({
          state: next.state,
          message: next.state === "loading" ? next.message : undefined,
        })
      ),
    []
  );

  // Load the passages of this folder and of every folder beneath it.
  const folders = library.folders;
  const loadChunks = library.loadChunks;

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const ids = collectFolderIds(folderId, folders);
      const groups = await Promise.all(ids.map((id) => loadChunks(id)));
      if (cancelled) return;
      setChunks(groups.flat());
    })();

    return () => {
      cancelled = true;
    };
  }, [folderId, folders, loadChunks]);

  const handleAsk = async (question: string) => {
    if (!settings.hasKey) {
      setIsSettingsOpen(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: question,
      createdAt: now(),
    };
    const assistantId = createMessageId();

    setMessages((previous) => [
      ...previous,
      userMessage,
      { id: assistantId, role: "assistant", content: "", trace: [], createdAt: now() },
    ]);
    setIsBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const patch = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId ? update(message) : message
        )
      );

    try {
      await runAgent(
        {
          question,
          folderName: folder?.name ?? "this folder",
          chunks,
          pinnedChunkIds: [...selection.pinned],
          excludedChunkIds: [...selection.excluded],
          history: messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          apiKey: settings.apiKey,
          model: settings.model,
          signal: controller.signal,
        },
        {
          onTrace: (step: TraceStep) => {
            patch((message) => {
              const trace = message.trace ?? [];
              const index = trace.findIndex((entry) => entry.id === step.id);
              if (index === -1) return { ...message, trace: [...trace, step] };
              const next = [...trace];
              next[index] = step;
              return { ...message, trace: next };
            });
          },
          onText: (delta: string) => {
            patch((message) => ({
              ...message,
              content: message.content + delta,
            }));
          },
          onCitations: (chunkIds: string[]) => {
            setLastRetrieved(chunkIds);
            patch((message) => ({ ...message, citations: chunkIds }));
          },
        }
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error
            ? error.message
            : "The question could not be answered.";
        patch((current) => ({
          ...current,
          content: current.content
            ? `${current.content}\n\n_The request failed: ${message}_`
            : `_The request failed: ${message}_`,
        }));
      }
    } finally {
      abortRef.current = null;
      setIsBusy(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsBusy(false);
  };

  if (!library.ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner className="size-5 text-electric-indigo" />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-[16px] bg-warm-bone text-bark-grey">
          <TriangleAlertIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[20px] font-semibold text-charcoal">
            That folder is gone
          </h1>
          <p className="max-w-[40ch] text-[14px] text-bark-grey">
            It may have been deleted. Head back to the library to pick another
            one.
          </p>
        </div>
        <Link href="/">
          <Button className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet">
            Back to the library
          </Button>
        </Link>
      </div>
    );
  }

  const hasContent = chunks.length > 0;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <TopNav
        active="folder"
        hasKey={settings.hasKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* The folder header */}
      <div className="border-b border-stone-mist bg-paper-white">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[12px] text-bark-grey">
              <Link
                href="/"
                className="flex items-center gap-1 transition-colors hover:text-charcoal"
              >
                <ArrowLeftIcon className="size-3" />
                Library
              </Link>
              {folder.path
                .split("/")
                .slice(0, -1)
                .map((part, index) => (
                  <React.Fragment key={`${part}-${index}`}>
                    <ChevronRightIcon className="size-3 text-pebble" />
                    <span>{part}</span>
                  </React.Fragment>
                ))}
            </div>
            <h1 className="flex items-center gap-2 text-[20px] font-semibold leading-[1.38] text-charcoal">
              <FolderIcon className="size-4.5 text-electric-indigo" />
              {folder.name}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-bark-grey">
              {pluralize(chunks.length, "passage")} ·{" "}
              {pluralize(messages.length, "message")}
            </span>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMessages([])}
                className="h-7 px-2 text-[11px] uppercase text-bark-grey hover:text-charcoal"
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* The workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_360px]">
        <section className="flex min-h-0 flex-col">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-[16px] bg-electric-indigo/10 text-electric-indigo">
                <SparklesIcon className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="display-face text-[32px] text-charcoal">
                  Ask this folder
                </h2>
                <p className="max-w-[44ch] text-[14px] leading-[1.43] text-bark-grey">
                  {hasContent
                    ? `I have ${pluralize(chunks.length, "passage")} from this folder. Ask anything and I will find the parts that answer it.`
                    : "This folder is empty. Import a PDF into it from the library and I will have something to read."}
                </p>
              </div>

              {hasContent && (
                <div className="flex max-w-[520px] flex-col gap-2">
                  {[
                    "Summarise the main points of this folder",
                    "What are the key terms and definitions here?",
                    "Where does this document argue against the consensus?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void handleAsk(suggestion)}
                      className="rounded-[8px] border border-stone-mist bg-paper-white px-4 py-2.5 text-left text-[13px] text-charcoal transition-colors hover:border-electric-indigo/40 hover:bg-warm-bone"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <MessageList messages={messages} />
          )}

          <PromptBox
            onSubmit={(text) => void handleAsk(text)}
            onStop={handleStop}
            isBusy={isBusy}
            disabled={!hasContent || !settings.hasKey}
            placeholder={
              !settings.hasKey
                ? "Add your Groq API key to start asking questions"
                : hasContent
                  ? `Ask about ${folder.name}...`
                  : "This folder has no passages yet"
            }
          >
            {!settings.hasKey && (
              <div className="mx-3 mt-3 flex items-center gap-2 rounded-[8px] border border-terracotta/40 bg-terracotta/5 px-3 py-2 text-[12px] text-bark-grey">
                <TriangleAlertIcon className="size-3.5 shrink-0 text-terracotta" />
                Add your Groq API key to chat with this folder.
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="ml-auto font-mono text-[11px] uppercase text-electric-indigo"
                >
                  Add key
                </button>
              </div>
            )}
          </PromptBox>
        </section>

        <div className="hidden min-h-0 lg:block">
          <ContextPanel
            chunks={chunks}
            selection={selection}
            onChange={setSelection}
            lastRetrieved={lastRetrieved}
          />
        </div>
      </div>

      {embedding.state === "loading" && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-xs items-center gap-2 rounded-[12px] border border-stone-mist bg-paper-white px-4 py-2.5 text-[12px] text-bark-grey shadow-xl">
          <Spinner className="size-3.5 text-electric-indigo" />
          {embedding.message ?? "Preparing the embedding model"}
        </div>
      )}

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}

/**
 * The folder itself and every folder beneath it.
 */
function collectFolderIds(
  folderId: string,
  folders: { id: string; parentId: string | null }[]
): string[] {
  const ids = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }
  return [...ids];
}
