"use client";

import * as React from "react";
import { ArrowUpRightIcon, FileTextIcon, FilesIcon, HistoryIcon, PanelLeftIcon, PlusIcon, UploadIcon } from "lucide-react";

import { ChatHistoryDialog } from "@/components/chat/chat-history-dialog";
import { MessageList } from "@/components/chat/message-list";
import { PromptBox } from "@/components/chat/prompt-box";
import { useChatHistory } from "@/components/chat/use-chat-history";
import { SettingsDialog } from "@/components/layout/settings-dialog";
import { FileSidebar, type UploadState } from "@/components/library/file-sidebar";
import { useLibrary } from "@/components/library/library-provider";
import { useSettings } from "@/components/library/settings-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { createMessageId, now } from "@/lib/chat/ids";
import { runAgent } from "@/lib/groq/agent";
import { listChunksByDocument } from "@/lib/library/store";
import type { ChatMessage, ChatSource, DocumentRecord, SourceChunk } from "@/lib/library/types";

const suggestions = [
  { label: "Give me a summary", question: "Give me a clear, concise summary of the selected files, citing the sources." },
  { label: "Find key takeaways", question: "What are the most important takeaways from the selected files? Cite the sources." },
  { label: "Compare my files", question: "Compare the selected files. Where do they agree and differ? Cite the sources." },
];

type SourcePreview = { title: string; documentId: string; chunks: SourceChunk[] | null; error?: string };

