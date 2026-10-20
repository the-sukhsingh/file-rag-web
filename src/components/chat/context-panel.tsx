"use client";

import * as React from "react";
import {
  CheckIcon,
  EyeOffIcon,
  FileTextIcon,
  PinIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Chunk } from "@/lib/library/types";

/**
 * The context panel.
 *
 * Every chunk in the folder has a state:
 *
 *  - `auto`     - the retriever decides, on the score.
 *  - `pinned`   - always sent to the model, whatever the score.
 *  - `excluded` - never sent to the model.
 *
 * The user moves a chunk between those states, so they can force in the
 * passage that matters or keep the noisy one out.
 */

export type ChunkState = "auto" | "pinned" | "excluded";

export interface ContextSelection {
  pinned: Set<string>;
  excluded: Set<string>;
}

export function ContextPanel({
  chunks,
  selection,
  onChange,
  lastRetrieved,
  onHighlight,
  className,
}: {
  chunks: Chunk[];
  selection: ContextSelection;
  onChange: (selection: ContextSelection) => void;
  /** The chunk ids used in the last answer. */
  lastRetrieved?: string[];
  onHighlight?: (chunkId: string) => void;
  className?: string;
}) {
  const [tab, setTab] = React.useState<"sources" | "used">("sources");
  const [search, setSearch] = React.useState("");

  const setState = (chunkId: string, state: ChunkState) => {
    const pinned = new Set(selection.pinned);
    const excluded = new Set(selection.excluded);

    pinned.delete(chunkId);
    excluded.delete(chunkId);

    if (state === "pinned") pinned.add(chunkId);
    if (state === "excluded") excluded.add(chunkId);

    onChange({ pinned, excluded });
  };

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return chunks;
    return chunks.filter(
      (chunk) =>
        chunk.text.toLowerCase().includes(query) ||
        chunk.section.toLowerCase().includes(query)
    );
  }, [chunks, search]);

  const usedChunks = React.useMemo(() => {
    if (!lastRetrieved?.length) return [];
    const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    return lastRetrieved
      .map((chunkId) => byId.get(chunkId))
      .filter((chunk): chunk is Chunk => Boolean(chunk));
  }, [chunks, lastRetrieved]);

  const pinnedCount = selection.pinned.size;
  const excludedCount = selection.excluded.size;

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-l border-stone-mist bg-paper-white",
        className
      )}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "sources", label: "Sources", count: chunks.length },
              { id: "used", label: "Used", count: usedChunks.length },
            ] as const
          ).map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "rounded-[7px] px-2 py-1 text-[12px] font-medium transition-colors",
                tab === entry.id
                  ? "bg-stone-mist/70 text-charcoal"
                  : "text-bark-grey hover:text-charcoal"
              )}
            >
              {entry.label}
              {entry.count > 0 && (
                <span className="ml-1.5 font-mono text-[10px] text-pebble">
                  {entry.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {(pinnedCount > 0 || excludedCount > 0) && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              onChange({ pinned: new Set(), excluded: new Set() })
            }
            aria-label="Reset the context"
            className="h-6 gap-1 px-1.5 text-[11px] text-bark-grey hover:text-charcoal"
          >
            <RotateCcwIcon className="size-3" />
            Reset
          </Button>
        )}
      </div>

      {tab === "sources" && (
        <div className="px-4 pt-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-pebble" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search passages"
              className="h-8 rounded-[10px] pl-8 text-[12px]"
            />
          </div>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {tab === "sources" ? (
          filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] leading-[1.5] text-bark-grey">
              {chunks.length
                ? "No passage matches that search."
                : "This folder has no passages yet."}
            </p>
          ) : (
            <ul className="flex flex-col px-2 pt-2">
              {filtered.map((chunk) => {
                const state: ChunkState = selection.pinned.has(chunk.id)
                  ? "pinned"
                  : selection.excluded.has(chunk.id)
                    ? "excluded"
                    : "auto";

                return (
                  <li
                    key={chunk.id}
                    className="group flex flex-col gap-1.5 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-warm-bone"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileTextIcon className="size-3 shrink-0 text-pebble" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-charcoal">
                        {chunk.section}
                      </span>
                      {state !== "auto" && (
                        <span
                          className={cn(
                            "shrink-0 rounded-[5px] px-1 py-px font-mono text-[9px] uppercase tracking-[0.04em]",
                            state === "pinned"
                              ? "bg-lichen-green/10 text-lichen-green"
                              : "bg-alarm-red/10 text-alarm-red"
                          )}
                        >
                          {state}
                        </span>
                      )}
                    </div>

                    <p
                      className={cn(
                        "line-clamp-3 text-[12px] leading-[1.5]",
                        state === "excluded"
                          ? "text-pebble line-through"
                          : "text-bark-grey"
                      )}
                    >
                      {chunk.text}
                    </p>

                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setState(
                            chunk.id,
                            state === "pinned" ? "auto" : "pinned"
                          )
                        }
                        className={cn(
                          "h-6 gap-1 px-1.5 font-mono text-[10px] uppercase tracking-[0.04em]",
                          state === "pinned"
                            ? "text-lichen-green"
                            : "text-pebble hover:text-charcoal"
                        )}
                      >
                        <PinIcon className="size-3" />
                        {state === "pinned" ? "Pinned" : "Pin"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setState(
                            chunk.id,
                            state === "excluded" ? "auto" : "excluded"
                          )
                        }
                        className={cn(
                          "h-6 gap-1 px-1.5 font-mono text-[10px] uppercase tracking-[0.04em]",
                          state === "excluded"
                            ? "text-alarm-red"
                            : "text-pebble hover:text-charcoal"
                        )}
                      >
                        <EyeOffIcon className="size-3" />
                        {state === "excluded" ? "Excluded" : "Exclude"}
                      </Button>
                      {onHighlight && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => onHighlight(chunk.id)}
                          className="ml-auto h-6 px-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-pebble hover:text-charcoal"
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : usedChunks.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12px] leading-[1.5] text-bark-grey">
            Nothing has been used yet. Ask a question and the passages that
            answered it show up here.
          </p>
        ) : (
          <ul className="flex flex-col px-2 pt-2">
            {usedChunks.map((chunk, index) => (
              <li
                key={chunk.id}
                className="flex flex-col gap-1.5 rounded-[10px] px-2 py-2.5 transition-colors hover:bg-warm-bone"
              >
                <div className="flex items-center gap-1.5">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-electric-indigo/10 font-mono text-[10px] text-electric-indigo">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-charcoal">
                    {chunk.section}
                  </span>
                  {onHighlight && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onHighlight(chunk.id)}
                      className="h-6 px-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-pebble hover:text-charcoal"
                    >
                      View
                    </Button>
                  )}
                </div>
                <p className="line-clamp-4 text-[12px] leading-[1.5] text-bark-grey">
                  {chunk.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="flex items-center gap-3 border-t border-stone-mist px-4 py-2.5 text-[11px] text-bark-grey">
        <span className="flex items-center gap-1">
          <PinIcon className="size-3 text-lichen-green" />
          {pinnedCount} pinned
        </span>
        <span className="flex items-center gap-1">
          <EyeOffIcon className="size-3 text-alarm-red" />
          {excludedCount} excluded
        </span>
        {pinnedCount === 0 && excludedCount === 0 && (
          <span className="flex items-center gap-1 text-pebble">
            <CheckIcon className="size-3" />
            All available
          </span>
        )}
      </div>
    </aside>
  );
}
