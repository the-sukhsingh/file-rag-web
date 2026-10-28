"use client";

import * as React from "react";
import { ArrowUpIcon, PlusIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

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
}) {
  const [text, setText] = React.useState("");
  const canSend = text.trim().length > 0 && !disabled && !isBusy;

  function submit() {
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div className={cn("shrink-0", className ?? "px-4 pt-3 pb-4 sm:px-8 sm:pb-6")}>
      <div className="mx-auto w-full max-w-[760px]">
        <div
          className={cn(
            "rounded-[22px] border bg-card shadow-[0_8px_30px_-24px_#263b2966] transition-[border-color,box-shadow]",
            disabled
              ? "border-border"
              : "border-input focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_7%,transparent)]"
          )}
        >
          <textarea
            aria-label="Ask a question about your files"
            value={text}
            rows={2}
            disabled={disabled}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
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
            {children && <div className="flex min-w-0 flex-1 items-center px-1 text-[11px] text-muted-foreground">{children}</div>}
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
            {isBusy ? "Finding answers in your files…" : "Answers are grounded in your files. Always check the sources."}
          </p>
        )}
      </div>
    </div>
  );
}
