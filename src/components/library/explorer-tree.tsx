"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  Trash2Icon,
  EyeOffIcon,
} from "lucide-react";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Chunk, DocumentRecord, Folder } from "@/lib/library/types";

/**
 * The file explorer.
 *
 * The tree is the library as it is stored: folders hold documents, a document
 * holds chapters, and a chapter holds the passages. The passages are files -
 * they can be opened, edited, moved and deleted.
 */

export interface ExplorerDocument {
  document: DocumentRecord;
  /** The chapter folder of this document. */
  container: Folder | undefined;
  chapters: Folder[];
  /** The passages, grouped by the chapter they belong to. */
  passages: Map<string, Chunk[]>;
}

export function buildExplorer(
  folders: Folder[],
  documents: DocumentRecord[],
  chunks: Chunk[]
): ExplorerDocument[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  const passagesByFolder = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = passagesByFolder.get(chunk.folderId);
    if (list) list.push(chunk);
    else passagesByFolder.set(chunk.folderId, [chunk]);
  }

  return documents
    .map((document) => {
      const container = byId.get(document.folderId);
      const chapters = folders
        .filter((folder) => folder.parentId === document.folderId)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      const passages = new Map<string, Chunk[]>();
      for (const chapter of chapters) {
        passages.set(
          chapter.id,
          (passagesByFolder.get(chapter.id) ?? []).sort(
            (a, b) => a.index - b.index
          )
        );
      }

      return { document, container, chapters, passages };
    })
    .sort((a, b) => a.document.name.localeCompare(b.document.name));
}

export function ExplorerTree({
  documents,
  selectedChunkId,
  citedChunkIds = [],
  onSelectChunk,
  onSelectDocument,
  onAddPassage,
  onEditPassage,
  onDeletePassage,
  onMovePassage,
  onTogglePin,
  onToggleExclude,
  pinnedIds,
  excludedIds,
  className,
}: {
  documents: ExplorerDocument[];
  selectedChunkId: string | null;
  /** The passages the last answer used. */
  citedChunkIds?: string[];
  onSelectChunk: (chunk: Chunk) => void;
  onSelectDocument?: (document: DocumentRecord) => void;
  onAddPassage: (document: DocumentRecord) => void;
  onEditPassage: (chunk: Chunk) => void;
  onDeletePassage: (chunk: Chunk) => void;
  onMovePassage: (chunk: Chunk) => void;
  onTogglePin: (chunk: Chunk) => void;
  onToggleExclude: (chunk: Chunk) => void;
  pinnedIds: Set<string>;
  excludedIds: Set<string>;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {documents.map((entry) => (
        <DocumentItem
          key={entry.document.id}
          entry={entry}
          selectedChunkId={selectedChunkId}
          citedChunkIds={citedChunkIds}
          onSelectChunk={onSelectChunk}
          onSelectDocument={onSelectDocument}
          onAddPassage={onAddPassage}
          onEditPassage={onEditPassage}
          onDeletePassage={onDeletePassage}
          onMovePassage={onMovePassage}
          onTogglePin={onTogglePin}
          onToggleExclude={onToggleExclude}
          pinnedIds={pinnedIds}
          excludedIds={excludedIds}
        />
      ))}
    </ul>
  );
}

