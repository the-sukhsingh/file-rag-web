"use client";

import * as React from "react";
import {
  FileCodeIcon,
  FileTextIcon,
  FileJsonIcon,
  FileIcon,
  CopyIcon,
  CheckIcon,
  EyeIcon,
  PencilIcon,
  XIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import { cn } from "cn";
import { VirtualFile } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CodeBlock,
  CodeBlockContent,
} from "@/components/ui/code-block";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FileViewerProps {
  activeFile: VirtualFile | null;
  openFiles: VirtualFile[];
  onSelectFile: (file: VirtualFile) => void;
  onCloseFile: (fileId: string) => void;
  onUpdateContent: (fileId: string, content: string) => void;
  onOpenNewFileDialog: () => void;
  onSendToChat?: (file: VirtualFile) => void;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCodeIcon className="size-3.5 text-blue-500 shrink-0" />;
    case "json":
      return <FileJsonIcon className="size-3.5 text-yellow-500 shrink-0" />;
    case "md":
    case "markdown":
    case "txt":
      return <FileTextIcon className="size-3.5 text-emerald-500 shrink-0" />;
    default:
      return <FileIcon className="size-3.5 text-muted-foreground shrink-0" />;
  }
}

export function FileViewer({
  activeFile,
  openFiles,
  onSelectFile,
  onCloseFile,
  onUpdateContent,
  onOpenNewFileDialog,
  onSendToChat,
}: FileViewerProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const [isCopied, setIsCopied] = React.useState(false);

  // Sync editValue when activeFile changes
  React.useEffect(() => {
    if (activeFile) {
      setEditValue(activeFile.content);
      setIsEditing(false);
    }
  }, [activeFile?.id, activeFile?.content]);

  const handleSave = () => {
    if (!activeFile) return;
    onUpdateContent(activeFile.id, editValue);
    setIsEditing(false);
  };

  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(isEditing ? editValue : activeFile.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!activeFile) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-background select-none">
        <div className="flex flex-col items-center justify-center text-center max-w-sm">
          <div className="size-10 rounded-xl bg-muted/40 flex items-center justify-center mb-3 text-muted-foreground/60">
            <FileCodeIcon className="size-5" />
          </div>
          <p className="text-sm font-medium text-foreground">No file selected</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a file from the explorer on the left to preview or edit.
          </p>
          {onOpenNewFileDialog && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenNewFileDialog}
              className="mt-4 gap-1.5 text-xs h-7"
            >
              <PlusIcon className="size-3.5" />
              New File
            </Button>
          )}
        </div>
      </div>
    );
  }

  const lineCount = activeFile.content ? activeFile.content.split("\n").length : 0;
  const isDirty = isEditing && editValue !== activeFile.content;

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-hidden">
      {/* Sleek unified Tab and Action Bar */}
      <div className="flex h-10 w-full items-center justify-between border-b border-border/60 bg-muted/15 px-2 select-none shrink-0">
        {/* Left: Open File Tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {openFiles.map((file) => {
            const isActive = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => onSelectFile(file)}
                className={cn(
                  "group relative flex h-8 items-center gap-2 rounded-t-md px-2.5 text-xs font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-background text-foreground shadow-2xs font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {getFileIcon(file.name)}
                <span className="truncate max-w-36">{file.name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onCloseFile(file.id);
                    }
                  }}
                >
                  <XIcon className="size-3" />
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Minimal Actions & File Meta */}
        <div className="flex items-center gap-1.5 pl-2 shrink-0">
          <span className="text-[11px] font-mono text-muted-foreground/60 uppercase hidden sm:inline">
            {activeFile.language}
          </span>
          <span className="text-muted-foreground/30 hidden sm:inline">•</span>
          <span className="text-[11px] font-mono text-muted-foreground/60 hidden sm:inline">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>

          {isDirty && (
            <span className="size-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
          )}

          <div className="h-3.5 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Ask AI */}
          {onSendToChat && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onSendToChat(activeFile)}
                    aria-label="Ask AI about this file"
                    className="size-7 text-muted-foreground hover:text-primary"
                  >
                    <SparklesIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Ask AI about this file</TooltipContent>
            </Tooltip>
          )}

          {/* Edit / Preview Toggle */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={isEditing ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => setIsEditing(!isEditing)}
                  aria-label={isEditing ? "Preview Mode" : "Edit File"}
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  {isEditing ? (
                    <EyeIcon className="size-3.5" />
                  ) : (
                    <PencilIcon className="size-3.5" />
                  )}
                </Button>
              }
            />
            <TooltipContent>{isEditing ? "Switch to Preview" : "Edit File"}</TooltipContent>
          </Tooltip>

          {/* Save Button if editing */}
          {isEditing && (
            <Button
              variant="default"
              size="xs"
              onClick={handleSave}
              className="h-6 text-xs px-2 gap-1 bg-primary text-primary-foreground"
            >
              <CheckIcon className="size-3" />
              <span>Save</span>
            </Button>
          )}

          {/* Copy Button */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={handleCopy}
                  aria-label="Copy file content"
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  {isCopied ? (
                    <CheckIcon className="size-3.5 text-emerald-500" />
                  ) : (
                    <CopyIcon className="size-3.5" />
                  )}
                </Button>
              }
            />
            <TooltipContent>{isCopied ? "Copied!" : "Copy code"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Code Preview / Editor Area - Clean & Minimal */}
      <div className="flex-1 overflow-hidden relative bg-background">
        {isEditing ? (
          <div className="h-full w-full">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Write your code or document content here..."
              className="h-full w-full font-mono text-xs leading-relaxed p-4 resize-none border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:outline-none"
              spellCheck={false}
            />
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <div className="min-h-full py-2">
              <CodeBlock
                variant="default"
                className="border-0 rounded-none bg-transparent shadow-none"
              >
                <CodeBlockContent
                  lineNumbers
                  wrap
                  className="px-4 py-2 text-xs font-mono leading-relaxed bg-transparent"
                >
                  {activeFile.content}
                </CodeBlockContent>
              </CodeBlock>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
