"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderPlusIcon,
  PanelRightIcon,
} from "lucide-react";

import { MessageList } from "@/components/chat/message-list";
import { PromptBox } from "@/components/chat/prompt-box";
import { SettingsDialog } from "@/components/layout/settings-dialog";
import { ProgressPopup } from "@/components/layout/progress-popup";
import { TopNav } from "@/components/layout/top-nav";
import { DropOverlay, DropZone } from "@/components/library/drop-zone";
import {
  ExplorerTree,
  buildExplorer,
  type ExplorerDocument,
} from "@/components/library/explorer-tree";
import { useLibrary } from "@/components/library/library-provider";
import { PassagePane } from "@/components/library/passage-pane";
import { useSettings } from "@/components/library/settings-provider";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { createMessageId, now } from "@/lib/chat/ids";
import { runAgent } from "@/lib/groq/agent";
import type { ChatMessage, Chunk, Folder, TraceStep } from "@/lib/library/types";
import { onEmbeddingStatus } from "@/lib/retrieval/embeddings";
import { pluralize } from "@/lib/utils";

/**
 * The folder workspace.
 *
 * Three columns, the way a text editor is put together: the explorer on the
 * left, the passage that is open in the middle, and the chat on the right.
 * Everything is one screen - a document can be added, a passage rewritten and
 * a question asked without leaving the folder.
 */
