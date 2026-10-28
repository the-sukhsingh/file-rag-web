"use client";

import * as React from "react";
import {
  CheckIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentRecord } from "@/lib/library/types";

export type UploadState = { name: string; percent: number; position: number; total: number };

export function FileSidebar({
  documents,
  ready,
  excludedIds,
  onToggle,
  onSelectAll,
  onPreview,
  onRemove,
  onPickFiles,
  onFiles,
  upload,
  error,
  onDismissError,
  disabled,
  indexing,
}: {
  documents: DocumentRecord[];
  ready: boolean;
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onPreview: (document: DocumentRecord) => void;
  onRemove: (document: DocumentRecord) => void;
  onPickFiles: () => void;
  onFiles: (files: File[]) => void;
  upload: UploadState | null;
  error: string | null;
  onDismissError: () => void;
  disabled: boolean;
  indexing: { done: number; total: number } | null;
}) {
  const [query, setQuery] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const selectedCount = documents.filter((document) => !excludedIds.has(document.id)).length;
  const visibleDocuments = documents
    .filter((document) => document.fileName.toLowerCase().includes(query.trim().toLowerCase()))
    .toSorted((a, b) => b.createdAt - a.createdAt);
  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery("");
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        if (ready && !upload && !disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (ready && !upload && !disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="flex shrink-0 items-center gap-1 px-3 pb-1">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={!ready || !!upload || disabled}
          title="PDF files, up to 50 MB each"
          className={cn(
            "-ml-2 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            dragging ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/60"
          )}
        >
          {upload ? <Spinner className="size-3.5" /> : dragging ? <UploadIcon className="size-3.5 text-primary" /> : <PlusIcon className="size-3.5 text-primary" />}
          {upload ? `Adding ${upload.position}/${upload.total}` : dragging ? "Drop to add" : "Add files"}
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {documents.length > 1 && (
            <button type="button" disabled={disabled} onClick={onSelectAll} className="rounded-md px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">
              {selectedCount === documents.length ? "Deselect all" : "Select all"}
            </button>
          )}
          {documents.length > 0 && (
            <button
              type="button"
              aria-label={isSearchOpen ? "Close file search" : "Search files"}
              aria-expanded={isSearchOpen}
              onClick={() => isSearchOpen ? closeSearch() : setIsSearchOpen(true)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            >
              {isSearchOpen ? <XIcon className="size-3.5" /> : <SearchIcon className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
      {isSearchOpen && (
        <div className="relative mx-3 mb-1 shrink-0">
          <SearchIcon className="pointer-events-none absolute top-2 left-0 size-3.5 text-muted-foreground/70" />
          <input autoFocus aria-label="Search files" placeholder="Find a file…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 w-full border-b border-border bg-transparent pr-1 pl-6 text-[12px] outline-none placeholder:text-muted-foreground/80 focus:border-primary" />
        </div>
      )}

      {(upload || error) && (
        <div className="shrink-0 space-y-2 px-3 pt-2">
          {upload && (
            <div role="status">
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{upload.name}</span>
                <span className="shrink-0 tabular-nums">{upload.percent}%</span>
              </div>
              <div role="progressbar" aria-label="Importing PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.percent} className="mt-1 h-0.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${upload.percent}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="flex max-h-36 items-start gap-2 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-[11px] leading-5 text-destructive">
              <p className="min-w-0 flex-1 break-words whitespace-pre-line">{error}</p>
              <button type="button" onClick={onDismissError} aria-label="Dismiss upload error" className="mt-0.5 shrink-0 rounded-sm"><XIcon className="size-3.5" /></button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-1">
        {!ready ? (
          <div className="flex items-center gap-2 px-1 py-6 text-xs text-muted-foreground" role="status"><Spinner className="size-3" /> Loading your files…</div>
        ) : documents.length === 0 ? (
          <div className="px-1 pt-8 pb-6">
            <svg viewBox="0 0 112 96" fill="none" className="mb-4 h-16 w-20 text-primary" aria-hidden="true">
              <path d="m29 13 57 7-8 69-57-7 8-69Z" fill="var(--accent)" stroke="var(--border)" />
              <path d="m20 11 56-4 5 72-56 4-5-72Z" fill="var(--background)" stroke="var(--border)" />
              <path d="M30 14h40l12 12v59H30V14Z" fill="var(--surface)" stroke="currentColor" strokeOpacity=".35" />
              <path d="M70 14v12h12M40 41h29M40 47h23M40 53h27" stroke="currentColor" strokeOpacity=".3" />
              <path d="M40 66h14" stroke="currentColor" strokeWidth="2" />
              <path d="M8 89h89" stroke="var(--border)" />
            </svg>
            <p className="display-face text-[17px]">Nothing here. Yet.</p>
            <p className="mt-1.5 max-w-44 text-[11px] leading-5 text-muted-foreground">Add a PDF and turn a pile of pages into a conversation.</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="px-1 py-8 text-[11px] leading-5 text-muted-foreground">
            <p className="break-words">No files match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-2 text-primary underline underline-offset-4">Clear search</button>
          </div>
        ) : (
          <ul className="space-y-px">
            {visibleDocuments.map((document) => {
              const selected = !excludedIds.has(document.id);
              return (
                <li key={document.id} className="group relative flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/50">
                  <label className="relative flex size-5 shrink-0 cursor-pointer items-center justify-center">
                    <input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(document.id)} aria-label={`Use ${document.fileName} in chat`} className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    <span className="pointer-events-none flex size-3.5 items-center justify-center rounded-[3px] border border-input text-transparent transition-colors peer-checked:border-primary/35 peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50"><CheckIcon className="size-2.5" strokeWidth={2.5} /></span>
                  </label>
                  <button type="button" onClick={() => onPreview(document)} title={document.fileName} className="min-w-0 flex-1 rounded-sm py-0.5 text-left">
                    <span className={cn("block truncate text-[12px] leading-5 font-medium transition-colors", selected ? "text-foreground" : "text-muted-foreground")}>{document.fileName}</span>
                    <span className="flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
                      <span>{document.pageCount} {document.pageCount === 1 ? "page" : "pages"}</span>
                      {!document.chunkCount && <><span aria-hidden="true">·</span><span>No readable text</span></>}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<button type="button" aria-label={`Manage ${document.fileName}`} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-background hover:text-foreground max-md:opacity-100"><MoreHorizontalIcon className="size-3.5" /></button>} />
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onClick={() => onPreview(document)}><FileTextIcon /> View extracted text</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" disabled={disabled} onClick={() => onRemove(document)}><Trash2Icon /> Remove file</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {indexing && (
        <p className="mx-3 flex shrink-0 items-center gap-2 py-2 text-[10px] text-muted-foreground" role="status">
          <Spinner className="size-3" /> Improving search · {indexing.done} of {indexing.total}
        </p>
      )}
    </div>
  );
}
