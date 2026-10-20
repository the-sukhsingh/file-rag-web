"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "cn";

/**
 * The progress popup.
 *
 * The bar is the popup's own background: a full-width fill sits behind the
 * text and a mask covers the part that is not filled in, so the bar reads as
 * the surface rather than as a separate element bolted underneath.
 */
export function ProgressPopup({
  label,
  percent,
  className,
}: {
  /** The message. A percentage is pulled out of it when there is one. */
  label: string;
  /** How far along, from 0 to 100. */
  percent?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent ?? 0));

  return (
    <div
      className={cn(
        "relative isolate flex max-w-xs items-center gap-2 overflow-hidden rounded-[12px] border border-stone-mist bg-paper-white px-4 py-2.5 text-[12px] text-bark-grey shadow-xl",
        className
      )}
    >
      {/*
        * The fill. It is masked to the left of the progress point, so the
        * bar grows from the left edge and the text stays readable on top of
        * it.
        */}
      {percent !== undefined && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 z-0 bg-electric-indigo/12"
          style={{
            width: `${clamped}%`,
            maskImage:
              "linear-gradient(to right, black 0%, black calc(100% - 14px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, black 0%, black calc(100% - 14px), transparent 100%)",
          }}
        />
      )}

      <Loader2Icon className="relative z-10 size-3.5 shrink-0 animate-spin text-electric-indigo" />

      <span className="relative z-10 min-w-0 flex-1 truncate font-mono tabular-nums">
        {label}
      </span>

      {percent !== undefined && (
        <span className="relative z-10 shrink-0 font-mono tabular-nums text-bark-grey">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