export default function FolderPage() {
  const params = useParams<{ folder: string }>();
  const library = useLibrary();
  const settings = useSettings();

  const folderId = params?.folder ?? "";
  const folder = library.getFolder(folderId);

  const [chunks, setChunks] = React.useState<Chunk[]>([]);
  const [selectedChunkId, setSelectedChunkId] = React.useState<string | null>(
    null
  );
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [selection, setSelection] = React.useState({
    pinned: new Set<string>(),
    excluded: new Set<string>(),
  });
  const [isBusy, setIsBusy] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isChatOpen, setIsChatOpen] = React.useState(false);
  const [lastRetrieved, setLastRetrieved] = React.useState<string[]>([]);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
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

  /* ---- Load the passages of this folder and its sub-folders ---------- */

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

  /* ---- The explorer ------------------------------------------------- */

  const explorer: ExplorerDocument[] = React.useMemo(
    () => buildExplorer(library.folders, library.documents, chunks),
    [library.folders, library.documents, chunks]
  );

  const selectedChunk = chunks.find((chunk) => chunk.id === selectedChunkId);

  const selectedChapter = selectedChunk
    ? folders.find((entry) => entry.id === selectedChunk.folderId)
    : undefined;

  const selectedDocument = selectedChunk
    ? library.documents.find(
        (document) => document.id === selectedChunk.documentId
      )
    : undefined;

  /* ---- Ask a question ----------------------------------------------- */

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
          documentNames: new Map(
            library.documents.map((document) => [document.id, document.name])
          ),
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

  /* ---- Managing the passages ---------------------------------------- */

  const handleAddPassage = async (document: { id: string; name: string }) => {
    const container = library.folders.find(
      (folder) => folder.id === document.id
    );
    const chapter =
      library.folders.find((folder) => folder.parentId === container?.id) ??
      container;
    if (!chapter) return;

    await library.addChunk({
      documentId: document.id,
      folderId: chapter.id,
      section: chapter.name,
      text: "New passage.",
    });
  };

  const handleSavePassage = async (text: string) => {
    if (!selectedChunk) return;
    setIsSaving(true);
    try {
      await library.editChunk(selectedChunk.id, text);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePassage = async (chunk: Chunk) => {
    await library.removeChunk(chunk.id);
    if (selectedChunkId === chunk.id) setSelectedChunkId(null);
  };

  const handleMovePassage = async (chunk: Chunk) => {
    // The chapters of the document the passage belongs to.
    const chapters = library.folders.filter(
      (folder) => folder.parentId === chunk.folderId
    );
    const target = chapters.find((folder) => folder.id !== chunk.folderId);
    if (!target) return;
    await library.moveChunkTo(chunk.id, target.id);
  };

  const togglePin = (chunk: Chunk) => {
    setSelection((previous) => {
      const pinned = new Set(previous.pinned);
      if (pinned.has(chunk.id)) pinned.delete(chunk.id);
      else pinned.add(chunk.id);
      return { ...previous, pinned };
    });
  };

  const toggleExclude = (chunk: Chunk) => {
    setSelection((previous) => {
      const excluded = new Set(previous.excluded);
      if (excluded.has(chunk.id)) excluded.delete(chunk.id);
      else excluded.add(chunk.id);
      return { ...previous, excluded };
    });
  };

  /* ---- Import ------------------------------------------------------- */

  const handleFiles = async (files: File[]) => {
    for (const file of files) {
      await library.importPdf(file, folderId);
    }
  };

  /* ---- Guards ------------------------------------------------------- */

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
          <Button className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet">
            Back to the library
          </Button>
        </Link>
      </div>
    );
  }

  const ancestors = collectAncestors(folder, folders);

  /* ---- The chat panel ----------------------------------------------- */

  const chatPanel = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 py-8 text-center">
          <span className="flex size-9 items-center justify-center rounded-[11px] bg-electric-indigo/10 text-electric-indigo">
            <MessageSquareFallback />
          </span>
          <div className="flex flex-col gap-1.5">
            <p className="display-face text-[22px] text-charcoal">Ask</p>
            <p className="max-w-[34ch] text-[13px] leading-[1.5] text-bark-grey">
              {chunks.length > 0
                ? `${pluralize(chunks.length, "passage")} loaded. The answer comes from them, and the passages it used are cited.`
                : "Add a PDF and this folder becomes something you can ask questions of."}
            </p>
          </div>
        </div>
      ) : (
        <MessageList messages={messages} compact />
      )}

      <PromptBox
        onSubmit={(text) => void handleAsk(text)}
        onStop={handleStop}
        isBusy={isBusy}
        disabled={chunks.length === 0 || !settings.hasKey}
        placeholder={
          !settings.hasKey
            ? "Add your Groq API key to start asking questions"
            : chunks.length === 0
              ? "Add a PDF to this folder first"
              : `Ask about ${folder.name}...`
        }
      />
    </div>
  );

  const explorerPanel = (
    <aside className="flex h-full min-h-0 flex-col border-r border-stone-mist bg-paper-white">
      <div className="flex items-center justify-between border-b border-stone-mist px-4 py-3">
        <span className="tag-label text-bark-grey">Explorer</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="New sub-folder"
          onClick={() => void library.createFolder("New folder", folder.id)}
          className="text-bark-grey hover:text-charcoal"
        >
          <FolderPlusIcon className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {explorer.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-bark-grey">
            No documents yet. Drop a PDF below.
          </p>
        ) : (
          <ExplorerTree
            documents={explorer}
            selectedChunkId={selectedChunkId}
            citedChunkIds={lastRetrieved}
            onSelectChunk={(chunk) => setSelectedChunkId(chunk.id)}
            onAddPassage={(document) => void handleAddPassage(document)}
            onEditPassage={(chunk) => setSelectedChunkId(chunk.id)}
            onDeletePassage={(chunk) => void handleDeletePassage(chunk)}
            onMovePassage={(chunk) => void handleMovePassage(chunk)}
            onTogglePin={togglePin}
            onToggleExclude={toggleExclude}
            pinnedIds={selection.pinned}
            excludedIds={selection.excluded}
          />
        )}
      </div>

      <div className="border-t border-stone-mist p-3">
        <DropZone
          compact
          onFiles={(files) => void handleFiles(files)}
          hint="Drop PDFs to add them"
        />
      </div>
    </aside>
  );

  const passagePanel = (
    <section
      className="relative flex h-full min-h-0 flex-1 flex-col border-r border-stone-mist bg-paper-white"
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          setIsDraggingFile(true);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDraggingFile(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingFile(false);
        const files = Array.from(event.dataTransfer.files ?? []).filter(
          (file) =>
            file.type === "application/pdf" || /\.pdf$/i.test(file.name)
        );
        if (files.length) void handleFiles(files);
      }}
    >
      <PassagePane
        chunk={selectedChunk ?? null}
        chapterName={selectedChapter?.name}
        documentName={selectedDocument?.name}
        isPinned={
          selectedChunk ? selection.pinned.has(selectedChunk.id) : false
        }
        isExcluded={
          selectedChunk ? selection.excluded.has(selectedChunk.id) : false
        }
        isSaving={isSaving}
        onSave={(text) => void handleSavePassage(text)}
        onMove={() => {
          if (selectedChunk) void handleMovePassage(selectedChunk);
        }}
        onTogglePin={() => {
          if (selectedChunk) togglePin(selectedChunk);
        }}
        onToggleExclude={() => {
          if (selectedChunk) toggleExclude(selectedChunk);
        }}
        onDelete={() => {
          if (selectedChunk) void handleDeletePassage(selectedChunk);
        }}
        onAdd={() => {
          const first = explorer[0];
          if (first) void handleAddPassage(first.document);
        }}
      />

      <DropOverlay
        active={isDraggingFile}
        onFiles={(files) => void handleFiles(files)}
      />
    </section>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopNav
        active="folder"
        hasKey={settings.hasKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        middle={
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
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
              <span className="flex shrink-0 items-center gap-1.5 font-semibold text-charcoal">
                <FolderIcon className="size-3.5 text-electric-indigo" />
                {folder.name}
              </span>
            </nav>

            <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-pebble sm:flex">
              <span className="h-3 w-px bg-stone-mist" />
              {pluralize(chunks.length, "passage")}
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

            <Drawer
              open={isChatOpen}
              onOpenChange={setIsChatOpen}
              swipeDirection="right"
            >
              <DrawerTrigger
                render={
                  <button
                    type="button"
                    aria-label="Open the chat"
                    className="flex size-8 items-center justify-center rounded-[8px] text-bark-grey transition-colors hover:bg-stone-mist/60 hover:text-charcoal xl:hidden"
                  >
                    <PanelRightIcon className="size-4" />
                  </button>
                }
              />
              <DrawerContent className="w-full max-w-[400px]">
                <DrawerTitle className="sr-only">Chat</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Ask questions of this folder
                </DrawerDescription>
                {chatPanel}
              </DrawerContent>
            </Drawer>
          </>
        }
      />

      {/* The workspace: explorer, content, chat */}
      <ResizablePanelGroup
        direction="horizontal"
        className="hidden min-h-0 flex-1 xl:flex"
      >
        <ResizablePanel
          defaultSize="22%"
          minSize="16%"
          maxSize="34%"
          className="min-w-0"
        >
          {explorerPanel}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="48%"
          minSize="30%"
          maxSize="64%"
          className="min-w-0"
        >
          {passagePanel}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="30%"
          minSize="22%"
          maxSize="44%"
          className="min-w-0 bg-background"
        >
          {chatPanel}
        </ResizablePanel>
      </ResizablePanelGroup>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr] xl:hidden">
        <div className="hidden min-h-0 flex-col lg:flex">{explorerPanel}</div>
        {passagePanel}
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

function MessageSquareFallback() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
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
