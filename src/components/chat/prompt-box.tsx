"use client";

import * as React from "react";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

/**
 * The composer.
 *
 * One rounded field with the send button sitting inside it, so the control
 * that matters is where the eye already is. Enter sends, Shift+Enter breaks
 * the line, and the field grows with the text up to a ceiling.
 */
export function PromptBox({
  onSubmit,
  onStop,
  isBusy,
  placeholder = "Ask a question",
  disabled,
  children,
}: {
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isBusy?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** A row of controls above the field, such as the context chips. */
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
    <div className="shrink-0 px-6 pb-6 pt-2">
      <div className="mx-auto w-full max-w-[720px]">
        <div
          className={cn(
            "rounded-[14px] border bg-paper-white transition-all",
            disabled
              ? "border-stone-mist"
              : "border-stone-mist focus-within:border-electric-indigo focus-within:ring-[3px] focus-within:ring-electric-indigo/12"
          )}
        >
          {children}

          <div className="flex items-end gap-2 px-3 py-2.5">
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
              className="field-sizing-content max-h-40 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-[1.5] text-charcoal outline-none placeholder:text-pebble disabled:cursor-not-allowed"
            />

            {isBusy ? (
              <Button
                type="button"
                size="icon-sm"
                onClick={onStop}
                aria-label="Stop"
                className="size-8 shrink-0 rounded-[9px] border border-stone-mist bg-warm-bone text-charcoal hover:bg-stone-mist/60"
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
                  "size-8 shrink-0 rounded-[9px] transition-colors",
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

        <p className="mt-2 text-center font-mono text-[10px] text-pebble">
          {isBusy ? "The assistant is working" : "Enter to send · Shift+Enter for a new line"}
        </p>
      </div>
    </div>
  );
}
