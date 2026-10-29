"use client";

import * as React from "react";
import {
  CommandIcon,
  FolderIcon,
  KeyboardIcon,
  LayoutIcon,
  MessageSquareIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isMac } from "@/lib/hooks/use-keyboard-shortcuts";

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/80 bg-background/80 px-1.5 font-mono text-[10.5px] font-medium text-foreground/80 shadow-[0_1px_1.5px_rgba(0,0,0,0.08)] dark:bg-muted/30 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] select-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}

interface ShortcutItem {
  label: string;
  keys: string[];
  altKeys?: string[];
  hint?: string;
}

interface ShortcutCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcuts: ShortcutItem[];
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mac, setMac] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<string>("all");

  React.useEffect(() => {
    setMac(isMac());
  }, []);

  // Reset search when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveCategory("all");
    }
  }, [open]);

  const mod = mac ? "⌘" : "Ctrl";
  const alt = mac ? "⌥" : "Alt";
  const shift = mac ? "⇧" : "Shift";

  const categories: ShortcutCategory[] = [
    {
      id: "workspace",
      name: "Workspace & Layout",
      icon: LayoutIcon,
      shortcuts: [
        { label: "Toggle sidebar", keys: [mod, "B"] },
        { label: "Toggle bottom terminal", keys: [mod, "`"], altKeys: [mod, "J"] },
        { label: "Toggle theme", keys: ["D"], altKeys: [mod, shift, "D"] },
        { label: "Switch Files / Chats view", keys: [mod, shift, "S"] },
      ],
    },
    {
      id: "chat",
      name: "Chat & Prompting",
      icon: MessageSquareIcon,
      shortcuts: [
        { label: "Focus prompt box", keys: [mod, "K"], altKeys: ["/"] },
        { label: "New conversation", keys: [mod, "N"], altKeys: ["C"] },
        { label: "Send prompt", keys: ["Enter"] },
        { label: "New line in prompt", keys: [shift, "Enter"] },
      ],
    },
    {
      id: "terminal",
      name: "Terminal",
      icon: TerminalIcon,
      shortcuts: [
        { label: "Accept ghost suggestion", keys: ["→"], altKeys: ["Tab"] },
        { label: "Open / cycle suggestions", keys: ["Tab"] },
        { label: "Command history / navigate", keys: ["↑", "↓"] },
        { label: "Clear terminal screen", keys: [mod, "L"] },
        { label: "Cancel current input", keys: [mod, "C"] },
      ],
    },
    {
      id: "tools",
      name: "Agent & Tools",
      icon: SlidersHorizontalIcon,
      shortcuts: [
        { label: "Slash commands menu", keys: ["/"], hint: "in prompt" },
        { label: "Mention file or group", keys: ["@"], hint: "in prompt" },
        { label: "Open settings", keys: [mod, ","] },
        { label: "Keyboard shortcuts cheat sheet", keys: ["?"] },
      ],
    },
  ];

  // Filtering logic
  const filteredCategories = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((cat) => activeCategory === "all" || cat.id === activeCategory)
      .map((cat) => {
        if (!q) return cat;
        const matchingShortcuts = cat.shortcuts.filter((s) => {
          return (
            s.label.toLowerCase().includes(q) ||
            s.keys.some((k) => k.toLowerCase().includes(q)) ||
            (s.altKeys && s.altKeys.some((k) => k.toLowerCase().includes(q))) ||
            (s.hint && s.hint.toLowerCase().includes(q))
          );
        });
        return { ...cat, shortcuts: matchingShortcuts };
      })
      .filter((cat) => cat.shortcuts.length > 0);
  }, [categories, query, activeCategory]);

  const totalMatches = filteredCategories.reduce((acc, cat) => acc + cat.shortcuts.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[620px] p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-card">
        {/* Header */}
        <div className="flex flex-col border-b border-border/60 bg-muted/20 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyboardIcon className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold leading-tight text-foreground">
                  Keyboard shortcuts
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Fast keys to navigate your files, chat, and terminal.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-3.5">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="w-full h-8 pl-8 pr-8 rounded-lg border border-border/60 bg-background/90 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/50">
                Esc
              </span>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0",
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <cat.icon className="size-3 shrink-0" />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="max-h-[380px] overflow-y-auto p-4 sm:p-5 space-y-4">
          {filteredCategories.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <p>No shortcuts match &quot;{query}&quot;</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveCategory("all");
                }}
                className="mt-2 text-primary underline underline-offset-4"
              >
                Clear filter
              </button>
            </div>
          ) : (
            filteredCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground tracking-wide uppercase px-1">
                    <Icon className="size-3 text-primary/70" />
                    <span>{cat.name}</span>
                    <span className="ml-auto text-[10px] lowercase tracking-normal text-muted-foreground/60 font-mono">
                      {cat.shortcuts.length}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/30 overflow-hidden">
                    {cat.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.label}
                        className="flex items-center justify-between px-3.5 py-2 text-xs transition-colors hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-foreground/90 font-medium text-[12px]">
                            {shortcut.label}
                          </span>
                          {shortcut.hint && (
                            <span className="text-[10px] text-muted-foreground/70 italic">
                              ({shortcut.hint})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Primary keys */}
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((k, idx) => (
                              <React.Fragment key={k}>
                                <Kbd>{k}</Kbd>
                                {idx < shortcut.keys.length - 1 && (
                                  <span className="text-[10px] text-muted-foreground/40 font-mono">
                                    +
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {/* Alternate keys */}
                          {shortcut.altKeys && (
                            <>
                              <span className="text-[10px] text-muted-foreground/40">or</span>
                              <div className="flex items-center gap-1">
                                {shortcut.altKeys.map((k, idx) => (
                                  <React.Fragment key={k}>
                                    <Kbd>{k}</Kbd>
                                    {idx < shortcut.altKeys!.length - 1 && (
                                      <span className="text-[10px] text-muted-foreground/40 font-mono">
                                        +
                                      </span>
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-5 py-2.5 text-[11px] text-muted-foreground select-none">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <Kbd>?</Kbd>
            <span>anytime to toggle shortcuts</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span>{totalMatches} available</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
