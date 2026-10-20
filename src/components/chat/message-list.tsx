"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  Loader2Icon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { ChatMessage, TraceStep } from "@/lib/library/types";

import "katex/dist/katex.min.css";

/**
 * The conversation.
 *
 * The assistant's answers are set in the page rather than boxed in a card, so
 * the thread reads as a document. The work it did folds into one quiet line
 * above the answer, and only opens when it is clicked.
 */

export function MessageList({
  messages,
  onCite,
  compact = false,
}: {
  messages: ChatMessage[];
  onCite?: (chunkId: string) => void;
  /** A narrower variant, for the chat panel beside the editor. */
  compact?: boolean;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickToEnd = React.useRef(true);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container || !stickToEnd.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const container = event.currentTarget;
        const distanceFromEnd =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        stickToEnd.current = distanceFromEnd < 64;
      }}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-8",
          compact ? "gap-6 px-4 py-6" : "max-w-[720px] px-6 py-8"
        )}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onCite={onCite} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCite,
}: {
  message: ChatMessage;
  onCite?: (chunkId: string) => void;
}) {
  const [copied, setCopied] = React.useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[12px] bg-stone-mist/70 px-3.5 py-2.5 text-[14px] leading-[1.5] text-charcoal">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {message.trace && message.trace.length > 0 && (
        <TraceList steps={message.trace} onCite={onCite} />
      )}

      {message.content && (
        <>
          <div className="prose prose-sm max-w-none break-words text-[14px] leading-[1.65] text-charcoal prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-[16px] prose-headings:font-semibold prose-headings:text-charcoal prose-p:my-2.5 prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1 prose-li:pl-1 prose-strong:font-semibold prose-strong:text-charcoal prose-code:rounded-[5px] prose-code:bg-stone-mist/70 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[12.5px] prose-code:font-normal prose-pre:rounded-[12px] prose-pre:border prose-pre:border-stone-mist prose-pre:bg-warm-bone prose-pre:p-4 prose-blockquote:border-l-2 prose-blockquote:border-stone-mist prose-blockquote:pl-3 prose-blockquote:text-bark-grey prose-a:text-sapphire-link">
            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {message.content}
            </Markdown>
          </div>

          <div className="flex items-center gap-1">
            {message.citations && message.citations.length > 0 && (
              <div className="mr-1 flex flex-wrap items-center gap-1">
                {message.citations.map((chunkId, index) => (
                  <button
                    key={chunkId}
                    type="button"
                    onClick={() => onCite?.(chunkId)}
                    title="Show this passage"
                    className="rounded-[6px] border border-stone-mist px-1.5 py-0.5 font-mono text-[10px] text-bark-grey transition-colors hover:border-electric-indigo/40 hover:text-electric-indigo"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Copy the answer"
              onClick={() => {
                navigator.clipboard.writeText(message.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-pebble hover:text-charcoal"
            >
              {copied ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The agent's work, folded into one line that opens on click.
 */
function TraceList({
  steps,
  onCite,
}: {
  steps: TraceStep[];
  onCite?: (chunkId: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const last = steps[steps.length - 1];

  const summary = React.useMemo(() => {
    const searches = steps.filter((step) => step.kind === "search");
    const reads = steps.filter((step) => step.kind === "read");
    const passages = new Set(
      searches.flatMap((step) => step.chunkIds ?? [])
    ).size;

    const parts: string[] = [];
    if (searches.length) {
      parts.push(
        `${searches.length} search${searches.length === 1 ? "" : "es"}`
      );
    }
    if (passages) parts.push(`${passages} passage${passages === 1 ? "" : "s"}`);
    if (reads.length) {
      parts.push(`${reads.length} command${reads.length === 1 ? "" : "s"}`);
    }

    return parts.join(" · ") || "Working";
  }, [steps]);

  const isRunning = last?.state === "running";

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="group flex w-fit items-center gap-1.5 text-[12px] text-pebble transition-colors hover:text-bark-grey"
      >
        {isRunning ? (
          <Loader2Icon className="size-3 animate-spin text-electric-indigo" />
        ) : (
          <SearchIcon className="size-3" />
        )}
        <span className="font-mono">{isRunning ? last?.title : summary}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn(
            "size-3 transition-transform",
            isOpen && "rotate-90"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-0.5 rounded-[10px] border border-stone-mist bg-paper-white px-3 py-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-2 py-1 text-[12px]"
            >
              <StepIcon step={step} />
              <span className="min-w-0 flex-1 truncate text-bark-grey">
                {step.title}
              </span>
              {step.durationMs !== undefined && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-pebble">
                  {step.durationMs}ms
                </span>
              )}
            </div>
          ))}

          {steps.some((step) => step.chunkIds?.length) && (
            <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-stone-mist pt-2">
              {[...new Set(steps.flatMap((step) => step.chunkIds ?? []))].map(
                (chunkId) => (
                  <button
                    key={chunkId}
                    type="button"
                    onClick={() => onCite?.(chunkId)}
                    className="rounded-[6px] border border-stone-mist px-1.5 py-0.5 font-mono text-[10px] text-bark-grey transition-colors hover:border-electric-indigo/40 hover:text-electric-indigo"
                  >
                    {chunkId.slice(-8)}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepIcon({ step }: { step: TraceStep }) {
  if (step.state === "running") {
    return (
      <Loader2Icon className="size-3 shrink-0 animate-spin text-electric-indigo" />
    );
  }
  if (step.state === "failed") {
    return <TriangleAlertIcon className="size-3 shrink-0 text-alarm-red" />;
  }
  if (step.kind === "search") {
    return <SearchIcon className="size-3 shrink-0 text-pebble" />;
  }
  if (step.kind === "read") {
    return <TerminalIcon className="size-3 shrink-0 text-pebble" />;
  }
  if (step.kind === "answer") {
    return <SparklesIcon className="size-3 shrink-0 text-electric-indigo" />;
  }
  return <FileTextIcon className="size-3 shrink-0 text-pebble" />;
}
