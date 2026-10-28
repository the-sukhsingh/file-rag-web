"use client";

import * as React from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

export function PromptBox({
  onSubmit,
  onStop,
  isBusy,
  placeholder = "Ask anything about your files…",
  disabled,
  children,
}: {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isBusy?: boolean;
  placeholder?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [text, setText] = React.useState("");
  const canSend = text.trim().length > 0 && !disabled && !isBusy;

  function submit() {
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div className="shrink-0 px-4 pt-3 pb-4 sm:px-8 sm:pb-6">
      <div className="mx-auto w-full max-w-[760px]">
        <div
          className={cn(
            "rounded-2xl border bg-card shadow-[0_3px_18px_-10px_#263b2926] transition-[border-color,box-shadow]",
            disabled
              ? "border-border"
              : "border-input focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_7%,transparent)]"
          )}
        >
          <div className="flex items-end gap-3 p-4">
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
              className="field-sizing-content max-h-40 min-h-12 min-w-0 flex-1 resize-none bg-transparent text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed sm:text-[15px]"
            />
            {isBusy ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={onStop}
                aria-label="Stop response"
                className="size-9 shrink-0 rounded-xl"
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
                className="size-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
          {children && (
            <div className="flex min-h-10 items-center border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
              {children}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
          {isBusy ? "Finding answers in your files…" : "Answers are grounded in your files. Always check the sources."}
        </p>
      </div>
    </div>
  );
}
