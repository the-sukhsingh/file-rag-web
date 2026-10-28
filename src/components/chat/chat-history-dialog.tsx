"use client";

import * as React from "react";
import { MessageSquareIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Conversation } from "@/lib/library/types";

export function ChatHistoryDialog({ open, onOpenChange, conversations, activeId, onSelect, onDelete, disabled }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<Conversation | null>(null);
  const visible = conversations.filter((conversation) => conversation.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 px-5 pt-6 pb-5 pr-12">
            <DialogTitle className="display-face text-[24px]">Your conversations</DialogTitle>
            <DialogDescription className="mt-2 text-[11px] leading-5">Chats and cited passages are saved in this browser, not in the cloud.</DialogDescription>
          </DialogHeader>
          {conversations.length > 0 && (
            <div className="relative mx-5 mb-3 shrink-0">
              <SearchIcon className="pointer-events-none absolute top-3 left-0 size-3.5 text-muted-foreground" />
              <input aria-label="Search conversations" placeholder="Find a conversation…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full border-b border-border bg-transparent pl-6 text-[12px] outline-none focus:border-primary" />
            </div>
          )}
          <div className="min-h-0 overflow-y-auto px-3 pb-4">
            {conversations.length === 0 ? (
              <div className="px-2 py-10 text-center">
                <MessageSquareIcon className="mx-auto mb-4 size-6 text-primary/60" strokeWidth={1.3} />
                <p className="text-[13px]">A place to pick up where you left off.</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Ask your first question. We’ll save the conversation here.</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">
                <p className="break-words">No conversations match “{query}”.</p>
                <button type="button" onClick={() => setQuery("")} className="mt-3 text-primary underline underline-offset-4">Clear search</button>
              </div>
            ) : (
              <ul className="space-y-1" aria-label="Saved conversations">
                {visible.map((conversation) => (
                  <li key={conversation.id} className={cn("flex items-center gap-1 rounded-lg pr-1", conversation.id === activeId ? "bg-primary/7" : "hover:bg-muted/60")}>
                    <button type="button" disabled={disabled} onClick={() => onSelect(conversation.id)} aria-current={conversation.id === activeId ? "true" : undefined} className="min-w-0 flex-1 rounded-lg px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="block line-clamp-2 text-[12px] leading-5 font-medium [overflow-wrap:anywhere]">{conversation.title}</span>
                      <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <time dateTime={new Date(conversation.updatedAt).toISOString()}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(conversation.updatedAt)}</time>
                        <span aria-hidden="true">·</span><span>{conversation.messages.length} messages</span>
                      </span>
                    </button>
                    <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Delete conversation: ${conversation.title}`} onClick={() => setPendingDelete(conversation)} className="size-8 shrink-0 text-muted-foreground hover:text-destructive"><Trash2Icon className="size-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {disabled && <p role="status" className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">Finish the current upload or stop the response before switching or deleting a chat.</p>}
        </DialogContent>
      </Dialog>
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
    </>
  );
}
