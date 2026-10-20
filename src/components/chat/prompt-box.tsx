"use client";

import * as React from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

/**
 * The prompt box.
 *
 * Enter sends, Shift+Enter breaks the line. The box grows with the text up to
 * a ceiling, and then scrolls.
 */
export function PromptBox({
  onSubmit,
  onStop,
  isBusy,
  placeholder = "Ask a question about this folder",
  disabled,
  children,
}: {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isBusy?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** A row of controls above the textarea, such as the context chips. */
  children?: React.ReactNode;
}) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const canSend = text.trim().length > 0 && !disabled;

  function submit() {
    if (!canSend) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <div className="border-t border-stone-mist bg-background px-6 py-4">
      <div className="mx-auto w-full max-w-[760px]">
        <div
          className={cn(
            "rounded-[12px] border bg-paper-white transition-shadow focus-within:border-electric-indigo focus-within:ring-[3px] focus-within:ring-electric-indigo/15",
            disabled ? "border-stone-mist opacity-60" : "border-stone-mist"
          )}
        >
          {children}

          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            disabled={disabled}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="field-sizing-content max-h-40 min-h-[52px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[14px] leading-[1.5] text-charcoal outline-none placeholder:text-pebble disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <span className="font-mono text-[11px] text-pebble">
              Enter to send · Shift+Enter for a new line
            </span>
            {isBusy ? (
              <Button
                type="button"
                size="icon-sm"
                onClick={onStop}
                aria-label="Stop"
                className="size-8 rounded-[8px] border border-stone-mist bg-warm-bone text-charcoal hover:bg-stone-mist/60"
              >
                <SquareIcon className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                onClick={submit}
                disabled={!canSend}
                aria-label="Send"
                className={cn(
                  "size-8 rounded-[8px] transition-colors",
                  canSend
                    ? "bg-electric-indigo text-white hover:bg-deep-violet"
                    : "bg-stone-mist/60 text-pebble"
                )}
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
