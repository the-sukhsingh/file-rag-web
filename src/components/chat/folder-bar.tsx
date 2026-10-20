"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon, FolderIcon } from "lucide-react";
import { cn } from "cn";

import type { Folder } from "@/lib/library/types";

/**
 * The folder breadcrumb.
 *
 * The folder's name and its path sit in the navigation bar itself, so there
 * is one bar on the page rather than two. Each step is a link, so the reader
 * can climb back up the tree.
 */
export function FolderBreadcrumb({
  folder,
  ancestors,
}: {
  folder: Folder;
  /** The folders above this one, root first. */
  ancestors: Folder[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
      <Link
        href="/"
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
    <div className="flex max-w-[400px] flex-col items-center gap-3 text-center">
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
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-1 rounded-[8px] bg-electric-indigo px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-primary-foreground transition-colors hover:bg-deep-violet"
        >
          Add key
        </button>
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
