"use client";

import * as React from "react";
import {
  CheckIcon,
  EyeOffIcon,
  FileTextIcon,
  FolderIcon,
  PinIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { Chunk } from "@/lib/library/types";

/**
 * The passage editor.
 *
 * The passage is the unit of the library, so it is the unit of the screen: it
 * opens in the middle, it can be rewritten, moved, pinned or dropped, and the
 * chat on the right answers from whatever is open.
 */
export function PassagePane({
  chunk,
  chapterName,
  documentName,
  isPinned,
  isExcluded,
  isSaving,
  onSave,
  onMove,
  onTogglePin,
  onToggleExclude,
  onDelete,
  onAdd,
}: {
  chunk: Chunk | null;
  chapterName?: string;
  documentName?: string;
  isPinned: boolean;
  isExcluded: boolean;
  isSaving: boolean;
  onSave: (text: string) => void;
  onMove: () => void;
  onTogglePin: () => void;
  onToggleExclude: () => void;
  onDelete: () => void;
  onAdd: () => void;
}) {
  const [draft, setDraft] = React.useState(chunk?.text ?? "");
  const [isEditing, setIsEditing] = React.useState(false);

  // The draft follows the passage that is open. The key changes with the
  // passage, so the state is re-initialised rather than corrected by an
  // effect.
  const chunkId = chunk?.id ?? "none";

  if (!chunk) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-warm-bone text-bark-grey">
          <FileTextIcon className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-[15px] font-semibold text-charcoal">
            No passage open
          </p>
          <p className="max-w-[36ch] text-[14px] leading-[1.5] text-bark-grey">
            Pick a passage from the explorer to read or edit it, or add a new
            one to this folder.
          </p>
        </div>
        <Button
          onClick={onAdd}
          className="mt-1 h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet"
        >
          <PlusIcon className="size-3.5" />
          Add a passage
        </Button>
      </div>
    );
  }

  const dirty = draft !== chunk.text;

  return (
    <div key={chunkId} className="flex min-h-0 flex-1 flex-col">
      {/* The passage header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-mist px-6 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-bark-grey">
            {documentName && <span className="truncate">{documentName}</span>}
            {chapterName && (
              <>
                <span className="text-pebble">/</span>
                <span className="truncate">{chapterName}</span>
              </>
            )}
          </div>
          <span className="font-mono text-[12px] text-charcoal">
            {chunk.fileName ?? `${String(chunk.index + 1).padStart(3, "0")}.md`}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={onTogglePin}
            className={cn(
              "h-7 gap-1 px-2 font-mono text-[10px] uppercase tracking-[0.04em]",
              isPinned
                ? "text-lichen-green"
                : "text-bark-grey hover:text-charcoal"
            )}
          >
            <PinIcon className="size-3" />
            {isPinned ? "Pinned" : "Pin"}
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={onToggleExclude}
            className={cn(
              "h-7 gap-1 px-2 font-mono text-[10px] uppercase tracking-[0.04em]",
              isExcluded
                ? "text-alarm-red"
                : "text-bark-grey hover:text-charcoal"
            )}
          >
            <EyeOffIcon className="size-3" />
            {isExcluded ? "Excluded" : "Exclude"}
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={onMove}
            className="h-7 gap-1 px-2 font-mono text-[10px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
          >
            <FolderIcon className="size-3" />
            Move
          </Button>

          <Button
            variant="ghost"
            size="xs"
            onClick={onDelete}
            aria-label="Delete the passage"
            className="h-7 gap-1 px-2 font-mono text-[10px] uppercase tracking-[0.04em] text-bark-grey hover:text-alarm-red"
          >
            <Trash2Icon className="size-3" />
          </Button>
        </div>
      </div>

      {/* The passage itself */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {isEditing ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            className="field-sizing-content min-h-[240px] w-full resize-none rounded-[12px] border border-stone-mist bg-paper-white p-4 font-mono text-[13px] leading-[1.7] text-charcoal outline-none focus:border-electric-indigo focus:ring-[3px] focus:ring-electric-indigo/12"
          />
        ) : (
          <p className="whitespace-pre-wrap text-[14px] leading-[1.75] text-charcoal">
            {chunk.text}
          </p>
        )}
      </div>

      {/* The passage actions */}
      <div className="flex items-center gap-2 border-t border-stone-mist px-6 py-3">
        {isEditing ? (
          <>
            <Button
              onClick={() => onSave(draft)}
              disabled={!dirty || isSaving}
              className="h-8 gap-1.5 rounded-[8px] bg-electric-indigo px-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet disabled:opacity-50"
            >
              {isSaving ? (
                <SaveIcon className="size-3.5" />
              ) : (
                <CheckIcon className="size-3.5" />
              )}
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(chunk.text);
                setIsEditing(false);
              }}
              className="h-8 px-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setIsEditing(true)}
            className="h-8 gap-1.5 rounded-[8px] border-stone-mist px-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-charcoal hover:border-charcoal"
          >
            Edit passage
          </Button>
        )}

        <span className="ml-auto font-mono text-[11px] text-pebble">
          {chunk.tokens.length} tokens
          {chunk.embedding ? " · embedded" : " · not embedded"}
        </span>
      </div>
    </div>
  );
}
