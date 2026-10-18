"use client";

import * as React from "react";
import {
  BotIcon,
  SparklesIcon,
  Trash2Icon,
  FileCodeIcon,
  XIcon,
} from "lucide-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { VirtualFile } from "@/components/file-explorer/types";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { FileViewer } from "@/components/file-explorer/file-viewer";
import { ImportPdfDialog } from "@/components/file-explorer/import-pdf-dialog";
import { PdfImportResult } from "@/lib/pdf";
import { MessagePattern } from "@/components/ai-elements/message-list";
import { PromptInputDemo } from "@/components/ai-elements/prompt-input";
import {
  loadOrCreateSessionId,
  type AskResponse,
  type CommandReport,
} from "@/lib/chat";

export interface Message {
  role: "assistant" | "user";
  content: string;
  /** Bash commands the server ran against its workspace for this reply. */
  commands?: CommandReport[];
}

export default function Home() {
  // File System State
  const [files, setFiles] = React.useState<VirtualFile[]>([]);
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const [openFileIds, setOpenFileIds] = React.useState<string[]>([]);
  const [isImportPdfOpen, setIsImportPdfOpen] = React.useState(false);

  // Chatbot State
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isClearChatOpen, setIsClearChatOpen] = React.useState(false);
  const [externalPrompt, setExternalPrompt] = React.useState("");
  const [includeFileContext, setIncludeFileContext] = React.useState(true);

  // Computed Active File
  const activeFile = React.useMemo(() => {
    return files.find((f) => f.id === selectedFileId) ?? null;
  }, [files, selectedFileId]);

  const openFiles = React.useMemo(() => {
    return files.filter((f) => openFileIds.includes(f.id));
  }, [files, openFileIds]);

  // File Handlers
  const handleSelectFile = (file: VirtualFile) => {
    setSelectedFileId(file.id);
    if (!openFileIds.includes(file.id)) {
      setOpenFileIds((prev) => [...prev, file.id]);
    }
  };

  const handleCloseFile = (fileId: string) => {
    const updated = openFileIds.filter((id) => id !== fileId);
    setOpenFileIds(updated);
    if (selectedFileId === fileId) {
      setSelectedFileId(updated.length > 0 ? updated[updated.length - 1] : null);
    }
  };

  const handleAddFile = (newFileData: {
    name: string;
    path: string;
    content: string;
    language: string;
  }) => {
    const newFile: VirtualFile = {
      ...newFileData,
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      updatedAt: "Just now",
    };

    setFiles((prev) => [...prev, newFile]);
    setSelectedFileId(newFile.id);
    setOpenFileIds((prev) => [...prev, newFile.id]);
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    handleCloseFile(fileId);
  };

  const handleRenameFile = (fileId: string, newName: string, newPath: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, name: newName, path: newPath } : f))
    );
  };

  const handleUpdateContent = (fileId: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, content, updatedAt: "Just now" } : f
      )
    );
  };

  const handleImportPdf = (result: PdfImportResult) => {
    setFiles(result.files);
    const first = result.files[0] ?? null;
    setSelectedFileId(first?.id ?? null);
    setOpenFileIds(first ? [first.id] : []);
  };

  // Chat Handlers
  const sendMessage = async (text: string): Promise<void> => {
    let promptWithContext = text;

    // Attach active file context if enabled
    if (includeFileContext && activeFile) {
      promptWithContext = `[Context File: ${activeFile.path}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\`\n\nQuestion: ${text}`;
    }

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: loadOrCreateSessionId(),
          // Ship the workspace so the server can mirror it into its own
          // virtual file system before running bash commands over it.
          files: files.map(({ path, content }) => ({ path, content })),
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: promptWithContext },
          ],
        }),
      });

      const data = (await response.json()) as AskResponse;
      const reply = data.message || data.error || "No response received";
      setMessages([
        ...newMessages,
        { role: "assistant", content: reply, commands: data.commands },
      ]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, an error occurred while connecting to the AI assistant.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setExternalPrompt("");
    }
  };

  const handleAskAboutFile = (file: VirtualFile) => {
    setIncludeFileContext(true);
    setExternalPrompt(`Can you explain the structure and functionality of ${file.name}?`);
  };

  const clearChat = () => {
    setMessages([]);
    setIsClearChatOpen(false);
  };

  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        {/* 1. Left Panel: File Explorer */}
        <ResizablePanel
          defaultSize="20%"
          minSize="15%"
          maxSize="35%"
          id="panel-explorer"
        >
          <FileExplorer
            files={files}
            selectedFileId={selectedFileId}
            onSelectFile={handleSelectFile}
            onAddFile={handleAddFile}
            onRemoveFile={handleRemoveFile}
            onRenameFile={handleRenameFile}
            onImportPdf={() => setIsImportPdfOpen(true)}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 2. Center Panel: File Content Viewer & Editor */}
        <ResizablePanel
          defaultSize="52%"
          minSize="30%"
          id="panel-viewer"
        >
          <FileViewer
            activeFile={activeFile}
            openFiles={openFiles}
            onSelectFile={handleSelectFile}
            onCloseFile={handleCloseFile}
            onUpdateContent={handleUpdateContent}
            onImportPdf={() => setIsImportPdfOpen(true)}
            onSendToChat={handleAskAboutFile}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 3. Right Panel: Chatbot */}
        <ResizablePanel
          defaultSize="28%"
          minSize="20%"
          maxSize="45%"
          id="panel-chatbot"
        >
          <div className="flex h-full w-full flex-col bg-sidebar border-l border-border select-none">
            {/* Unified Minimal Chatbot Header */}
            <div className="flex h-10 items-center justify-between border-b border-border/60 bg-muted/15 px-3 select-none pr-12 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-foreground shrink-0">
                  AI Assistant
                </span>

                {/* Inline Minimal Context Chip */}
                {activeFile && (
                  <button
                    type="button"
                    onClick={() => setIncludeFileContext(!includeFileContext)}
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors border cursor-pointer max-w-40 truncate",
                      includeFileContext
                        ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
                        : "bg-muted/40 text-muted-foreground/60 border-border/40 line-through hover:text-muted-foreground"
                    )}
                    title={
                      includeFileContext
                        ? "Context attached to prompt. Click to exclude."
                        : "Click to include file context."
                    }
                  >
                    <FileCodeIcon className="size-3 shrink-0" />
                    <span className="truncate">{activeFile.name}</span>
                    {includeFileContext && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="rounded hover:bg-primary/20 p-0.5 ml-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIncludeFileContext(false);
                        }}
                      >
                        <XIcon className="size-2.5" />
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setIsClearChatOpen(true)}
                          aria-label="Clear chat"
                          className="size-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>Clear Chat</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <SparklesIcon className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    Ask About Your Code
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                    Ask questions, generate functions, or analyze files in your workspace.
                  </p>

                  {/* Suggested Prompts */}
                  {activeFile && (
                    <div className="mt-4 flex flex-col gap-1.5 w-full max-w-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 justify-start text-left truncate bg-muted/30"
                        onClick={() =>
                          sendMessage(`Explain what ${activeFile.name} does in detail.`)
                        }
                      >
                        Explain {activeFile.name}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 justify-start text-left truncate bg-muted/30"
                        onClick={() =>
                          sendMessage(`Suggest improvements or refactoring for ${activeFile.name}.`)
                        }
                      >
                        Refactor {activeFile.name}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 justify-start text-left truncate bg-muted/30"
                        onClick={() =>
                          sendMessage(`Write comprehensive unit tests for ${activeFile.name}.`)
                        }
                      >
                        Generate unit tests
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <MessagePattern messages={messages} className="flex-1" />
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t border-border/40 animate-pulse">
                  <Spinner className="size-3.5 text-primary" />
                  <span>AI assistant is thinking...</span>
                </div>
              )}
            </div>

            {/* Chat Prompt Input */}
            <div className="border-t border-border/60 bg-background/80 p-2.5">
              <PromptInputDemo
                onSubmitText={sendMessage}
                externalText={externalPrompt}
                className="py-0"
                placeholder={
                  activeFile && includeFileContext
                    ? `Ask about ${activeFile.name}...`
                    : "Ask the agent..."
                }
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Clear Chat Confirmation Alert Dialog */}
      <AlertDialog open={isClearChatOpen} onOpenChange={setIsClearChatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all current chat messages in this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsClearChatOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={clearChat}>
              Clear Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Import */}
      <ImportPdfDialog
        open={isImportPdfOpen}
        onOpenChange={setIsImportPdfOpen}
        onImport={handleImportPdf}
      />
    </div>
  );
}
