"use client";

import * as React from "react";
import { MessageSquareIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { Conversation } from "@/lib/library/types";

export function ChatHistory({ conversations, activeId, onSelect, onNewChat, onDelete, ready, disabled }: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  ready: boolean;
  disabled: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<Conversation | null>(null);
  const visible = conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-5 pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display-face text-[23px]">Your chats</h2>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground" aria-label={`${conversations.length} conversations`}>{conversations.length.toString().padStart(2, "0")}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Pick up where you left off.</p>
        <Button onClick={onNewChat} disabled={disabled || !ready} className="mt-5 h-10 w-full justify-start gap-2.5 rounded-lg px-3.5 text-[12px]"><PlusIcon className="size-3.5" /> New chat</Button>
      </div>
      {conversations.length > 0 && (
        <div className="relative mx-5 shrink-0">
          <SearchIcon className="pointer-events-none absolute top-3 left-0 size-3.5 text-muted-foreground" />
          <input aria-label="Search conversations" placeholder="Find a conversation…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full border-b border-border bg-transparent pl-6 text-[12px] outline-none focus:border-primary" />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
        {!ready ? (
          <div role="status" className="flex items-center gap-2 py-6 text-xs text-muted-foreground"><Spinner className="size-3" /> Loading your conversations…</div>
        ) : conversations.length === 0 ? (
          <div className="border-t border-border pt-10 pb-6">
            <MessageSquareIcon className="mb-5 size-7 text-primary/60" strokeWidth={1.2} />
            <p className="display-face text-[18px]">A fresh start.</p>
            <p className="mt-2 max-w-48 text-[11px] leading-5 text-muted-foreground">Ask your first question. Your conversations will appear here.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-xs leading-5 text-muted-foreground">
            <p className="break-words">No conversations match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-primary underline underline-offset-4">Clear search</button>
          </div>
        ) : (
          <ul className="divide-y divide-border/70" aria-label="Saved conversations">
            {visible.map((conversation) => (
              <li key={conversation.id} className={cn("group relative -mx-2 flex items-start gap-1 py-1 pr-1 pl-2 transition-colors hover:bg-accent/40", conversation.id === activeId && "bg-primary/5 before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary/60")}>
                <button type="button" disabled={disabled} onClick={() => onSelect(conversation.id)} aria-current={conversation.id === activeId ? "true" : undefined} className="min-w-0 flex-1 rounded-sm py-3 text-left disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="line-clamp-2 text-[12px] leading-5 font-medium [overflow-wrap:anywhere]">{conversation.title}</span>
                  <span className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground">
                    <time dateTime={new Date(conversation.updatedAt).toISOString()}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(conversation.updatedAt)}</time>
                    <span aria-hidden="true">·</span><span>{conversation.messages.length} messages</span>
                  </span>
                </button>
                <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Delete conversation: ${conversation.title}`} onClick={() => setPendingDelete(conversation)} className="mt-2 size-8 shrink-0 text-muted-foreground hover:text-destructive"><Trash2Icon className="size-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {disabled && ready && <p role="status" className="mx-5 border-t border-border py-3 text-[11px] leading-5 text-muted-foreground">Finish the current upload or stop the response before switching or deleting a chat.</p>}
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
