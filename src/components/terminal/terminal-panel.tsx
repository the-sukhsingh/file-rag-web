"use client";

import * as React from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  Maximize2Icon,
  Minimize2Icon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  getTerminalCompletions,
  type AutocompleteSuggestion,
  type AutocompleteResult,
} from "@/lib/shell/terminal-autocomplete";
import type { ShellResult } from "@/lib/shell/workspace-shell";

export interface TerminalEntry {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timestamp: number;
}

export interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files: string[];
  passageCount: number;
  onRunCommand: (command: string) => Promise<ShellResult>;
  className?: string;
}

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 650;
const EXPANDED_HEIGHT = 500;

export function TerminalPanel({
  isOpen,
  onClose,
  files,
  passageCount,
  onRunCommand,
  className,
}: TerminalPanelProps) {
  const [height, setHeight] = React.useState(DEFAULT_HEIGHT);
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [entries, setEntries] = React.useState<TerminalEntry[]>([]);
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [isRunning, setIsRunning] = React.useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = React.useState<number>(-1);
  const [isSuggestionOpen, setIsSuggestionOpen] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const terminalBodyRef = React.useRef<HTMLDivElement>(null);
  const isDraggingRef = React.useRef(false);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(DEFAULT_HEIGHT);

  // Focus input when opened
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Auto scroll to bottom on new output or prompt changes
  React.useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [entries, input]);

  // Autocomplete calculation
  const cursorPosition = inputRef.current?.selectionStart ?? input.length;
  const autocomplete: AutocompleteResult = React.useMemo(() => {
    return getTerminalCompletions(input, cursorPosition, files, history);
  }, [input, cursorPosition, files, history]);

  // Keep suggestion index in bounds
  React.useEffect(() => {
    if (selectedSuggestionIndex >= autocomplete.suggestions.length) {
      setSelectedSuggestionIndex(autocomplete.suggestions.length - 1);
    }
  }, [autocomplete.suggestions.length, selectedSuggestionIndex]);

  // Handle resizing drag
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const delta = startYRef.current - e.clientY;
    const nextHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
    setHeight(nextHeight);
    setIsMaximized(false);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const applySuggestion = (suggestion: AutocompleteSuggestion) => {
    const { tokenStart, tokenEnd } = autocomplete;
    const prefix = input.slice(0, tokenStart);
    const suffix = input.slice(tokenEnd);
    const val = suggestion.value;
    const appendSpace = suggestion.type !== "directory";
    const nextInput = prefix + val + (appendSpace ? " " : "") + suffix;
    setInput(nextInput);
    setIsSuggestionOpen(false);
    setSelectedSuggestionIndex(-1);

    setTimeout(() => {
      if (inputRef.current) {
        const nextPos = tokenStart + val.length + (appendSpace ? 1 : 0);
        inputRef.current.focus();
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const executeCommand = async (cmdLine: string) => {
    const trimmed = cmdLine.trim();
    if (!trimmed) return;

    // Update history
    setHistory((prev) => {
      const next = prev.filter((cmd) => cmd !== trimmed);
      return [...next, trimmed];
    });
    setHistoryIndex(-1);
    setInput("");
    setIsSuggestionOpen(false);
    setSelectedSuggestionIndex(-1);

    // Built-in commands
    if (trimmed === "clear" || trimmed === "cls") {
      setEntries([]);
      return;
    }

    if (trimmed === "help") {
      const helpText = [
        "Quarry Virtual Bash commands:",
        "  grep [flags] <pattern> [path]   Search markdown passages for text",
        "  rg <pattern>                    Fast pattern search",
        "  cat <file>                      Read content of passage",
        "  ls [-la] [path]                 List directory contents",
        "  find [path] [-type f|d]         Find files or directories in hierarchy",
        "  head [-n N] <file>              Display first N lines",
        "  tail [-n N] <file>              Display last N lines",
        "  wc [-l|-w] <file>               Count lines or words",
        "  tree [path]                     View directory hierarchy tree",
        "  pwd                             Print current working directory",
        "  history                         Display previous command history",
        "  clear                           Clear terminal screen",
        "",
        "Shortcuts & Auto-Complete:",
        "  Tab / Right Arrow               Complete suggestion / accept ghost text",
        "  Up / Down                       Command history / suggestion menu",
        "  Ctrl + L                        Clear screen",
        "  Ctrl + ` (or Ctrl + J)          Toggle terminal dock",
      ].join("\n");

      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: helpText,
          stderr: "",
          exitCode: 0,
          durationMs: 1,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    if (trimmed === "history") {
      const historyList = history.map((cmd, idx) => `  ${idx + 1}  ${cmd}`).join("\n");
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: historyList || "  (no previous history)",
          stderr: "",
          exitCode: 0,
          durationMs: 1,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    setIsRunning(true);
    const start = Date.now();
    try {
      const res = await onRunCommand(trimmed);
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: res.stdout,
          stderr: res.stderr,
          exitCode: res.exitCode,
          durationMs: Date.now() - start,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: unknown) {
      setEntries((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: "",
          stderr: err instanceof Error ? err.message : String(err),
          exitCode: 1,
          durationMs: Date.now() - start,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+L: Clear screen
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setEntries([]);
      return;
    }

    // Ctrl+C: Cancel current line
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setInput("");
      setIsSuggestionOpen(false);
      return;
    }

    // Escape: Dismiss suggestions
    if (e.key === "Escape") {
      if (isSuggestionOpen) {
        e.preventDefault();
        setIsSuggestionOpen(false);
        setSelectedSuggestionIndex(-1);
      }
      return;
    }

    // Tab key
    if (e.key === "Tab") {
      e.preventDefault();
      if (autocomplete.suggestions.length === 1) {
        applySuggestion(autocomplete.suggestions[0]);
        return;
      }
      if (autocomplete.suggestions.length > 1) {
        if (!isSuggestionOpen) {
          setIsSuggestionOpen(true);
          setSelectedSuggestionIndex(0);
        } else {
          // Cycle to next
          const next = (selectedSuggestionIndex + 1) % autocomplete.suggestions.length;
          setSelectedSuggestionIndex(next);
        }
      }
      return;
    }

    // Arrow Right to accept ghost text or suggestion
    if (e.key === "ArrowRight") {
      const isAtEnd = inputRef.current?.selectionStart === input.length;
      if (isAtEnd && autocomplete.ghostText) {
        e.preventDefault();
        setInput((prev) => prev + autocomplete.ghostText);
        return;
      }
    }

    // Arrow Up / Down
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isSuggestionOpen && autocomplete.suggestions.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev <= 0 ? autocomplete.suggestions.length - 1 : prev - 1
        );
      } else if (history.length > 0) {
        // History back
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (isSuggestionOpen && autocomplete.suggestions.length > 0) {
        setSelectedSuggestionIndex((prev) =>
          prev >= autocomplete.suggestions.length - 1 ? 0 : prev + 1
        );
      } else if (historyIndex !== -1) {
        // History forward
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(nextIndex);
          setInput(history[nextIndex]);
        }
      }
      return;
    }

    // Enter key
    if (e.key === "Enter") {
      e.preventDefault();
      if (
        isSuggestionOpen &&
        selectedSuggestionIndex >= 0 &&
        autocomplete.suggestions[selectedSuggestionIndex]
      ) {
        applySuggestion(autocomplete.suggestions[selectedSuggestionIndex]);
      } else {
        void executeCommand(input);
      }
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.trim()) {
      setIsSuggestionOpen(true);
      setSelectedSuggestionIndex(0);
    } else {
      setIsSuggestionOpen(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  if (!isOpen) return null;

  const currentHeight = isMaximized ? EXPANDED_HEIGHT : height;

  return (
    <div
      className={cn(
        "relative flex flex-col w-full border-t border-border bg-card dark:bg-zinc-950 text-foreground dark:text-zinc-100 font-mono shadow-2xl transition-all duration-150 z-30 select-text",
        className
      )}
      style={{ height: `${currentHeight}px` }}
    >
      {/* Resize Drag Handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={() => setIsMaximized((prev) => !prev)}
        className="group absolute -top-1.5 inset-x-0 h-3 cursor-row-resize flex items-center justify-center z-40 touch-none"
        title="Drag to resize · Double click to maximize"
      >
        <div className="h-1 w-12 rounded-full bg-muted-foreground/30 group-hover:bg-primary transition-colors" />
      </div>

      {/* Terminal Title Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/80 bg-muted/60 dark:bg-zinc-900/90 px-3 text-xs select-none">
        <div className="flex items-center gap-2 text-foreground/80 dark:text-zinc-300">
          <TerminalIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-foreground dark:text-zinc-200">Terminal</span>
          <span className="rounded border border-border/60 bg-background/80 dark:bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-muted-foreground dark:text-zinc-400">
            quarry:/workspace
          </span>
          <span className="hidden sm:inline-block text-[11px] text-muted-foreground dark:text-zinc-500">
            ({passageCount} {passageCount === 1 ? "passage" : "passages"} mounted)
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Clear screen */}
          <button
            type="button"
            onClick={() => setEntries([])}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            title="Clear Terminal (Ctrl+L)"
            aria-label="Clear terminal output"
          >
            <Trash2Icon className="size-3.5" />
          </button>

          {/* Maximize / Restore */}
          <button
            type="button"
            onClick={() => setIsMaximized((prev) => !prev)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            title={isMaximized ? "Restore Height" : "Maximize Terminal"}
            aria-label="Toggle maximize terminal"
          >
            {isMaximized ? (
              <Minimize2Icon className="size-3.5" />
            ) : (
              <Maximize2Icon className="size-3.5" />
            )}
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive dark:text-zinc-400 dark:hover:bg-red-950/60 dark:hover:text-red-300 transition-colors"
            title="Close Terminal (Ctrl+`)"
            aria-label="Close terminal"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content / Scrollable Area */}
      <div
        ref={terminalBodyRef}
        onClick={() => inputRef.current?.focus()}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 font-mono text-xs sm:text-[13px] leading-relaxed cursor-text space-y-2 select-text"
      >
        {/* Welcome message */}
        {entries.length === 0 && (
          <div className="text-muted-foreground dark:text-zinc-400 space-y-1 mb-3 text-[11px] sm:text-xs border-b border-border/40 dark:border-zinc-900 pb-2.5">
            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
              Quarry Virtual Workspace Bash [just-bash/browser]
            </div>
            <div>
              Connected to virtual filesystem at{" "}
              <span className="text-foreground dark:text-zinc-300 font-medium">/workspace</span> with{" "}
              {passageCount} passages.
            </div>
            <div className="text-muted-foreground/80 dark:text-zinc-500">
              Type <span className="text-emerald-600 dark:text-emerald-300 font-medium">help</span> for commands, or try{" "}
              <span className="text-foreground/90 dark:text-zinc-300">ls -la</span>,{" "}
              <span className="text-foreground/90 dark:text-zinc-300">grep -rni &quot;text&quot; .</span>,{" "}
              <span className="text-foreground/90 dark:text-zinc-300">find /workspace -type f</span>.
            </div>
          </div>
        )}

        {/* History Entries */}
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-foreground/80 dark:text-zinc-300">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                quarry:/workspace$
              </span>
              <span className="font-mono text-foreground dark:text-zinc-100 font-medium">
                {entry.command}
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground dark:text-zinc-500">
                {entry.exitCode === 0 ? (
                  <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span className="flex items-center gap-0.5 text-destructive">
                    <AlertCircleIcon className="size-3" />
                    exit {entry.exitCode}
                  </span>
                )}
                <span>{entry.durationMs}ms</span>
              </span>
            </div>

            {/* stdout */}
            {entry.stdout && (
              <pre className="whitespace-pre-wrap break-all text-foreground/90 dark:text-zinc-200 font-mono text-[11px] sm:text-xs pl-2.5 border-l-2 border-border/70 dark:border-zinc-800">
                {entry.stdout}
              </pre>
            )}

            {/* stderr */}
            {entry.stderr && (
              <pre className="whitespace-pre-wrap break-all text-destructive font-mono text-[11px] sm:text-xs pl-2.5 border-l-2 border-destructive/50">
                {entry.stderr}
              </pre>
            )}
          </div>
        ))}

        {/* Active Command Line Input */}
        <div className="relative pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 select-none">
              quarry:/workspace$
            </span>

            <div className="relative flex-1 flex items-center">
              {/* Ghost suggestion overlay behind input */}
              {autocomplete.ghostText && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center font-mono text-xs sm:text-[13px] text-muted-foreground/50 dark:text-zinc-500/70 select-none overflow-hidden"
                >
                  <span className="invisible whitespace-pre">{input}</span>
                  <span className="whitespace-pre">{autocomplete.ghostText}</span>
                </div>
              )}

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isRunning}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full bg-transparent border-0 outline-none p-0 m-0 font-mono text-xs sm:text-[13px] text-foreground dark:text-zinc-100 placeholder:text-muted-foreground/60 dark:placeholder:text-zinc-600 focus:ring-0 focus:outline-none"
                placeholder={
                  isRunning
                    ? "Running command..."
                    : "Type command, 'help', or press Tab to auto-complete…"
                }
              />
            </div>

            {/* Ghost text pill indicator */}
            {autocomplete.ghostText && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 dark:bg-zinc-900 border border-border dark:border-zinc-800 px-1.5 py-0.5 rounded select-none">
                <span>Tab / →</span>
                <span className="text-foreground/80 dark:text-zinc-400 font-medium">accept</span>
              </span>
            )}
          </div>

          {/* Autocomplete Suggestions Menu */}
          {isSuggestionOpen && autocomplete.suggestions.length > 0 && (
            <div
              className="absolute bottom-full mb-1.5 left-4 max-w-md w-full max-h-56 overflow-y-auto rounded-xl border border-border/80 bg-popover/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl p-1 z-50 text-xs [scrollbar-width:thin]"
              role="listbox"
              aria-label="Shell completions"
            >
              {/* Header */}
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/80 tracking-wider flex items-center justify-between border-b border-border/40 dark:border-zinc-800/60 pb-1 mb-0.5 select-none">
                <span className="uppercase">Suggestions ({autocomplete.suggestions.length})</span>
                <span className="lowercase font-normal text-muted-foreground/60">
                  ↑↓ navigate · Tab/Enter complete
                </span>
              </div>

              {/* Items */}
              <div className="space-y-0.5">
                {autocomplete.suggestions.map((suggestion, idx) => {
                  const isSelected = idx === selectedSuggestionIndex;
                  return (
                    <button
                      key={`${suggestion.type}-${suggestion.value}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(suggestion);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-left font-mono transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary dark:bg-emerald-500/20 dark:text-emerald-300 font-medium"
                          : "text-foreground/80 dark:text-zinc-300 hover:bg-muted/60 dark:hover:bg-zinc-800/80 hover:text-foreground dark:hover:text-zinc-100"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {/* Subtle semantic icon instead of heavy block badge */}
                        {suggestion.type === "directory" && (
                          <FolderIcon className="size-3.5 text-amber-500/90 dark:text-amber-400 shrink-0" />
                        )}
                        {suggestion.type === "file" && (
                          <FileTextIcon className="size-3.5 text-blue-500/90 dark:text-blue-400 shrink-0" />
                        )}
                        {suggestion.type === "command" && (
                          <TerminalIcon className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        )}
                        {suggestion.type === "flag" && (
                          <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold shrink-0">
                            --
                          </span>
                        )}
                        {suggestion.type === "history" && (
                          <HistoryIcon className="size-3.5 text-muted-foreground shrink-0" />
                        )}

                        <span className="truncate">{suggestion.display || suggestion.value}</span>
                      </div>

                      {suggestion.description && (
                        <span className="text-[10px] text-muted-foreground/70 dark:text-zinc-500 shrink-0 truncate max-w-[170px]">
                          {suggestion.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
