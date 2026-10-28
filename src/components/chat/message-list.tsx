"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, CopyIcon, FileTextIcon, Loader2Icon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { normalizeCitations, normalizeLatexDelimiters } from "@/lib/chat/remark-latex";
import type { ChatMessage, TraceStep } from "@/lib/library/types";

import "katex/dist/katex.min.css";

export function MessageList({ messages, onCite, getSourceLabel, isBusy }: {
  messages: ChatMessage[];
  onCite?: (chunkId: string) => void;
  getSourceLabel?: (chunkId: string) => string;
  isBusy?: boolean;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickToEnd = React.useRef(true);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (container && stickToEnd.current) container.scrollTop = container.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      aria-relevant="additions"
      aria-busy={isBusy}
      onScroll={(event) => {
        const container = event.currentTarget;
        stickToEnd.current = container.scrollHeight - container.scrollTop - container.clientHeight < 64;
      }}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-[824px] flex-col gap-9 px-4 py-8 sm:px-8 sm:py-10">
        {messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} onCite={onCite} getSourceLabel={getSourceLabel} isStreaming={!!isBusy && index === messages.length - 1} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, onCite, getSourceLabel, isStreaming }: {
  message: ChatMessage;
  onCite?: (chunkId: string) => void;
  getSourceLabel?: (chunkId: string) => string;
  isStreaming: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-muted px-4 py-3 text-[14px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] sm:max-w-[80%]">
          <span className="sr-only">You: </span>{message.content}
        </div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setCopyError(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  return (
    <article className="min-w-0" aria-label="Quarry’s answer">
      <div className="mb-4 flex items-center gap-2 text-[12px] font-medium">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/8 text-primary"><FileTextIcon className="size-3" strokeWidth={1.5} /></span>
        Quarry
        {isStreaming && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{message.content ? "Writing…" : "Finding the details…"}</span>}
      </div>
      {message.content ? (
        <div className="chat-prose min-w-0 text-[14px] leading-[1.85] text-foreground sm:text-[15px]">
          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeLatexDelimiters(normalizeCitations(message.content))}</Markdown>
        </div>
      ) : (
        <div role="status" className="flex items-center gap-2 text-[12px] text-muted-foreground"><Loader2Icon className="size-3.5 animate-spin" /> Reading your files…</div>
      )}
      {message.citations && message.citations.length > 0 && onCite && (
        <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Answer sources">
          {message.citations.map((chunkId, index) => {
            const label = getSourceLabel?.(chunkId) ?? `Source ${index + 1}`;
            return <button key={chunkId} type="button" onClick={() => onCite(chunkId)} title={label} aria-label={`View source: ${label}`} className="flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"><FileTextIcon className="size-3 shrink-0" /><span className="truncate">{label}</span><span className="sr-only"> — passage {index + 1}</span></button>;
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-start gap-2">
        {message.content && !isStreaming && <Button variant="ghost" size="icon-sm" aria-label={copied ? "Answer copied" : "Copy answer"} onClick={() => void copy()} className="size-7 text-muted-foreground hover:text-foreground">{copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}</Button>}
        {message.trace && message.trace.length > 0 && <TraceList steps={message.trace} isStreaming={isStreaming} />}
        {copyError && <p role="status" className="self-center text-[11px] text-muted-foreground">Copy unavailable. Select the answer to copy it.</p>}
      </div>
    </article>
  );
}

function TraceList({ steps, isStreaming }: { steps: TraceStep[]; isStreaming: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const detailsId = React.useId();
  const passageCount = new Set(steps.flatMap((step) => step.chunkIds ?? [])).size;

  return (
    <div className="min-w-0 flex-1">
      <button type="button" aria-expanded={isOpen} aria-controls={detailsId} onClick={() => setIsOpen((value) => !value)} className="flex min-h-7 items-center gap-1.5 rounded-sm text-[10px] text-muted-foreground hover:text-foreground">
        {isStreaming ? <Loader2Icon className="size-3 animate-spin" /> : <SearchIcon className="size-3" />}
        {isStreaming ? "Looking through your files" : passageCount ? `Reviewed ${passageCount} ${passageCount === 1 ? "passage" : "passages"}` : "Response details"}
        <ChevronDownIcon className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div id={detailsId} className="mt-2 space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          {steps.map((step) => <div key={step.id} className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">{step.state === "running" ? <Loader2Icon className="mt-1 size-3 shrink-0 animate-spin" /> : step.state === "failed" ? <TriangleAlertIcon className="mt-1 size-3 shrink-0" /> : <CheckIcon className="mt-1 size-3 shrink-0" />}<span className="min-w-0 break-words">{step.title}</span></div>)}
        </div>
      )}
    </div>
  );
}
