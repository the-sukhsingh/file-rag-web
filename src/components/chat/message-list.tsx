"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  Loader2Icon,
  SearchIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { ChatMessage, TraceStep } from "@/lib/library/types";

/**
 * The conversation.
 *
 * Assistant messages carry the trace of the agent's work above the answer, so
 * the user can see which passages were read and how the answer was reached.
 */

export function MessageList({
  messages,
  onCite,
}: {
  messages: ChatMessage[];
  onCite?: (chunkId: string) => void;
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
      className="flex-1 overflow-y-auto px-6 py-6"
    >
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
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
        <div className="max-w-[85%] rounded-[12px] border border-stone-mist bg-warm-bone px-4 py-3 text-[14px] leading-[1.43] text-charcoal">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {message.trace && message.trace.length > 0 && (
        <TraceList steps={message.trace} onCite={onCite} />
      )}

      {message.content && (
        <div className="rounded-[12px] border border-stone-mist bg-paper-white px-5 py-4">
          <div className="prose prose-sm max-w-none break-words text-[14px] leading-[1.6] text-charcoal prose-headings:font-semibold prose-headings:text-charcoal prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-strong:text-charcoal prose-code:rounded-[6px] prose-code:bg-warm-bone prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[13px] prose-pre:rounded-[12px] prose-pre:border prose-pre:border-stone-mist prose-pre:bg-warm-bone prose-pre:p-4">
            <Markdown>{message.content}</Markdown>
          </div>
          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-mist pt-3">
              <span className="tag-label text-[10px] text-pebble">Sources</span>
              {message.citations.map((chunkId, index) => (
                <button
                  key={chunkId}
                  type="button"
                  onClick={() => onCite?.(chunkId)}
                  className="rounded-[8px] border border-stone-mist px-2 py-0.5 font-mono text-[11px] text-bark-grey transition-colors hover:border-electric-indigo/40 hover:text-electric-indigo"
                >
                  [{index + 1}]
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {message.content && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy the answer"
            onClick={() => {
              navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-bark-grey"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The agent's trace, collapsed to one row per step.
 */
function TraceList({
  steps,
  onCite,
}: {
  steps: TraceStep[];
  onCite?: (chunkId: string) => void;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-[12px] border border-stone-mist bg-paper-white">
      {steps.map((step) => {
        const isOpen = expanded === step.id;
        const hasDetail = Boolean(step.detail || step.chunkIds?.length);

        return (
          <div
            key={step.id}
            className="border-b border-stone-mist last:border-b-0"
          >
            <button
              type="button"
              disabled={!hasDetail}
              onClick={() => setExpanded(isOpen ? null : step.id)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors",
                hasDetail && "hover:bg-warm-bone"
              )}
            >
              <StepIcon step={step} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-charcoal">
                {step.title}
              </span>
              {step.durationMs !== undefined && (
                <span className="shrink-0 font-mono text-[11px] text-pebble">
                  {step.durationMs}ms
                </span>
              )}
            </button>

            {isOpen && hasDetail && (
              <div className="flex flex-col gap-2 border-t border-stone-mist bg-warm-bone px-3.5 py-3">
                {step.detail && (
                  <p className="text-[12px] text-bark-grey">{step.detail}</p>
                )}
                {step.chunkIds && step.chunkIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {step.chunkIds.map((chunkId) => (
                      <button
                        key={chunkId}
                        type="button"
                        onClick={() => onCite?.(chunkId)}
                        className="flex items-center gap-1 rounded-[8px] border border-stone-mist bg-paper-white px-2 py-0.5 font-mono text-[11px] text-bark-grey transition-colors hover:border-electric-indigo/40 hover:text-electric-indigo"
                      >
                        <FileTextIcon className="size-3" />
                        {chunkId.slice(-8)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepIcon({ step }: { step: TraceStep }) {
  if (step.state === "running") {
    return <Loader2Icon className="size-3.5 shrink-0 animate-spin text-electric-indigo" />;
  }
  if (step.state === "failed") {
    return <TriangleAlertIcon className="size-3.5 shrink-0 text-alarm-red" />;
  }
  if (step.kind === "search") {
    return <SearchIcon className="size-3.5 shrink-0 text-bark-grey" />;
  }
  if (step.kind === "answer") {
    return <SparklesIcon className="size-3.5 shrink-0 text-electric-indigo" />;
  }
  return <FileTextIcon className="size-3.5 shrink-0 text-bark-grey" />;
}
