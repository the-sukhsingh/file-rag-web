"use client";

import * as React from "react";
import {
  AlignLeftIcon,
  ArrowUpIcon,
  AtSignIcon,
  FileTextIcon,
  FolderIcon,
  GitCompareArrowsIcon,
  LightbulbIcon,
  ListTreeIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  SquareIcon,
  TerminalIcon,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { AGENT_COMMANDS, type AgentCommand } from "@/lib/chat/commands";
import type { DocumentRecord, FileGroup } from "@/lib/library/types";

const COMMAND_ICONS: Record<string, React.ElementType> = {
  summarize: AlignLeftIcon,
  takeaways: LightbulbIcon,
  compare: GitCompareArrowsIcon,
  explain: SparklesIcon,
  find: SearchIcon,
  quiz: SparklesIcon,
  outline: ListTreeIcon,
};

type AutocompleteState =
  | { type: "command"; query: string; startPos: number; endPos: number }
  | { type: "mention"; query: string; startPos: number; endPos: number }
  | null;

export function PromptBox({
  onSubmit,
  onStop,
  isBusy,
  placeholder = "Ask anything about your files…",
  disabled,
  children,
  className,
  showHint = true,
  onAttach,
  attachDisabled,
  availableDocuments = [],
  availableGroups = [],
  onMentionSelect,
}: {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isBusy?: boolean;
  placeholder?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  showHint?: boolean;
  onAttach?: () => void;
  attachDisabled?: boolean;
  availableDocuments?: DocumentRecord[];
  availableGroups?: FileGroup[];
  onMentionSelect?: (target: { type: "file" | "group"; id: string }) => void;
}) {
  const [text, setText] = React.useState("");
  const [menuState, setMenuState] = React.useState<AutocompleteState>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const menuListRef = React.useRef<HTMLUListElement>(null);

  const canSend = text.trim().length > 0 && !disabled && !isBusy;

  // Filter commands
  const filteredCommands = React.useMemo(() => {
    if (!menuState || menuState.type !== "command") return [];
    const q = menuState.query;
    return AGENT_COMMANDS.filter((cmd) => {
      if (!q) return true;
      if (cmd.command.includes(q)) return true;
      if (cmd.aliases?.some((a) => a.includes(q))) return true;
      if (cmd.description.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [menuState]);

  // Filter mentions (files and groups)
  const filteredMentions = React.useMemo(() => {
    if (!menuState || menuState.type !== "mention") return [];
    const q = menuState.query;
    const items: Array<
      | { kind: "file"; doc: DocumentRecord; label: string; meta: string }
      | { kind: "group"; group: FileGroup; label: string; meta: string }
    > = [];

    // Add matching files
    for (const doc of availableDocuments) {
      if (!q || doc.fileName.toLowerCase().includes(q)) {
        items.push({
          kind: "file",
          doc,
          label: doc.fileName,
          meta: `${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`,
        });
      }
    }

    // Add matching groups
    for (const group of availableGroups) {
      if (!q || group.name.toLowerCase().includes(q)) {
        const count = availableDocuments.filter((d) => d.groupId === group.id).length;
        items.push({
          kind: "group",
          group,
          label: group.name,
          meta: `Group · ${count} ${count === 1 ? "file" : "files"}`,
        });
      }
    }

    return items;
  }, [menuState, availableDocuments, availableGroups]);

  const activeCount =
    menuState?.type === "command"
      ? filteredCommands.length
      : menuState?.type === "mention"
        ? filteredMentions.length
        : 0;

  // Keep selected index within bounds
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [menuState?.type, menuState?.query]);

  // Scroll active item into view
  React.useEffect(() => {
    if (!menuListRef.current) return;
    const activeEl = menuListRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const checkAutocomplete = (val: string, cursor: number) => {
    const textBeforeCursor = val.slice(0, cursor);

    // 1. Check for command at start of input
    const slashMatch = textBeforeCursor.match(/^\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setMenuState({
        type: "command",
        query: slashMatch[1].toLowerCase(),
        startPos: 0,
        endPos: cursor,
      });
      return;
    }

    // 2. Check for @ mention anywhere
    const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const startPos = textBeforeCursor.length - mentionMatch[0].length;
      setMenuState({
        type: "mention",
        query,
        startPos,
        endPos: cursor,
      });
      return;
    }

    setMenuState(null);
  };

  const insertCompletion = (insertedText: string) => {
    if (!menuState) return;
    const before = text.slice(0, menuState.startPos);
    const after = text.slice(menuState.endPos);
    const nextText = `${before}${insertedText} ${after}`;
    setText(nextText);
    setMenuState(null);

    // Reposition cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const nextCursor = before.length + insertedText.length + 1;
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 10);
  };

  const handleSelectCommand = (cmd: AgentCommand) => {
    insertCompletion(`/${cmd.command}`);
  };

  const handleSelectMention = (
    item:
      | { kind: "file"; doc: DocumentRecord; label: string }
      | { kind: "group"; group: FileGroup; label: string }
  ) => {
    if (item.kind === "file") {
      const token = item.doc.fileName.includes(" ")
        ? `@"${item.doc.fileName}"`
        : `@${item.doc.fileName}`;
      insertCompletion(token);
      onMentionSelect?.({ type: "file", id: item.doc.id });
    } else {
      const token = item.group.name.includes(" ")
        ? `@"${item.group.name}"`
        : `@${item.group.name}`;
      insertCompletion(token);
      onMentionSelect?.({ type: "group", id: item.group.id });
    }
  };

  const handleTriggerCommand = () => {
    if (disabled || isBusy) return;
    if (text.startsWith("/")) {
      textareaRef.current?.focus();
      return;
    }
    const nextText = text ? `/${text.replace(/^\/+/, "")}` : "/";
    setText(nextText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextText.length, nextText.length);
        checkAutocomplete(nextText, nextText.length);
      }
    }, 10);
  };

  const handleTriggerMention = () => {
    if (disabled || isBusy) return;
    const nextText = text ? `${text.trimEnd()} @` : "@";
    setText(nextText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextText.length, nextText.length);
        checkAutocomplete(nextText, nextText.length);
      }
    }, 10);
  };

  function submit() {
    if (!canSend) return;
    setMenuState(null);
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div className={cn("relative shrink-0", className ?? "px-4 pt-3 pb-4 sm:px-8 sm:pb-6")}>
      <div className="relative mx-auto w-full max-w-[760px]">
        {/* Autocomplete Popup */}
        {menuState && activeCount > 0 && (
          <div className="animate-in fade-in-0 zoom-in-95 absolute bottom-[calc(100%+8px)] left-0 z-30 max-h-72 w-full max-w-md overflow-hidden rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
              {menuState.type === "command" ? (
                <>
                  <TerminalIcon className="size-3 text-primary" />
                  <span>Agent Commands</span>
                  <span className="ml-auto font-mono text-[9px]">Tab or ↵ to select</span>
                </>
              ) : (
                <>
                  <AtSignIcon className="size-3 text-primary" />
                  <span>Mention File or Group</span>
                  <span className="ml-auto font-mono text-[9px]">Tab or ↵ to select</span>
                </>
              )}
            </div>

            <ul ref={menuListRef} className="max-h-60 overflow-y-auto p-1 space-y-0.5">
              {menuState.type === "command"
                ? filteredCommands.map((cmd, index) => {
                    const isSelected = index === selectedIndex;
                    const Icon = COMMAND_ICONS[cmd.command] ?? TerminalIcon;
                    return (
                      <li key={cmd.command}>
                        <button
                          type="button"
                          onClick={() => handleSelectCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <Icon className="size-3.5 shrink-0 text-primary" />
                          <span className="font-mono text-[12px] text-primary">/{cmd.command}</span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                            {cmd.description}
                          </span>
                        </button>
                      </li>
                    );
                  })
                : filteredMentions.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <li key={`${item.kind}-${item.label}`}>
                        <button
                          type="button"
                          onClick={() => handleSelectMention(item)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                            isSelected
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          {item.kind === "file" ? (
                            <FileTextIcon className="size-3.5 shrink-0 text-primary/80" />
                          ) : (
                            <FolderIcon className="size-3.5 shrink-0 text-primary" />
                          )}
                          <span className="truncate text-[12px]">{item.label}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                            {item.meta}
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
          </div>
        )}

        <div
          className={cn(
            "rounded-[22px] border bg-card shadow-[0_8px_30px_-24px_#263b2966] transition-[border-color,box-shadow]",
            disabled
              ? "border-border"
              : "border-input focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_7%,transparent)]"
          )}
        >
          <textarea
            ref={textareaRef}
            data-prompt-textarea
            aria-label="Ask a question about your files"
            value={text}
            rows={2}
            disabled={disabled}
            onChange={(event) => {
              const val = event.target.value;
              setText(val);
              checkAutocomplete(val, event.target.selectionStart ?? val.length);
            }}
            onClick={(event) => {
              checkAutocomplete(text, event.currentTarget.selectionStart ?? text.length);
            }}
            onKeyDown={(event) => {
              if (menuState && activeCount > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedIndex((prev) => (prev + 1) % activeCount);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedIndex((prev) => (prev - 1 + activeCount) % activeCount);
                  return;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  if (menuState.type === "command") {
                    const cmd = filteredCommands[selectedIndex];
                    if (cmd) handleSelectCommand(cmd);
                  } else {
                    const mention = filteredMentions[selectedIndex];
                    if (mention) handleSelectMention(mention);
                  }
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setMenuState(null);
                  return;
                }
              }

              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="field-sizing-content block max-h-40 min-h-16 w-full resize-none bg-transparent px-4 pt-4 pb-1 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed sm:text-[15px]"
          />

          <div className="flex items-center gap-1 px-2.5 pb-2.5">
            {onAttach && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onAttach}
                disabled={attachDisabled}
                aria-label="Add PDF files"
                title="Add PDF files"
                className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <PlusIcon className="size-4" />
              </Button>
            )}

            {/* Quick @ mention trigger button */}
            <button
              type="button"
              disabled={disabled || isBusy}
              onClick={handleTriggerMention}
              title="Target file or group (@)"
              aria-label="Mention file or group"
              className="flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              @
            </button>

            {/* Quick / command trigger button */}
            <button
              type="button"
              disabled={disabled || isBusy}
              onClick={handleTriggerCommand}
              title="Agent commands (/)"
              aria-label="Trigger slash command"
              className="flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-medium text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              /
            </button>

            {children && (
              <div className="flex min-w-0 flex-1 items-center px-1 text-[11px] text-muted-foreground">
                {children}
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center">
              {isBusy ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={onStop}
                  aria-label="Stop response"
                  className="size-9 rounded-full"
                >
                  <SquareIcon className="size-3 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="size-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                >
                  <ArrowUpIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {showHint && (
          <p className="mt-2.5 text-center text-[10px] leading-4 text-muted-foreground">
            {isBusy ? (
              "Finding answers in your files…"
            ) : (
              <span>
                Use <span className="font-mono text-primary/80">/</span> for agent commands and{" "}
                <span className="font-mono text-primary/80">@</span> to target specific files.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
