"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  SearchIcon,
} from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FolderSummary } from "@/components/library/library-provider";
import type { DocumentRecord, Folder } from "@/lib/library/types";

/**
 * The move picker.
 *
 * A list of the folders the item can go into, with the current one marked and
 * the folders that would make a cycle left out. The search narrows the list
 * as you type.
 */
export function MovePicker({
  folders,
  documents,
  summaries,
  currentFolderId,
  excludeIds = [],
  onPick,
  className,
}: {
  folders: Folder[];
  documents: DocumentRecord[];
  summaries: Map<string, FolderSummary>;
  /** The folder the item is in now. */
  currentFolderId?: string | null;
  /** Folders that cannot be picked, such as the item's own descendants. */
  excludeIds?: string[];
  onPick: (folderId: string) => void;
  className?: string;
}) {
  const [search, setSearch] = React.useState("");

  const excluded = React.useMemo(
    () => new Set([...(excludeIds ?? []), ...(currentFolderId ? [currentFolderId] : [])]),
    [excludeIds, currentFolderId]
  );

  /**
   * The folders an import creates are not places a reader can put something:
   * they hold the passages of one document. They stay out of the list.
   */
  const containers = React.useMemo(
    () => new Set(documents.map((document) => document.folderId)),
    [documents]
  );

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return folders
      .filter((folder) => !excluded.has(folder.id))
      .filter((folder) => !containers.has(folder.id))
      .filter((folder) => {
        if (!query) return true;
        return folder.path.toLowerCase().includes(query);
      })
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  }, [folders, excluded, containers, search]);

  // The root of the library is a destination of its own.
  const rootIsAllowed = !search.trim();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-pebble" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a folder"
          className="h-9 rounded-[10px] pl-8 text-[13px]"
        />
      </div>

      <ScrollArea className="max-h-64 rounded-[10px] border border-stone-mist">
        <div className="flex flex-col p-1">
          {rootIsAllowed && (
            <button
              type="button"
              onClick={() => onPick("")}
              className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-charcoal transition-colors hover:bg-warm-bone"
            >
              <FolderOpenIcon className="size-4 shrink-0 text-bark-grey" />
              <span className="flex-1 truncate">Library root</span>
            </button>
          )}

          {visible.map((folder) => {
            const depth = folder.path.split("/").length - 1;
            const summary = summaries.get(folder.id);
            const documentCount = summary?.documentCount ?? 0;

            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => onPick(folder.id)}
                className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-charcoal transition-colors hover:bg-warm-bone"
                style={{ paddingLeft: 10 + depth * 14 }}
              >
                <FolderIcon className="size-4 shrink-0 text-electric-indigo" />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                {documentCount > 0 && (
                  <span className="shrink-0 font-mono text-[10px] text-pebble">
                    {documentCount}
                  </span>
                )}
              </button>
            );
          })}

          {visible.length === 0 && !rootIsAllowed && (
            <p className="px-2.5 py-6 text-center text-[12px] text-bark-grey">
              No folder matches that search.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * A folder chip, used to show where something lives.
 */
export function FolderPath({
  folder,
  ancestors,
  className,
}: {
  folder: Folder | undefined;
  ancestors: Folder[];
  className?: string;
}) {
  if (!folder) return null;

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1 text-[12px] text-bark-grey",
        className
      )}
    >
      {ancestors.map((ancestor) => (
        <React.Fragment key={ancestor.id}>
          <span className="truncate">{ancestor.name}</span>
          <ChevronRightIcon className="size-3 shrink-0 text-pebble" />
        </React.Fragment>
      ))}
      <span className="truncate font-medium text-charcoal">{folder.name}</span>
    </span>
  );
}
