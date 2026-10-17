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
import { INITIAL_FILES } from "@/components/file-explorer/initial-files";
import { FileExplorer } from "@/components/file-explorer/file-explorer";
import { FileViewer } from "@/components/file-explorer/file-viewer";
import { MessagePattern } from "@/components/ai-elements/message-list";
import { PromptInputDemo } from "@/components/ai-elements/prompt-input";

export interface Message {
  role: "assistant" | "user";
  content: string;
}

export default function Home() {
  // File System State
  const [files, setFiles] = React.useState<VirtualFile[]>(INITIAL_FILES);
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>("file-page");
  const [openFileIds, setOpenFileIds] = React.useState<string[]>([
    "file-page",
    "file-rag",
  ]);

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

  const handleResetFiles = () => {
    setFiles(INITIAL_FILES);
    setSelectedFileId("file-page");
    setOpenFileIds(["file-page", "file-rag"]);
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
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: promptWithContext },
          ],
        }),
      });

      const data = await response.json();
      const reply = data.message || data.error || "No response received";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
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
            onResetFiles={handleResetFiles}
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
            onOpenNewFileDialog={() => {
              handleAddFile({
                name: "untitled.ts",
                path: "src/untitled.ts",
                content: "// New file\n",
                language: "typescript",
              });
            }}
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
            {/* Chatbot Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-3 py-2.5 bg-card/40 pr-12">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BotIcon className="size-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      AI Assistant
                    </span>
                    <Badge variant="outline" className="px-1 py-0 text-[9px] font-mono">
                      Groq
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setIsClearChatOpen(true)}
                        aria-label="Clear chat"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    } />
                    <TooltipContent>Clear Chat</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Active File Context Chip */}
            {activeFile && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/20 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-muted-foreground">Context:</span>
                  <div
                    onClick={() => setIncludeFileContext(!includeFileContext)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors max-w-44 truncate ${
                      includeFileContext
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground line-through"
                    }`}
                    title={
                      includeFileContext
                        ? "File content is included with your queries"
                        : "Click to include file context"
                    }
                  >
                    <FileCodeIcon className="size-3 shrink-0" />
                    <span className="truncate">{activeFile.name}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-4 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setIncludeFileContext(!includeFileContext)}
                  title={includeFileContext ? "Exclude context" : "Include context"}
                >
                  {includeFileContext ? (
                    <XIcon className="size-3" />
                  ) : (
                    <SparklesIcon className="size-3 text-primary" />
                  )}
                </Button>
              </div>
            )}

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
    </div>
  );
}
