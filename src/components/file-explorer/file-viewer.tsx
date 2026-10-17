"use client";

import * as React from "react";
import Markdown from "react-markdown";
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
  BookOpenIcon,
  Code2Icon,
} from "lucide-react";

import { cn } from "cn";
import { VirtualFile } from "./types";
import { highlightCode } from "@/lib/highlighter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockLine,
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
  const [markdownView, setMarkdownView] = React.useState<"preview" | "code">("preview");
  const [highlightedLines, setHighlightedLines] = React.useState<React.ReactNode[][] | null>(null);

  const isMarkdown =
    activeFile?.language === "markdown" ||
    activeFile?.name.endsWith(".md") ||
    activeFile?.name.endsWith(".markdown");

  // Sync editValue and reset view modes when activeFile changes
  React.useEffect(() => {
    if (activeFile) {
      setEditValue(activeFile.content);
      setIsEditing(false);
      setMarkdownView("preview");
    }
  }, [activeFile?.id]);

  // Syntax highlighting effect via Shiki
  React.useEffect(() => {
    if (!activeFile) {
      setHighlightedLines(null);
      return;
    }

    let isMounted = true;
    highlightCode(activeFile.content, activeFile.language)
      .then((lines) => {
        if (isMounted) {
          setHighlightedLines(lines);
        }
      })
      .catch((err) => {
        console.error("Syntax highlight error:", err);
        if (isMounted) {
          setHighlightedLines(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeFile?.content, activeFile?.language]);

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

          {/* Markdown Preview / Code Mode Toggle */}
          {isMarkdown && !isEditing && (
            <div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setMarkdownView("preview")}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                  markdownView === "preview"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Rendered Markdown Preview"
              >
                <BookOpenIcon className="size-3" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setMarkdownView("code")}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                  markdownView === "code"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Syntax Highlighted Code"
              >
                <Code2Icon className="size-3" />
                <span>Code</span>
              </button>
            </div>
          )}

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

      {/* Code Preview / Editor Area */}
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
        ) : isMarkdown && markdownView === "preview" ? (
          <ScrollArea className="h-full w-full">
            <div className="max-w-3xl mx-auto p-6 md:p-8">
              <Markdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold tracking-tight mb-4 pb-2 border-b border-border/60 text-foreground">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold tracking-tight mt-6 mb-3 pb-1 border-b border-border/40 text-foreground">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold mt-5 mb-2 text-foreground">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-sm font-semibold mt-4 mb-1.5 text-foreground">
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p className="leading-7 mb-4 text-xs md:text-sm text-foreground/90 font-sans">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 mb-4 space-y-1.5 text-xs md:text-sm text-foreground/90 font-sans">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-xs md:text-sm text-foreground/90 font-sans">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="leading-6">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/40 pl-4 py-1 italic text-muted-foreground my-4 bg-muted/20 rounded-r">
                      {children}
                    </blockquote>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isMultiline = String(children).includes("\n");
                    if (!isMultiline) {
                      return (
                        <code
                          className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono font-medium text-foreground"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="p-3 my-3 bg-muted/40 rounded-lg overflow-x-auto text-xs font-mono border border-border/50">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4 rounded border border-border/60">
                      <table className="w-full text-xs text-left border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border-b border-border/60 bg-muted/50 px-3 py-2 font-semibold text-foreground">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-border/40 px-3 py-2 text-foreground/90">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="my-6 border-border/60" />,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-4 hover:opacity-80"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {activeFile.content}
              </Markdown>
            </div>
          </ScrollArea>
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
                  {highlightedLines ? (
                    highlightedLines.map((lineTokens, index) => (
                      <CodeBlockLine key={index}>
                        {lineTokens.length > 0 ? lineTokens : "\n"}
                      </CodeBlockLine>
                    ))
                  ) : (
                    activeFile.content
                  )}
                </CodeBlockContent>
              </CodeBlock>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
