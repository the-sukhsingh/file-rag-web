"use client";

import * as React from "react";
import { MessageSquareIcon, MoreHorizontalIcon, SearchIcon, Trash2Icon, XIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { Conversation } from "@/lib/library/types";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function relativeTime(timestamp: number, now: number) {
  const diff = timestamp - now;
  const magnitude = Math.abs(diff);
  if (magnitude < 60_000) return "just now";
  if (magnitude < 3_600_000) return relativeFormat.format(Math.round(diff / 60_000), "minute");
  if (magnitude < 86_400_000) return relativeFormat.format(Math.round(diff / 3_600_000), "hour");
  if (magnitude < 7 * 86_400_000) return relativeFormat.format(Math.round(diff / 86_400_000), "day");
  return dateFormat.format(timestamp);
}

function startOfDay(value: number, offset = 0) {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - offset);
  return day.getTime();
}

function groupConversations(conversations: Conversation[], now: number) {
  const today = startOfDay(now);
  const yesterday = startOfDay(now, 1);
  const lastWeek = startOfDay(now, 7);
  const groups: { label: string; items: Conversation[] }[] = [];
  for (const conversation of conversations) {
    const label = conversation.updatedAt >= today ? "Today" : conversation.updatedAt >= yesterday ? "Yesterday" : conversation.updatedAt >= lastWeek ? "Previous 7 days" : "Earlier";
    const group = groups.at(-1);
    if (group?.label === label) group.items.push(conversation);
    else groups.push({ label, items: [conversation] });
  }
  return groups;
}

export function ChatHistory({ conversations, activeId, onSelect, onDelete, ready, disabled }: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  ready: boolean;
  disabled: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<Conversation | null>(null);
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const ticker = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(ticker);
    };
  }, []);
  const visible = conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.trim().toLowerCase()));
  const reference = now || visible[0]?.updatedAt || 0;
  const groups = reference ? groupConversations(visible, reference) : [];
  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-2.5 pt-2 pb-1">
        <h2 className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">Conversations</h2>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70" aria-label={`${conversations.length} conversations`}>{conversations.length}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={isSearchOpen ? "Close conversation search" : "Search conversations"}
          aria-expanded={isSearchOpen}
          onClick={() => isSearchOpen ? closeSearch() : setIsSearchOpen(true)}
          className="ml-auto size-7 text-muted-foreground hover:text-foreground"
        >
          {isSearchOpen ? <XIcon className="size-3.5" /> : <SearchIcon className="size-3.5" />}
        </Button>
      </div>
      {isSearchOpen && (
        <div className="relative mx-2.5 mb-1 shrink-0">
          <SearchIcon className="pointer-events-none absolute top-2 left-0 size-3.5 text-muted-foreground" />
          <input
            autoFocus
            aria-label="Search conversations"
            placeholder="Find a conversation…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-full border-b border-border bg-transparent pr-1 pl-6 text-[12px] outline-none placeholder:text-muted-foreground/80 focus:border-primary"
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!ready ? (
          <div role="status" className="flex items-center gap-2 px-2.5 py-6 text-xs text-muted-foreground"><Spinner className="size-3" /> Loading your conversations…</div>
        ) : conversations.length === 0 ? (
          <div className="px-2.5 pt-8 pb-6">
            <MessageSquareIcon className="mb-4 size-6 text-primary/60" strokeWidth={1.2} />
            <p className="text-[13px] font-medium">No conversations yet.</p>
            <p className="mt-1.5 max-w-52 text-[11px] leading-5 text-muted-foreground">Ask your first question. Your conversations will appear here.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-2.5 py-8 text-xs leading-5 text-muted-foreground">
            <p className="break-words">No conversations match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-primary underline underline-offset-4">Clear search</button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-medium tracking-[0.10em] text-muted-foreground/80 uppercase">{group.label}</h3>
                <ul>
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeId;
                    return (
                      <li key={conversation.id}>
                        <div className={cn("group flex h-9 items-center rounded-lg pr-1 transition-colors", active ? "bg-primary/8" : "hover:bg-accent/60")}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(conversation.id)}
                            aria-current={active ? "true" : undefined}
                            className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-border")} />
                            <span className={cn("min-w-0 flex-1 truncate text-[12px] font-medium", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>{conversation.title}</span>
                            <time
                              dateTime={new Date(conversation.updatedAt).toISOString()}
                              title={new Date(conversation.updatedAt).toLocaleString()}
                              className="max-w-[86px] shrink-0 truncate text-[10px] font-normal text-muted-foreground/80"
                            >
                              {relativeTime(conversation.updatedAt, reference)}
                            </time>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<button type="button" aria-label={`Manage conversation: ${conversation.title}`} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background hover:text-foreground"><MoreHorizontalIcon className="size-3.5" /></button>} />
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem variant="destructive" disabled={disabled} onClick={() => setPendingDelete(conversation)}><Trash2Icon /> Delete conversation</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      {disabled && ready && <p role="status" className="mx-2.5 shrink-0 border-t border-border/70 py-2.5 text-[10px] leading-4 text-muted-foreground">Finish the current upload or stop the response before switching or deleting a chat.</p>}
      <Dialog open={!!pendingDelete} onOpenChange={(next) => { if (!next) setPendingDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription className="break-words">“{pendingDelete?.title}” and its saved passages will be removed. Your uploaded files will stay in your library.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Keep conversation</Button>
            <Button variant="destructive" disabled={disabled} onClick={() => { if (pendingDelete) onDelete(pendingDelete.id); setPendingDelete(null); }}>Delete conversation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
