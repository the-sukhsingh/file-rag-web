"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRightIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import {
  ContextPanel,
  type ContextSelection,
} from "@/components/chat/context-panel";
import { FolderEmpty } from "@/components/chat/folder-bar";
import { MessageList } from "@/components/chat/message-list";
import { PromptBox } from "@/components/chat/prompt-box";
import { SettingsDialog } from "@/components/layout/settings-dialog";
import { ProgressPopup } from "@/components/layout/progress-popup";
import { TopNav } from "@/components/layout/top-nav";
import { useLibrary } from "@/components/library/library-provider";
import { useSettings } from "@/components/library/settings-provider";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { createMessageId, now } from "@/lib/chat/ids";
import { runAgent } from "@/lib/groq/agent";
import type { ChatMessage, Folder, TraceStep } from "@/lib/library/types";
import { onEmbeddingStatus } from "@/lib/retrieval/embeddings";
import { pluralize } from "@/lib/utils";

/**
 * The folder chat.
 *
 * The conversation is scoped to one folder: the retriever only ever sees the
 * chunks of that folder and its sub-folders, and the user can pin or exclude
 * passages to steer the answer.
 *
 * The page is one column. The context panel is a second column on a wide
 * screen and a drawer on a narrow one, so the conversation always has the
 * room it needs.
 */
export default function FolderChatPage() {
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
  const [isContextOpen, setIsContextOpen] = React.useState(false);
  const [lastRetrieved, setLastRetrieved] = React.useState<string[]>([]);
  const [embedding, setEmbedding] = React.useState<{
    state: string;
    message?: string;
    percent?: number;
  }>({ state: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(
    () =>
      onEmbeddingStatus((next) =>
        setEmbedding({
          state: next.state,
          message: next.state === "loading" ? next.message : undefined,
          percent: next.state === "loading" ? next.progress : undefined,
        })
      ),
    []
  );

  // Load the passages of this folder and of every folder beneath it.
  const folders = library.folders;
  const loadChunks = library.loadChunks;
  const revision = library.revision;

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
  }, [folderId, folders, loadChunks, revision]);

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
      {
        id: assistantId,
        role: "assistant",
        content: "",
        trace: [],
        createdAt: now(),
      },
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
          <FolderIcon className="size-6" />
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
  const ancestors = collectAncestors(folder, folders);

  const contextPanel = (
    <ContextPanel
      chunks={chunks}
      selection={selection}
      onChange={setSelection}
      lastRetrieved={lastRetrieved}
    />
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopNav
        active="folder"
        hasKey={settings.hasKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        middle={
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
              <Link
                href="/"
                className="shrink-0 text-bark-grey transition-colors hover:text-charcoal"
              >
                Library
              </Link>
              {ancestors.map((ancestor) => (
                <React.Fragment key={ancestor.id}>
                  <ChevronRightIcon className="size-3 shrink-0 text-pebble" />
                  <span className="truncate text-bark-grey">{ancestor.name}</span>
                </React.Fragment>
              ))}
              <ChevronRightIcon className="size-3 shrink-0 text-pebble" />
              <Link
                href={`/folder/${folder.id}`}
                className="flex shrink-0 items-center gap-1.5 font-semibold text-charcoal transition-colors hover:text-electric-indigo"
              >
                <FolderIcon className="size-3.5" />
                {folder.name}
              </Link>
            </div>

            <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-pebble sm:flex">
              <span className="h-3 w-px bg-stone-mist" />
              {chunks.length} {chunks.length === 1 ? "passage" : "passages"}
            </span>
          </div>
        }
        actions={
          <>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setMessages([])}
                className="h-8 px-2.5 text-[12px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
              >
                Clear
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Actions for ${folder.name}`}
                    className="flex size-8 items-center justify-center rounded-[8px] text-bark-grey transition-colors hover:bg-stone-mist/60 hover:text-charcoal"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    void library.removeFolder(folder.id);
                  }}
                >
                  <Trash2Icon className="mr-2 size-3.5" />
                  Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Drawer
              open={isContextOpen}
              onOpenChange={setIsContextOpen}
              swipeDirection="right"
            >
              <DrawerTrigger
                render={
                  <button
                    type="button"
                    aria-label="Open the context panel"
                    className="flex size-8 items-center justify-center rounded-[8px] text-bark-grey transition-colors hover:bg-stone-mist/60 hover:text-charcoal lg:hidden"
                  >
                    <PanelRightIcon className="size-4" />
                  </button>
                }
              />
              <DrawerContent className="w-full max-w-[340px]">
                <DrawerTitle className="sr-only">Context</DrawerTitle>
                <DrawerDescription className="sr-only">
                  The passages the assistant may use
                </DrawerDescription>
                {contextPanel}
              </DrawerContent>
            </Drawer>
          </>
        }
      />

      {/* The workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <section className="flex min-h-0 flex-col">
          {messages.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-6 pb-16">
              {hasContent ? (
                <>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex size-10 items-center justify-center rounded-[12px] bg-electric-indigo/10 text-electric-indigo">
                      <SparklesIcon className="size-5" />
                    </span>
                    <h1 className="display-face text-[28px] text-charcoal">
                      Ask this folder
                    </h1>
                    <p className="max-w-[42ch] text-[14px] leading-[1.5] text-bark-grey">
                      {pluralize(chunks.length, "passage")} loaded. Ask anything
                      and I will find the parts that answer it.
                    </p>
                  </div>

                  <div className="flex w-full max-w-[440px] flex-col gap-1.5">
                    {[
                      "Summarise the main points of this folder",
                      "What are the key terms and definitions here?",
                      "Where does this document argue against the consensus?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void handleAsk(suggestion)}
                        className="rounded-[10px] border border-stone-mist bg-paper-white px-3.5 py-2.5 text-left text-[13px] text-charcoal transition-colors hover:border-electric-indigo/40 hover:bg-warm-bone"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <FolderEmpty
                  hasKey={settings.hasKey}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
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
          />
        </section>

        <div className="hidden min-h-0 lg:block">{contextPanel}</div>
      </div>

      {embedding.state === "loading" && (
        <ProgressPopup
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          label={embedding.message ?? "Preparing the embedding model"}
          percent={embedding.percent}
        />
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
      if (
        folder.parentId &&
        ids.has(folder.parentId) &&
        !ids.has(folder.id)
      ) {
        ids.add(folder.id);
        grew = true;
      }
    }
  }
  return [...ids];
}

/**
 * The folders above this one, root first.
 */
function collectAncestors(folder: Folder, folders: Folder[]): Folder[] {
  const byId = new Map(folders.map((entry) => [entry.id, entry]));
  const ancestors: Folder[] = [];

  let current = folder.parentId ? byId.get(folder.parentId) : undefined;
  while (current) {
    ancestors.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return ancestors;
}
