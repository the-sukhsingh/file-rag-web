"use client";

import * as React from "react";
import { AlignLeftIcon, BookOpenIcon, FileTextIcon, FilesIcon, GitCompareArrowsIcon, KeyRoundIcon, LightbulbIcon, MessagesSquareIcon, PanelLeftCloseIcon, PanelLeftIcon, PlusIcon, RefreshCwIcon, Settings2Icon, SparklesIcon, SquarePenIcon, UploadIcon } from "lucide-react";
import { cn } from "cn";

import { ChatHistory } from "@/components/chat/chat-history";
import { MessageList } from "@/components/chat/message-list";
import { PromptBox } from "@/components/chat/prompt-box";
import { useChatHistory } from "@/components/chat/use-chat-history";
import { SettingsDialog } from "@/components/layout/settings-dialog";
import { FileSidebar, type UploadState } from "@/components/library/file-sidebar";
import { useLibrary } from "@/components/library/library-provider";
import { useSettings } from "@/components/library/settings-provider";
import { ModeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { createMessageId, now } from "@/lib/chat/ids";
import { runAgent } from "@/lib/groq/agent";
import { listChunksByDocument } from "@/lib/library/store";
import type { ChatMessage, ChatSource, DocumentRecord, SourceChunk } from "@/lib/library/types";

const suggestions = [
  { label: "Summarize", question: "Give me a clear, concise summary of the selected files, citing the sources.", icon: AlignLeftIcon },
  { label: "Takeaways", question: "What are the most important takeaways from the selected files? Cite the sources.", icon: LightbulbIcon },
  { label: "Compare", question: "Compare the selected files. Where do they agree and differ? Cite the sources.", icon: GitCompareArrowsIcon },
];

const ideas = [
  "What are the main arguments across these files?",
  "Which claims are supported by evidence in the documents?",
  "Summarize the selected files in five bullet points.",
  "Where do these documents agree, and where do they differ?",
  "What questions do these documents leave unanswered?",
];

type SourcePreview = { title: string; documentId: string; chunks: SourceChunk[] | null; error?: string };
type SidebarView = "files" | "chats";

function subscribeSidebarView(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readSidebarView(): SidebarView {
  try {
    return window.localStorage.getItem("quarry-sidebar-view") === "chats" ? "chats" : "files";
  } catch {
    return "files";
  }
}

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function greetingFor(hour: number) {
  return hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
}

export default function WorkspacePage() {
  const library = useLibrary();
  const settings = useSettings();
  const history = useChatHistory();
  const messages = history.activeConversation?.messages ?? [];
  const savedSidebarView = React.useSyncExternalStore(subscribeSidebarView, readSidebarView, () => "files" as const);
  const mounted = React.useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
  const [sidebarView, setSidebarView] = React.useState<SidebarView | null>(null);
  const [ideaIndex, setIdeaIndex] = React.useState(0);
  const [draftExcludedIds, setDraftExcludedIds] = React.useState(new Set<string>());
  const [isBusy, setIsBusy] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [upload, setUpload] = React.useState<UploadState | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = React.useState<DocumentRecord | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [removalError, setRemovalError] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<SourcePreview | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [chatVersion, setChatVersion] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const uploadingRef = React.useRef(false);
  const sourcesRef = React.useRef(new Map<string, ChatSource>());

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const activeDocumentIds = history.activeConversation?.documentIds;
  const excludedIds = activeDocumentIds
    ? new Set(library.documents.filter((document) => !activeDocumentIds.includes(document.id)).map((document) => document.id))
    : draftExcludedIds;
  const selectedDocuments = library.documents.filter((document) => !excludedIds.has(document.id));
  const hasReadableFiles = selectedDocuments.some((document) => document.chunkCount > 0);
  const locked = isBusy || isRemoving || !history.ready;
  const savedSources = new Map(history.activeConversation?.sources.map((entry) => [entry.chunk.id, entry]) ?? []);
  const activeView = sidebarView ?? savedSidebarView;
  const greeting = mounted ? greetingFor(new Date().getHours()) : "Hello.";
  const idea = ideas[ideaIndex % ideas.length];
  const heroSubline = library.documents.length === 0
    ? "Add a PDF to start. Every answer stays tied to its source."
    : selectedDocuments.length === 0
      ? "Select a file in the sidebar to bring it into this conversation."
      : `${selectedDocuments.length} ${selectedDocuments.length === 1 ? "file" : "files"} ready. Summarize, compare, or find one specific detail.`;
  const composerPlaceholder = !history.ready ? "Loading your conversations…" : !library.documents.length ? "Your next insight starts with a file…" : !selectedDocuments.length ? "Select a file to start a conversation…" : !hasReadableFiles ? "Add a PDF with readable text to chat…" : !settings.hasKey ? "Connect AI to ask your first question…" : "Ask anything about your files…";
  const keyBanner = !settings.hasKey && library.documents.length > 0 ? (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
      <KeyRoundIcon className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
      <span>Connect your Groq API key to start chatting.</span>
      <button type="button" onClick={() => setIsSettingsOpen(true)} className="font-medium text-primary underline-offset-4 hover:underline">Connect AI</button>
    </div>
  ) : null;

  const changeSidebarView = (view: SidebarView) => {
    setSidebarView(view);
    try {
      window.localStorage.setItem("quarry-sidebar-view", view);
    } catch {
      // The view remains usable when browser storage is unavailable.
    }
  };

  const setSelection = (next: Set<string>) => {
    if (history.activeConversation) history.updateConversation(history.activeConversation.id, (conversation) => ({ ...conversation, documentIds: library.documents.filter((document) => !next.has(document.id)).map((document) => document.id) }));
    else setDraftExcludedIds(next);
  };

  const openConversation = (id: string | null) => {
    if (locked || uploadingRef.current) return;
    history.selectConversation(id);
    sourcesRef.current.clear();
    setSource(null);
    setIsMobileSidebarOpen(false);
    setChatVersion((value) => value + 1);
  };

  const handleFiles = async (files: File[]) => {
    if (uploadingRef.current || locked || !files.length) return;
    uploadingRef.current = true;
    changeSidebarView("files");
    if (window.matchMedia("(max-width: 767px)").matches) setIsMobileSidebarOpen(true);
    else setIsSidebarOpen(true);
    setUploadError(null);
    const errors: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
          errors.push(`${file.name}: please choose a PDF file.`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          errors.push(`${file.name}: this file is larger than 50 MB.`);
          continue;
        }
        setUpload({ name: file.name, percent: 0, position: index + 1, total: files.length });
        try {
          const result = await library.importPdf(file, null, (_message, percent) => {
            setUpload({ name: file.name, percent: Math.min(percent, 95), position: index + 1, total: files.length });
          });
          if (history.activeConversation) history.updateConversation(history.activeConversation.id, (conversation) => ({ ...conversation, documentIds: [...conversation.documentIds, result.document.id] }));
          if (!result.chunks.length) {
            errors.push(`${file.name}: no readable text was found. Try a text-based PDF instead of a scanned image.`);
          }
        } catch (error) {
          errors.push(`${file.name}: ${error instanceof Error ? error.message : "Could not import this file. Please try again."}`);
        }
      }
    } finally {
      uploadingRef.current = false;
      setUpload(null);
      setUploadError(errors.length ? errors.join("\n") : null);
    }
  };

  const handleAsk = async (question: string) => {
    if (abortRef.current || !hasReadableFiles || isRemoving || !history.ready) return;
    if (!settings.hasKey) {
      setIsSettingsOpen(true);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = createMessageId();
    const conversationId = history.activeConversation?.id ?? createMessageId();
    const userMessage: ChatMessage = { id: createMessageId(), role: "user", content: question, createdAt: now() };
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "", trace: [], createdAt: now() };
    if (history.activeConversation) {
      history.updateConversation(conversationId, (conversation) => ({ ...conversation, messages: [...conversation.messages, userMessage, assistantMessage], isStreaming: true }));
    } else {
      history.createConversation({ id: conversationId, title: question.trim().slice(0, 100), messages: [userMessage, assistantMessage], documentIds: selectedDocuments.map((document) => document.id), sources: [], isStreaming: true, createdAt: now(), updatedAt: now() });
    }
    setIsBusy(true);

    const patch = (update: (message: ChatMessage) => ChatMessage, finished = false) => {
      if (abortRef.current !== controller) return;
      const availableSources = new Map([...savedSources, ...sourcesRef.current]);
      history.updateConversation(conversationId, (conversation) => {
        const nextMessages = conversation.messages.map((message) => message.id === assistantId ? update(message) : message);
        const citedIds = new Set(nextMessages.flatMap((message) => message.citations ?? []));
        const sources = [...citedIds].flatMap((id) => { const entry = availableSources.get(id); return entry ? [entry] : []; });
        return { ...conversation, messages: nextMessages, sources, isStreaming: !finished };
      });
    };

    try {
      const groups = await Promise.all(selectedDocuments.map((document) => listChunksByDocument(document.id)));
      if (controller.signal.aborted) return;
      const chunks = groups.flat();
      if (!chunks.length) throw new Error("These files have no readable text. Please add a text-based PDF.");
      const documentNames = new Map(selectedDocuments.map((document) => [document.id, document.fileName]));
      for (const { id, documentId, section, index, startPage, endPage, text } of chunks) {
        sourcesRef.current.set(id, { chunk: { id, documentId, section, index, startPage, endPage, text }, name: documentNames.get(documentId) ?? "Source" });
      }
      await runAgent(
        {
          question,
          folderName: "selected files",
          chunks,
          documentNames,
          history: messages.filter((message) => message.content).map(({ role, content }) => ({ role, content })),
          apiKey: settings.apiKey,
          model: settings.model,
          signal: controller.signal,
        },
        {
          onTrace: (step) => patch((message) => {
            const trace = message.trace ?? [];
            return { ...message, trace: trace.some((entry) => entry.id === step.id) ? trace.map((entry) => entry.id === step.id ? step : entry) : [...trace, step] };
          }),
          onText: (delta) => patch((message) => ({ ...message, content: message.content + delta })),
          onCitations: (citations) => patch((message) => ({ ...message, citations })),
        }
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        const reason = error instanceof Error ? error.message : "Please try again.";
        patch((message) => ({ ...message, content: `${message.content ? `${message.content}\n\n` : ""}I couldn’t complete that answer. ${reason}` }));
      }
    } finally {
      patch((message) => ({
        ...message,
        content: message.content || (controller.signal.aborted ? "Response stopped." : "No answer was returned. Please try again."),
        trace: message.trace?.map((step) => step.state === "running" ? { ...step, state: "failed" } : step),
      }), true);
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsBusy(false);
      }
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handlePreview = async (document: DocumentRecord) => {
    setIsMobileSidebarOpen(false);
    const preview: SourcePreview = { title: document.fileName, documentId: document.id, chunks: null };
    setSource(preview);
    try {
      const chunks = await listChunksByDocument(document.id);
      chunks.sort((a, b) => (a.startPage ?? 0) - (b.startPage ?? 0) || a.index - b.index);
      setSource((previous) => previous === preview ? { ...previous, chunks } : previous);
    } catch {
      setSource((previous) => previous === preview ? { ...previous, chunks: [], error: "Could not load this file. Please try again." } : previous);
    }
  };

  const handleCite = (chunkId: string) => {
    const entry = sourcesRef.current.get(chunkId) ?? savedSources.get(chunkId);
    if (entry) setSource({ title: entry.name, documentId: entry.chunk.documentId, chunks: [entry.chunk] });
  };

  const handleRemove = async () => {
    if (!pendingRemoval || isRemoving) return;
    setIsRemoving(true);
    setRemovalError(null);
    try {
      await library.removeDocument(pendingRemoval.id);
      setDraftExcludedIds((previous) => {
        const next = new Set(previous);
        next.delete(pendingRemoval.id);
        return next;
      });
      setPendingRemoval(null);
    } catch {
      setRemovalError("The file could not be removed. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  };

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar" aria-label="Workspace sidebar">
      <div className="flex h-14 shrink-0 items-center px-3">
        <p className="display-face text-[21px] leading-none">quarry<span className="text-primary">.</span></p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-1.5 ml-auto hidden text-muted-foreground/70 hover:text-foreground md:inline-flex"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          onClick={() => setIsSidebarOpen(false)}
        >
          <PanelLeftCloseIcon className="size-4" />
        </Button>
      </div>
      <nav aria-label="Workspace views" className="shrink-0 px-3">
        <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted/60 p-0.5">
          <button
            type="button"
            onClick={() => changeSidebarView("files")}
            aria-current={activeView === "files" ? "page" : undefined}
            className={cn(
              "flex h-7 items-center justify-center gap-1.5 rounded-[6px] text-[11px] transition-colors",
              activeView === "files" ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(23,33,28,0.07)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FilesIcon className="size-3.5" strokeWidth={1.8} />
            Files
          </button>
          <button
            type="button"
            onClick={() => changeSidebarView("chats")}
            aria-current={activeView === "chats" ? "page" : undefined}
            className={cn(
              "flex h-7 items-center justify-center gap-1.5 rounded-[6px] text-[11px] transition-colors",
              activeView === "chats" ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(23,33,28,0.07)]" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessagesSquareIcon className="size-3.5" strokeWidth={1.8} />
            Chats
          </button>
        </div>
      </nav>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <div className={cn("min-h-0 flex-1 flex-col", activeView === "files" ? "flex" : "hidden")}>
          <FileSidebar
            documents={library.documents}
            ready={library.ready}
            excludedIds={excludedIds}
            onToggle={(id) => {
              const next = new Set(excludedIds);
              if (next.has(id)) next.delete(id); else next.add(id);
              setSelection(next);
            }}
            onSelectAll={() => setSelection(selectedDocuments.length === library.documents.length ? new Set(library.documents.map((document) => document.id)) : new Set())}
            onPreview={(document) => void handlePreview(document)}
            onRemove={(document) => { setIsMobileSidebarOpen(false); setRemovalError(null); setPendingRemoval(document); }}
            onPickFiles={() => inputRef.current?.click()}
            onFiles={(files) => void handleFiles(files)}
            upload={upload}
            error={uploadError}
            onDismissError={() => setUploadError(null)}
            disabled={locked}
            indexing={library.indexing}
          />
        </div>
        <div className={cn("min-h-0 flex-1 flex-col", activeView === "chats" ? "flex" : "hidden")}>
          <ChatHistory
            conversations={history.conversations}
            activeId={history.activeId}
            onSelect={openConversation}
            onDelete={(id) => {
              if (locked || uploadingRef.current) return;
              if (id === history.activeId) openConversation(null);
              history.deleteConversation(id);
            }}
            ready={history.ready}
            disabled={locked || !!upload}
          />
        </div>
      </div>
      <div className="shrink-0 px-2 pt-1 pb-1">
        <button
          type="button"
          disabled={!history.ready || locked || !!upload || messages.length === 0}
          onClick={() => openConversation(null)}
          className="flex h-8 w-full items-center gap-2 rounded-lg px-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <SquarePenIcon className="size-3.5" /> New conversation
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-t border-border/60 px-2.5 py-1.5">
        <Button variant="ghost" onClick={() => { setIsMobileSidebarOpen(false); setIsSettingsOpen(true); }} className="-ml-1.5 h-8 gap-2 px-2 text-[11px] font-normal text-muted-foreground hover:text-foreground"><Settings2Icon className="size-3.5" /> Settings</Button>
        <ModeToggle className="ml-auto size-8" />
      </div>
    </aside>
  );

  const composer = (hero: boolean) => (
    <PromptBox
      key={chatVersion}
      onSubmit={(text) => void handleAsk(text)}
      onStop={handleStop}
      isBusy={isBusy}
      disabled={!history.ready || !library.ready || !hasReadableFiles || !settings.hasKey || isRemoving}
      placeholder={composerPlaceholder}
      className={hero ? "w-full" : undefined}
      showHint={!hero}
      onAttach={() => inputRef.current?.click()}
      attachDisabled={locked || !!upload}
    >
      <FilesIcon className="mr-1.5 size-3.5 shrink-0" />
      <span className="truncate" title={selectedDocuments.map((document) => document.fileName).join("\n")}>{selectedDocuments.length ? `${selectedDocuments.length} ${selectedDocuments.length === 1 ? "file" : "files"} in context` : "No files selected"}</span>
    </PromptBox>
  );

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden aria-label="Upload PDF files" onChange={(event) => { void handleFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <div id="desktop-workspace-sidebar" className={isSidebarOpen ? "hidden w-[284px] shrink-0 border-r border-border/80 md:block lg:w-[300px]" : "hidden"}>{sidebar}</div>

      <main
        id="chat"
        aria-label="Document chat"
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFiles(Array.from(event.dataTransfer.files)); }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="size-9 md:hidden" aria-label="Open sidebar"><PanelLeftIcon className="size-4" /></Button>} />
              <SheetContent side="left" className="gap-0 data-[side=left]:w-[min(320px,90vw)]">
                <SheetTitle className="sr-only">Files and chats</SheetTitle>
                <SheetDescription className="sr-only">Choose files to manage your documents, or chats to reopen a conversation.</SheetDescription>
                {sidebar}
              </SheetContent>
            </Sheet>
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden size-8 md:inline-flex"
                aria-label="Expand sidebar"
                title="Expand sidebar"
                aria-expanded={false}
                aria-controls="desktop-workspace-sidebar"
                onClick={() => setIsSidebarOpen(true)}
              >
                <PanelLeftIcon className="size-4" />
              </Button>
            )}
            <div className="flex min-w-0 items-center gap-2 text-[12px]">
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground">Chat</span>
              <span aria-hidden="true" className="text-muted-foreground/50">/</span>
              <span className="min-w-0 truncate text-muted-foreground">{history.activeConversation?.title ?? "New chat"}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" disabled={locked || !!upload || messages.length === 0} onClick={() => openConversation(null)} aria-label="New chat" title="New chat" className="text-muted-foreground hover:text-foreground"><SquarePenIcon className="size-4" /></Button>
        </header>
        {history.error && <div role="alert" className="flex shrink-0 items-start justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-[11px] leading-5 text-destructive sm:px-8"><p>{history.error}</p><button type="button" onClick={history.retry} className="shrink-0 rounded-sm font-medium underline underline-offset-4">Retry</button></div>}

        {!history.ready ? <div role="status" className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Spinner className="size-3.5" /> Loading your conversations…</div> : messages.length > 0 ? (
          <>
            <MessageList
              key={history.activeId}
              messages={messages}
              onCite={handleCite}
              isBusy={isBusy}
              getSourceLabel={(id) => {
                const entry = sourcesRef.current.get(id) ?? savedSources.get(id);
                return entry ? `${entry.name}${entry.chunk.startPage ? ` · p. ${entry.chunk.startPage}` : ""}` : "Source";
              }}
            />
            {keyBanner && <div className="mx-auto w-full max-w-[760px] shrink-0 px-4 pt-2 sm:px-8">{keyBanner}</div>}
            {composer(false)}
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 sm:px-8">
            <div className="workspace-enter mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center py-8 sm:py-12">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 sm:gap-4">
                  <BookOpenIcon className="size-8 shrink-0 text-primary sm:size-11" strokeWidth={1.2} aria-hidden="true" />
                  <h2 className="display-face text-[34px] text-foreground min-[380px]:text-[40px] sm:text-[52px]">{greeting}</h2>
                </div>
                <p className="mx-auto mt-3 max-w-[420px] text-[12px] leading-5 text-muted-foreground sm:text-[13px]">{heroSubline}</p>
              </div>
              <div className="mt-7 sm:mt-9">
                {keyBanner && <div className="mb-3">{keyBanner}</div>}
                {composer(true)}
                {library.documents.length === 0 ? (
                  <div className="mt-4 flex justify-center">
                    <Button onClick={() => inputRef.current?.click()} disabled={!library.ready || !!upload} variant="outline" className="h-9 gap-2 rounded-full border-primary/20 bg-transparent px-4 text-[11px] font-medium text-primary hover:bg-primary/5"><PlusIcon className="size-3.5" /> Add your first file</Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5 [@media(max-height:700px)]:hidden">
                      {suggestions.map(({ label, question, icon: Icon }, index) => (
                        <button key={label} type="button" disabled={!hasReadableFiles || isRemoving || (index === 2 && selectedDocuments.length < 2)} onClick={() => void handleAsk(question)} className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                          <Icon className="size-3.5" strokeWidth={1.6} aria-hidden="true" />{label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground [@media(max-height:700px)]:hidden">
                      <SparklesIcon className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                      <span className="font-medium text-foreground/70">Ideas for you</span>
                      <button type="button" disabled={!hasReadableFiles || isRemoving} onClick={() => void handleAsk(idea)} className="min-w-0 max-w-full text-left underline-offset-4 hover:text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50">{idea}</button>
                      <button type="button" aria-label="Show another idea" title="Show another idea" onClick={() => setIdeaIndex((index) => (index + 1) % ideas.length)} className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"><RefreshCwIcon className="size-3" /></button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {dragging && !locked && !upload && (
          <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-background/95 text-primary"><UploadIcon className="size-7" /><p className="text-sm font-medium">Drop your PDFs here</p><p className="text-xs text-muted-foreground">Up to 50 MB per file</p></div>
        )}
      </main>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <Dialog open={!!pendingRemoval} onOpenChange={(open) => { if (!open && !isRemoving) setPendingRemoval(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this file?</DialogTitle>
            <DialogDescription className="break-words">“{pendingRemoval?.fileName}” and its extracted text will be removed from this browser. Your original PDF is not affected.</DialogDescription>
          </DialogHeader>
          {removalError && <p role="alert" className="text-sm text-destructive">{removalError}</p>}
          <DialogFooter>
            <Button variant="outline" disabled={isRemoving} onClick={() => setPendingRemoval(null)}>Keep file</Button>
            <Button variant="destructive" disabled={isRemoving} onClick={() => void handleRemove()}>{isRemoving && <Spinner className="size-3.5" />} Remove file</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!source} onOpenChange={(open) => { if (!open) setSource(null); }}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-primary"><FileTextIcon className="size-3.5" /> Source text</div>
            <DialogTitle className="break-words text-base leading-6">{source?.title}</DialogTitle>
            <DialogDescription className="text-xs">Extracted from your PDF. Passages may overlap to preserve context.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            {source?.chunks === null ? <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="size-4" /> Loading source…</div> : source?.error ? <p role="alert" className="text-sm text-destructive">{source.error}</p> : source?.chunks.length === 0 ? <p className="text-sm text-muted-foreground">No readable text was found. Try a text-based PDF; scanned images are not supported.</p> : source?.chunks.map((chunk) => (
              <article key={chunk.id} className="border-b border-border py-5 first:pt-0 last:border-0 last:pb-0">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className="font-medium text-primary">{chunk.startPage ? `Page ${chunk.startPage}${chunk.endPage && chunk.endPage !== chunk.startPage ? `–${chunk.endPage}` : ""}` : "Passage"}</span><span aria-hidden="true">·</span><span>{chunk.section}</span></div>
                <p className="whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere]">{chunk.text}</p>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
