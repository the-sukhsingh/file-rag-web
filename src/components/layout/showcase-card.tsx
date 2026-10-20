"use client";

import * as React from "react";
import { cn } from "cn";

/**
 * The product showcase card.
 *
 * The only shadowed surface in the system, and the one place the app shows
 * itself: a mock of the folder workspace, built from the same pieces the real
 * one uses, so the picture and the product agree.
 */
export function ShowcaseCard() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-stone-mist bg-paper-white shadow-xl">
      <div className="grid min-h-[340px] grid-cols-1 md:grid-cols-[240px_1fr]">
        {/* The tree */}
        <div className="flex flex-col gap-1 border-b border-stone-mist bg-warm-bone p-4 md:border-b-0 md:border-r">
          <span className="tag-label mb-2 text-bark-grey">Library</span>

          {[
            { name: "Research", depth: 0, active: false },
            { name: "Field notes", depth: 1, active: true },
            { name: "Papers", depth: 1, active: false },
            { name: "Handbook", depth: 0, active: false },
          ].map((item) => (
            <div
              key={item.name}
              className={cn(
                "flex items-center gap-2 rounded-[8px] py-1.5 pr-2 text-[13px]",
                item.active
                  ? "bg-stone-mist/70 font-semibold text-charcoal"
                  : "text-bark-grey"
              )}
              style={{ paddingLeft: item.depth * 16 + 4 }}
            >
              <span
                className={cn(
                  "size-3.5 shrink-0 rounded-[3px] border",
                  item.active
                    ? "border-electric-indigo bg-electric-indigo/20"
                    : "border-pebble/60"
                )}
              />
              {item.name}
            </div>
          ))}

          <div className="mt-auto flex flex-col gap-1.5 pt-4">
            <span className="tag-label text-[10px] text-bark-grey">Chapters</span>
            {["Introduction", "The petals", "Harvest"].map((chapter) => (
              <div
                key={chapter}
                className="flex items-center gap-2 text-[12px] text-pebble"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-terracotta/70" />
                {chapter}
              </div>
            ))}
          </div>
        </div>

        {/* The conversation */}
        <div className="flex flex-col">
          <div className="flex flex-1 flex-col gap-4 p-6">
            <div className="flex justify-end">
              <div className="max-w-[78%] rounded-[12px] border border-stone-mist bg-warm-bone px-4 py-2.5 text-[13px] text-charcoal">
                When are the petals collected?
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 text-[12px] text-bark-grey">
                <span className="size-3.5 shrink-0 rounded-full border border-stone-mist" />
                Searching the folder
                <span className="font-mono text-[10px] text-pebble">3 passages</span>
              </div>
              <div className="rounded-[12px] border border-stone-mist bg-paper-white px-4 py-3 text-[13px] leading-[1.6] text-charcoal">
                The petals are collected in late autumn, after the first frost.
                Workers gather them into woven baskets and dry them on racks
                before the pigment is extracted{" "}
                <span className="rounded-[4px] bg-electric-indigo/10 px-1 font-mono text-[12px] text-electric-indigo">
                  [2]
                </span>
                .
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="rounded-[8px] border border-stone-mist px-2 py-0.5 font-mono text-[10px] text-bark-grey">
                  [1]
                </span>
                <span className="rounded-[8px] border border-stone-mist px-2 py-0.5 font-mono text-[10px] text-bark-grey">
                  [2]
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-mist p-4">
            <div className="flex items-center justify-between rounded-[12px] border border-stone-mist bg-paper-white px-4 py-2.5">
              <span className="text-[13px] text-pebble">
                Ask about Field notes...
              </span>
              <span className="flex size-7 items-center justify-center rounded-[8px] bg-electric-indigo">
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
