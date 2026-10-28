"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, CopyIcon, FileTextIcon, Loader2Icon, SearchIcon, TerminalIcon, TriangleAlertIcon } from "lucide-react";
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
      {message.trace && message.trace.length > 0 && <TraceList steps={message.trace} isStreaming={isStreaming} />}
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
        {copyError && <p role="status" className="self-center text-[11px] text-muted-foreground">Copy unavailable. Select the answer to copy it.</p>}
      </div>
    </article>
  );
}

function TraceList({ steps, isStreaming }: { steps: TraceStep[]; isStreaming: boolean }) {
  const [isOpen, setIsOpen] = React.useState(true);
  const detailsId = React.useId();
  const commands = steps.filter((step) => step.kind === "command");
  const visibleSteps = commands.length ? commands : steps;
  const passageCount = new Set(steps.flatMap((step) => step.chunkIds ?? [])).size;

  return (
    <div className="mb-5 min-w-0 overflow-hidden rounded-lg border border-border/80 bg-muted/20">
      <button type="button" aria-expanded={isOpen} aria-controls={detailsId} onClick={() => setIsOpen((value) => !value)} className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
        {isStreaming ? <Loader2Icon className="size-3.5 shrink-0 animate-spin" /> : commands.length ? <TerminalIcon className="size-3.5 shrink-0" /> : <SearchIcon className="size-3.5 shrink-0" />}
        <span className="font-medium text-foreground">{commands.length ? "Command history" : "Search activity"}</span>
        <span className="ml-auto text-[10px] tabular-nums">{commands.length ? `${commands.length} ${commands.length === 1 ? "command" : "commands"}` : `${passageCount} ${passageCount === 1 ? "passage" : "passages"}`}</span>
        <ChevronDownIcon className={cn("size-3 shrink-0 transition-transform motion-reduce:transition-none", isOpen && "rotate-180")} />
      </button>
      <ol id={detailsId} hidden={!isOpen} aria-label={commands.length ? "Executed commands" : "Search steps"} className="divide-y divide-border/60 border-t border-border/60">
        {visibleSteps.map((step, index) => (
          <li key={step.id} className="flex min-w-0 items-start gap-2.5 px-3 py-3">
            <span className="mt-0.5 shrink-0 font-mono text-[9px] text-muted-foreground/75" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              {step.kind === "command" ? <code className="block whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground [overflow-wrap:anywhere]">{step.title}</code> : <p className="text-[11px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">{step.title}</p>}
              <div className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground", step.state === "failed" && "text-destructive")}>
                <span>{step.state === "running" ? "Running…" : step.exitCode !== undefined ? `Exit ${step.exitCode}` : step.state === "failed" ? "Failed" : "Done"}</span>
                {step.durationMs !== undefined && <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{step.durationMs < 1000 ? `${step.durationMs} ms` : `${(step.durationMs / 1000).toFixed(1)} s`}</span>}
              </div>
              {step.detail && (step.kind === "command" ? (
                <details className="group/output mt-2 text-[10px] text-muted-foreground">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm hover:text-foreground [&::-webkit-details-marker]:hidden"><ChevronDownIcon className="size-2.5 -rotate-90 transition-transform group-open/output:rotate-0 motion-reduce:transition-none" />Output preview</summary>
                  <pre className="mt-2 max-h-28 overflow-y-auto border-l border-border pl-2.5 font-mono text-[10px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]">{step.detail}</pre>
                </details>
              ) : <p className="mt-1 text-[10px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">{step.detail}</p>)}
            </div>
            {step.state === "running" ? <Loader2Icon className="mt-1 size-3 shrink-0 animate-spin text-primary" aria-hidden="true" /> : step.state === "failed" ? <TriangleAlertIcon className="mt-1 size-3 shrink-0 text-destructive" aria-hidden="true" /> : <CheckIcon className="mt-1 size-3 shrink-0 text-primary" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
