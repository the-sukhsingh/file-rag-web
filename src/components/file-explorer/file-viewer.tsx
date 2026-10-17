"use client";

import * as React from "react";
import {
  FileCodeIcon,
  FileTextIcon,
  FileJsonIcon,
  FileIcon,
  CopyIcon,
  CheckIcon,
  SaveIcon,
  EyeIcon,
  Code2Icon,
  XIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import { VirtualFile } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
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
      return <FileCodeIcon className="size-4 text-blue-500 shrink-0" />;
    case "json":
      return <FileJsonIcon className="size-4 text-yellow-500 shrink-0" />;
    case "md":
    case "markdown":
    case "txt":
      return <FileTextIcon className="size-4 text-emerald-500 shrink-0" />;
    default:
      return <FileIcon className="size-4 text-muted-foreground shrink-0" />;
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
      <div className="flex h-full w-full items-center justify-center p-8 bg-background">
        <Empty className="max-w-md border border-dashed border-border/80 p-8 shadow-xs rounded-xl bg-card">
          <EmptyMedia variant="icon" className="size-12 rounded-xl bg-primary/10 text-primary">
            <FileCodeIcon className="size-6 text-primary" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-base font-semibold">No File Selected</EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground">
              Select a file from the explorer on the left or create a new file to preview and edit its content.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-2 flex flex-row gap-2">
            <Button size="sm" onClick={onOpenNewFileDialog} className="gap-1.5 text-xs">
              <PlusIcon className="size-3.5" />
              New File
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const lineCount = activeFile.content ? activeFile.content.split("\n").length : 0;
  const isDirty = isEditing && editValue !== activeFile.content;

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-hidden">
      {/* Open Files Tabs Bar */}
      {openFiles.length > 0 && (
        <div className="flex items-center overflow-x-auto border-b border-border bg-muted/30 px-2 pt-1 scrollbar-none">
          <div className="flex items-center gap-1">
            {openFiles.map((file) => {
              const isActive = file.id === activeFile.id;
              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file)}
                  className={`group flex items-center gap-2 rounded-t-md px-3 py-1.5 text-xs font-medium border-t border-x transition-colors cursor-pointer select-none ${
                    isActive
                      ? "bg-background text-foreground border-border shadow-xs"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {getFileIcon(file.name)}
                  <span className="truncate max-w-32">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-4 p-0 opacity-40 hover:opacity-100 hover:bg-muted rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseFile(file.id);
                    }}
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* File Action & Info Bar */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {getFileIcon(activeFile.name)}
          <span className="text-xs font-semibold text-foreground truncate">
            {activeFile.path}
          </span>
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase font-mono">
            {activeFile.language}
          </Badge>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          {isDirty && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] text-amber-500 bg-amber-500/10">
              Unsaved changes
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Ask AI about this file */}
          {onSendToChat && (
            <Tooltip>
              <TooltipTrigger render={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSendToChat(activeFile)}
                  className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                >
                  <SparklesIcon className="size-3.5 text-primary" />
                  <span className="hidden md:inline">Ask AI</span>
                </Button>
              } />
              <TooltipContent>Discuss this file with AI</TooltipContent>
            </Tooltip>
          )}

          {/* Toggle Edit Mode */}
          <Button
            variant={isEditing ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="h-7 text-xs gap-1"
          >
            {isEditing ? (
              <>
                <EyeIcon className="size-3.5" />
                <span>Preview</span>
              </>
            ) : (
              <>
                <Code2Icon className="size-3.5" />
                <span>Edit</span>
              </>
            )}
          </Button>

          {/* Save Button (when editing) */}
          {isEditing && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs gap-1 bg-primary text-primary-foreground"
            >
              <SaveIcon className="size-3.5" />
              <span>Save</span>
            </Button>
          )}

          {/* Copy Button */}
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                aria-label="Copy code"
                className="size-7"
              >
                {isCopied ? (
                  <CheckIcon className="size-3.5 text-emerald-500" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </Button>
            } />
            <TooltipContent>{isCopied ? "Copied!" : "Copy file content"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* File Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {isEditing ? (
          <div className="flex h-full w-full flex-col p-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Write your code or document content here..."
              className="flex-1 font-mono text-xs leading-relaxed p-4 resize-none rounded-lg bg-card focus-visible:ring-1 border-border/80"
              spellCheck={false}
            />
          </div>
        ) : (
          <ScrollArea className="h-full w-full">
            <div className="p-4">
              <CodeBlock variant="default" className="rounded-lg border border-border/80 shadow-xs bg-muted/20">
                <CodeBlockHeader className="border-b border-border/60 pb-2 bg-muted/30">
                  <CodeBlockTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {activeFile.name}
                  </CodeBlockTitle>
                  <CodeBlockActions>
                    <CodeBlockCopyButton value={activeFile.content} />
                  </CodeBlockActions>
                </CodeBlockHeader>
                <CodeBlockContent
                  lineNumbers
                  wrap
                  className="p-4 text-xs font-mono leading-relaxed bg-transparent"
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