function DocumentItem({
  entry,
  selectedChunkId,
  citedChunkIds,
  onSelectChunk,
  onSelectDocument,
  onAddPassage,
  onEditPassage,
  onDeletePassage,
  onMovePassage,
  onTogglePin,
  onToggleExclude,
  pinnedIds,
  excludedIds,
}: {
  entry: ExplorerDocument;
  selectedChunkId: string | null;
  citedChunkIds: string[];
  onSelectChunk: (chunk: Chunk) => void;
  onSelectDocument?: (document: DocumentRecord) => void;
  onAddPassage: (document: DocumentRecord) => void;
  onEditPassage: (chunk: Chunk) => void;
  onDeletePassage: (chunk: Chunk) => void;
  onMovePassage: (chunk: Chunk) => void;
  onTogglePin: (chunk: Chunk) => void;
  onToggleExclude: (chunk: Chunk) => void;
  pinnedIds: Set<string>;
  excludedIds: Set<string>;
}) {
  const [open, setOpen] = React.useState(true);
  const passageCount = entry.chapters.reduce(
    (total, chapter) => total + (entry.passages.get(chapter.id)?.length ?? 0),
    0
  );

  return (
    <li>
      <div className="group/document flex items-center gap-1 rounded-[8px] pr-1 transition-colors hover:bg-stone-mist/40">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Collapse" : "Expand"}
          className="flex size-5 shrink-0 items-center justify-center rounded text-pebble transition-colors hover:text-charcoal"
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
        </button>

        <button
          type="button"
          onClick={() => onSelectDocument?.(entry.document)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          <FileTextIcon className="size-3.5 shrink-0 text-bark-grey" />
          <span className="truncate text-[13px] font-medium text-charcoal">
            {entry.document.name}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-pebble">
            {passageCount}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Actions for ${entry.document.name}`}
                className="flex size-5 shrink-0 items-center justify-center rounded-[5px] text-pebble opacity-0 transition-opacity hover:bg-stone-mist/60 hover:text-charcoal focus-visible:opacity-100 group-hover/document:opacity-100"
              >
                <MoreHorizontalIcon className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onAddPassage(entry.document)}>
              <PlusIcon className="mr-2 size-3.5" />
              Add a passage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <ul className="flex flex-col gap-0.5">
          {entry.chapters.map((chapter) => {
            const passages = entry.passages.get(chapter.id) ?? [];
            return (
              <li key={chapter.id}>
                <div className="flex items-center gap-1.5 py-1 text-[12px] text-bark-grey" style={{ paddingLeft: 22 }}>
                  <FolderIcon className="size-3 shrink-0 text-pebble" />
                  <span className="truncate">{chapter.name}</span>
                  <span className="font-mono text-[10px] text-pebble">
                    {passages.length}
                  </span>
                </div>

                <ul className="flex flex-col gap-0.5">
                  {passages.map((chunk) => {
                    const isSelected = chunk.id === selectedChunkId;
                    const isPinned = pinnedIds.has(chunk.id);
                    const isExcluded = excludedIds.has(chunk.id);
                    const citationIndex = citedChunkIds.indexOf(chunk.id);

                    return (
                      <li key={chunk.id}>
                        <div
                          className={cn(
                            "group/chunk flex items-center gap-1 rounded-[8px] pr-1 transition-colors",
                            isSelected
                              ? "bg-stone-mist/70"
                              : "hover:bg-stone-mist/40"
                          )}
                          style={{ paddingLeft: 30 }}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectChunk(chunk)}
                            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                isExcluded
                                  ? "bg-alarm-red"
                                  : isPinned
                                    ? "bg-lichen-green"
                                    : "bg-pebble/50"
                              )}
                            />
                            <span
                              className={cn(
                                "truncate font-mono text-[12px]",
                                isSelected
                                  ? "font-semibold text-charcoal"
                                  : isExcluded
                                    ? "text-pebble line-through"
                                    : "text-bark-grey"
                              )}
                            >
                              {chunk.fileName ??
                                `${String(chunk.index + 1).padStart(3, "0")}.md`}
                            </span>
                          </button>

                          {citationIndex >= 0 && (
                            <span className="shrink-0 rounded-[4px] bg-electric-indigo/10 px-1 font-mono text-[9px] text-electric-indigo">
                              {citationIndex + 1}
                            </span>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  aria-label={`Actions for passage ${chunk.index + 1}`}
                                  className="flex size-5 shrink-0 items-center justify-center rounded-[5px] text-pebble opacity-0 transition-opacity hover:bg-stone-mist/60 hover:text-charcoal focus-visible:opacity-100 group-hover/chunk:opacity-100"
                                >
                                  <MoreHorizontalIcon className="size-3.5" />
                                </button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => onEditPassage(chunk)}>
                                <PencilIcon className="mr-2 size-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onMovePassage(chunk)}>
                                <FolderIcon className="mr-2 size-3.5" />
                                Move to chapter
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onTogglePin(chunk)}
                              >
                                <PinIcon className="mr-2 size-3.5" />
                                {isPinned ? "Unpin" : "Pin"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onToggleExclude(chunk)}
                              >
                                <EyeOffIcon className="mr-2 size-3.5" />
                                {isExcluded ? "Include" : "Exclude"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDeletePassage(chunk)}
                              >
                                <Trash2Icon className="mr-2 size-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
