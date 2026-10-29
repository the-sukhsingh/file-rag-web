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

  const uniqueCitations = React.useMemo(() => {
    if (!message.citations || !onCite) return [];
    const seen = new Set<string>();
    const result: { chunkId: string; label: string }[] = [];
    for (const chunkId of message.citations) {
      const label = getSourceLabel?.(chunkId) ?? "Source";
      if (!seen.has(label)) {
        seen.add(label);
        result.push({ chunkId, label });
      }
    }
    return result;
  }, [message.citations, getSourceLabel, onCite]);

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
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium">
        <span className="flex size-5 items-center justify-center rounded bg-primary/10 text-primary">
          <FileTextIcon className="size-3" strokeWidth={1.5} />
        </span>
        Quarry
        {isStreaming && (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            {message.content ? "Writing…" : "Finding the details…"}
          </span>
        )}
      </div>
      {message.trace && message.trace.length > 0 && (
        <TraceList steps={message.trace} isStreaming={isStreaming} />
      )}
      {message.content ? (
        <div className="chat-prose min-w-0 text-[14px] leading-[1.85] text-foreground sm:text-[15px]">
          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {normalizeLatexDelimiters(normalizeCitations(message.content))}
          </Markdown>
        </div>
      ) : (
        <div role="status" className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2Icon className="size-3.5 animate-spin" /> Reading your files…
        </div>
      )}
      {uniqueCitations.length > 0 && onCite && (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Answer sources">
          {uniqueCitations.map(({ chunkId, label }) => (
            <button
              key={chunkId}
              type="button"
              onClick={() => onCite(chunkId)}
              title={label}
              aria-label={`View source: ${label}`}
              className="flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-muted/20 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
            >
              <FileTextIcon className="size-3 shrink-0 opacity-70" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-start gap-2">
        {message.content && !isStreaming && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copied ? "Answer copied" : "Copy answer"}
            onClick={() => void copy()}
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </Button>
        )}
        {copyError && (
          <p role="status" className="self-center text-[11px] text-muted-foreground">
            Copy unavailable. Select the answer to copy it.
          </p>
        )}
      </div>
    </article>
  );
}

function TraceList({ steps, isStreaming }: { steps: TraceStep[]; isStreaming: boolean }) {
  const [userToggled, setUserToggled] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const detailsId = React.useId();
  const commands = steps.filter((step) => step.kind === "command");
  const visibleSteps = commands.length ? commands : steps;
  const passageCount = new Set(steps.flatMap((step) => step.chunkIds ?? [])).size;

  const open = userToggled ? isOpen : isStreaming;

  return (
    <div className="mb-4 min-w-0 rounded-lg border border-border/40 bg-muted/15 text-[11px] transition-colors">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => {
          setUserToggled(true);
          setIsOpen(!open);
        }}
        className="flex min-h-8 w-full items-center gap-2 px-2.5 py-1.5 text-left text-muted-foreground transition-colors hover:text-foreground"
      >
        {isStreaming ? (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : commands.length ? (
          <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        ) : (
          <SearchIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
        )}
        <span className="font-medium text-foreground/80">
          {commands.length ? "Command execution" : "Search activity"}
        </span>
        {passageCount > 0 && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums">
            · {passageCount} {passageCount === 1 ? "passage" : "passages"}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/45 tabular-nums">
          {visibleSteps.length} {visibleSteps.length === 1 ? "step" : "steps"}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3 shrink-0 text-muted-foreground/50 transition-transform duration-150 motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <ol
          id={detailsId}
          aria-label={commands.length ? "Executed commands" : "Search steps"}
          className="space-y-1.5 border-t border-border/30 px-3 py-2"
        >
          {visibleSteps.map((step) => {
            const isFailed = step.state === "failed";
            const isRunning = step.state === "running";
            return (
              <li key={step.id} className="flex min-w-0 items-start gap-2 py-0.5">
                <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                  {isRunning ? (
                    <Loader2Icon className="size-3 animate-spin text-primary" />
                  ) : isFailed ? (
                    <TriangleAlertIcon className="size-3 text-destructive" />
                  ) : (
                    <CheckIcon className="size-3 text-primary/70" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {step.kind === "command" ? (
                      <code className="font-mono text-[11px] text-foreground [overflow-wrap:anywhere]">
                        {step.title}
                      </code>
                    ) : (
                      <span className="text-[11px] text-foreground/85 [overflow-wrap:anywhere]">
                        {step.title}
                      </span>
                    )}

                    {step.durationMs !== undefined && (
                      <span className="text-[10px] text-muted-foreground/45 tabular-nums">
                        {step.durationMs < 1000
                          ? `${step.durationMs} ms`
                          : `${(step.durationMs / 1000).toFixed(1)} s`}
                      </span>
                    )}
                  </div>

                  {step.detail && step.kind !== "command" && (
                    <p className="mt-0.5 text-[10px] leading-normal text-muted-foreground/60 [overflow-wrap:anywhere]">
                      {step.detail}
                    </p>
                  )}

                  {step.detail && step.kind === "command" && (
                    <details className="group/output mt-1 text-[10px] text-muted-foreground">
                      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm hover:text-foreground [&::-webkit-details-marker]:hidden">
                        <ChevronDownIcon className="size-2.5 -rotate-90 transition-transform group-open/output:rotate-0 motion-reduce:transition-none" />
                        Output preview
                      </summary>
                      <pre className="mt-1.5 max-h-28 overflow-y-auto rounded border border-border/40 bg-background/50 p-2 font-mono text-[10px] leading-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {step.detail}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