export default function WorkspacePage() {
  const library = useLibrary();
  const settings = useSettings();
  const history = useChatHistory();
  const messages = history.activeConversation?.messages ?? [];
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [draftExcludedIds, setDraftExcludedIds] = React.useState(new Set<string>());
  const [isBusy, setIsBusy] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isFilesOpen, setIsFilesOpen] = React.useState(false);
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

  const setSelection = (next: Set<string>) => {
    if (history.activeConversation) history.updateConversation(history.activeConversation.id, (conversation) => ({ ...conversation, documentIds: library.documents.filter((document) => !next.has(document.id)).map((document) => document.id) }));
    else setDraftExcludedIds(next);
  };

  const openConversation = (id: string | null) => {
    if (locked || uploadingRef.current) return;
    history.selectConversation(id);
    sourcesRef.current.clear();
    setSource(null);
    setIsHistoryOpen(false);
    setChatVersion((value) => value + 1);
  };

  const handleFiles = async (files: File[]) => {
    if (uploadingRef.current || locked || !files.length) return;
    uploadingRef.current = true;
    if (window.matchMedia("(max-width: 767px)").matches) setIsFilesOpen(true);
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
    setIsFilesOpen(false);
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
      onRemove={(document) => { setIsFilesOpen(false); setRemovalError(null); setPendingRemoval(document); }}
      onPickFiles={() => inputRef.current?.click()}
      onFiles={(files) => void handleFiles(files)}
      upload={upload}
      error={uploadError}
      onDismissError={() => setUploadError(null)}
      disabled={locked}
      indexing={library.indexing}
      onOpenSettings={() => { setIsFilesOpen(false); setIsSettingsOpen(true); }}
    />
  );

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden aria-label="Upload PDF files" onChange={(event) => { void handleFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <div id="desktop-file-sidebar" className={isSidebarOpen ? "hidden w-[284px] shrink-0 border-r border-border/80 md:block lg:w-[300px]" : "hidden"}>{sidebar}</div>

      <main
        id="chat"
        aria-label="Document chat"
        className="relative flex min-w-0 flex-1 flex-col"
        onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files")) setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void handleFiles(Array.from(event.dataTransfer.files)); }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="hidden size-8 md:inline-flex"
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isSidebarOpen}
              aria-controls="desktop-file-sidebar"
              onClick={() => setIsSidebarOpen((open) => !open)}
            >
              <PanelLeftIcon className="size-4" />
            </Button>
            <Sheet open={isFilesOpen} onOpenChange={setIsFilesOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="size-9 md:hidden" aria-label="Open files"><PanelLeftIcon className="size-4" /></Button>} />
              <SheetContent side="left" className="gap-0 data-[side=left]:w-[min(320px,90vw)]">
                <SheetTitle className="sr-only">Your files</SheetTitle>
                <SheetDescription className="sr-only">Upload and select the files to use in your conversation.</SheetDescription>
                {sidebar}
              </SheetContent>
            </Sheet>
            <h1 className="text-[13px] font-medium">Chat</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" disabled={!history.ready} onClick={() => setIsHistoryOpen(true)} className="h-8 gap-1.5 px-2 text-[11px] font-normal text-muted-foreground"><HistoryIcon className="size-3.5" /> History</Button>
            <Button variant="ghost" disabled={locked || !!upload || messages.length === 0} onClick={() => openConversation(null)} className="h-8 gap-1.5 px-2 text-[11px] font-normal text-muted-foreground"><PlusIcon className="size-3.5" /> New chat</Button>
          </div>
        </header>
        {history.error && <div role="alert" className="flex shrink-0 items-start justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-[11px] leading-5 text-destructive sm:px-8"><p>{history.error}</p><button type="button" onClick={history.retry} className="shrink-0 rounded-sm font-medium underline underline-offset-4">Retry</button></div>}

        {!history.ready ? <div role="status" className="flex min-h-0 flex-1 items-center justify-center gap-2 text-xs text-muted-foreground"><Spinner className="size-3.5" /> Loading your conversations…</div> : messages.length > 0 ? (
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
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-8 sm:px-10">
            <div className="workspace-enter my-auto w-full max-w-[640px] text-center">
              <span className="mx-auto mb-7 flex size-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary [@media(max-height:700px)]:hidden"><FilesIcon className="size-5" strokeWidth={1.4} /></span>
              <p className="mb-4 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase [@media(max-height:700px)]:hidden">Less searching. More understanding.</p>
              <h2 className="display-face text-[28px] text-foreground min-[380px]:text-[32px] sm:text-[44px]">Your documents.<br /><span className="text-primary italic">A clearer perspective.</span></h2>
              <p className="mx-auto mt-5 max-w-[360px] text-[13px] leading-6 text-muted-foreground">
                {library.documents.length === 0
                  ? "Add your files, ask a question, and get to what matters. Every answer, connected to its source."
                  : selectedDocuments.length === 0
                    ? "Select a file in the sidebar to bring it into the conversation."
                    : "Summarize the details, connect the ideas, or find that one thing you’re looking for."}
              </p>
              {library.documents.length === 0 ? (
                <Button onClick={() => inputRef.current?.click()} disabled={!library.ready || !!upload} variant="outline" className="mt-7 h-10 gap-2 rounded-lg border-primary/20 bg-transparent px-4 text-[12px] font-medium text-primary hover:bg-primary/5"><PlusIcon className="size-3.5" /> Add your first file</Button>
              ) : (
                <div className="mt-8 flex flex-wrap justify-center gap-2 [@media(max-height:700px)]:hidden">
                  {suggestions.map((suggestion, index) => (
                    <button key={suggestion.label} type="button" disabled={!hasReadableFiles || isRemoving || (index === 2 && selectedDocuments.length < 2)} onClick={() => void handleAsk(suggestion.question)} className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3.5 py-2.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">{suggestion.label}<ArrowUpRightIcon className="size-3" /></button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!settings.hasKey && library.documents.length > 0 && (
          <div className="mx-auto flex w-full max-w-[824px] shrink-0 items-center justify-between gap-4 px-4 pt-2 sm:px-8">
            <p className="text-[12px] text-muted-foreground">Connect your Groq API key to start chatting.</p>
            <button type="button" onClick={() => setIsSettingsOpen(true)} className="shrink-0 rounded-md py-2 text-[12px] font-medium text-primary hover:underline">Connect AI <span aria-hidden="true">↗</span></button>
          </div>
        )}
        <PromptBox
          key={chatVersion}
          onSubmit={(text) => void handleAsk(text)}
          onStop={handleStop}
          isBusy={isBusy}
          disabled={!history.ready || !library.ready || !hasReadableFiles || !settings.hasKey || isRemoving}
          placeholder={!history.ready ? "Loading your conversations…" : !library.documents.length ? "Your next insight starts with a file…" : !selectedDocuments.length ? "Select a file to start a conversation…" : !hasReadableFiles ? "Add a PDF with readable text to chat…" : !settings.hasKey ? "Connect AI to ask your first question…" : "Ask anything about your files…"}
        >
          <FilesIcon className="mr-1.5 size-3.5 shrink-0" />
          <span>{selectedDocuments.length ? `${selectedDocuments.length} ${selectedDocuments.length === 1 ? "file" : "files"} in this conversation` : "No files selected"}</span>
          <span className="ml-auto hidden text-[10px] text-muted-foreground/80 sm:inline">Enter to send <span className="mx-1.5">·</span> Shift + Enter for a new line</span>
        </PromptBox>

        {dragging && !locked && !upload && (
          <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-background/95 text-primary"><UploadIcon className="size-7" /><p className="text-sm font-medium">Drop your PDFs here</p><p className="text-xs text-muted-foreground">Up to 50 MB per file</p></div>
        )}
      </main>

      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ChatHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        conversations={history.conversations}
        activeId={history.activeId}
        onSelect={openConversation}
        onDelete={(id) => {
          if (locked || uploadingRef.current) return;
          if (id === history.activeId) openConversation(null);
          history.deleteConversation(id);
        }}
        disabled={locked || !!upload}
      />
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
