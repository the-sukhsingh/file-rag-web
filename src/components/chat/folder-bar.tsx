"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  FolderIcon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Folder } from "@/lib/library/types";

/**
 * The folder bar.
 *
 * The folder's name and its path sit in the navigation bar itself, so there
 * is one bar on the page rather than two. The breadcrumb is a trail of links
 * that can be clicked, and the actions live in a quiet menu on the right.
 */
export function FolderBar({
  folder,
  ancestors,
  passageCount,
  messageCount,
  onClearChat,
  onDelete,
  onOpenLibrary,
}: {
  folder: Folder;
  /** The folders above this one, root first. */
  ancestors: Folder[];
  passageCount: number;
  messageCount: number;
  onClearChat?: () => void;
  onDelete?: () => void;
  onOpenLibrary?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <Link
          href="/"
          onClick={onOpenLibrary}
          className="shrink-0 text-bark-grey transition-colors hover:text-charcoal"
        >
          Library
        </Link>

        {ancestors.map((ancestor) => (
          <React.Fragment key={ancestor.id}>
            <ChevronRightIcon className="size-3 shrink-0 text-pebble" />
            <span className="truncate text-bark-grey">{ancestor.name}</span>
          </React.Fragment>
        ))}

        <ChevronRightIcon className="size-3 shrink-0 text-pebble" />
        <span className="flex shrink-0 items-center gap-1.5 font-semibold text-charcoal">
          <FolderIcon className="size-3.5 text-electric-indigo" />
          {folder.name}
        </span>
      </div>

      <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-pebble sm:flex">
        <span className="h-3 w-px bg-stone-mist" />
        {passageCount} passages
        {messageCount > 0 && ` · ${messageCount} messages`}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        {onClearChat && messageCount > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onClearChat}
            className="h-7 px-2 text-[11px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
          >
            Clear
          </Button>
        )}

        {onDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Actions for ${folder.name}`}
                  className="flex size-7 items-center justify-center rounded-[8px] text-bark-grey transition-colors hover:bg-stone-mist/60 hover:text-charcoal"
                >
                  <MoreHorizontalIcon className="size-4" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                variant="destructive"
                onClick={onDelete}
              >
                <Trash2Icon className="mr-2 size-3.5" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

/**
 * The empty state of a folder with nothing in it.
 */
export function FolderEmpty({
  hasKey,
  onOpenSettings,
}: {
  hasKey: boolean;
  onOpenSettings: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-3 text-center">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-[12px]",
          hasKey
            ? "bg-warm-bone text-bark-grey"
            : "bg-terracotta/10 text-terracotta"
        )}
      >
        {hasKey ? <FolderIcon className="size-5" /> : <KeyIcon />}
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[16px] font-semibold text-charcoal">
          {hasKey ? "Nothing to read yet" : "Add your API key"}
        </h2>
        <p className="text-[14px] leading-[1.5] text-bark-grey">
          {hasKey
            ? "This folder has no passages. Import a PDF into it from the library, then come back and ask."
            : "Quarry calls Groq with your own key. Add one to start asking questions of this folder."}
        </p>
      </div>
      {!hasKey && (
        <Button
          onClick={onOpenSettings}
          className="mt-1 h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white hover:bg-deep-violet"
        >
          Add key
        </Button>
      )}
    </div>
  );
}

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15.5 7.5a4.5 4.5 0 1 1-4.28 5.86L4 20.58V16h3v-3h3.42l1.08-1.08A4.5 4.5 0 0 1 15.5 7.5Z" />
    </svg>
  );
}
