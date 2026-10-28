"use client";

import * as React from "react";
import {
  ArrowUpRightIcon,
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
  const selectedCount = documents.filter((document) => !excludedIds.has(document.id)).length;
  const visibleDocuments = documents
    .filter((document) => document.fileName.toLowerCase().includes(query.trim().toLowerCase()))
    .toSorted((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-5 pt-5 pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display-face text-[23px]">Your files</h2>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground" aria-label={`${documents.length} files`}>{documents.length.toString().padStart(2, "0")}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">The context for your conversation.</p>
        <button
          type="button"
          onClick={onPickFiles}
          disabled={!ready || !!upload || disabled}
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
          className={cn(
            "mt-5 flex h-10 w-full items-center gap-2.5 rounded-lg border px-3.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            dragging ? "border-primary bg-primary/15 text-primary" : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {upload ? <Spinner className="size-3.5" /> : dragging ? <UploadIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
          <span>{upload ? "Adding your files…" : dragging ? "Drop to add files" : "Upload files"}</span>
          <ArrowUpRightIcon className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
        </button>
        <p className="mt-2.5 flex justify-between gap-2 text-[10px] text-muted-foreground"><span>PDF · up to 50 MB</span><span>or drag & drop</span></p>

        {upload && (
          <div className="mt-3 space-y-2" role="status">
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{upload.name}</span>
              <span className="shrink-0 tabular-nums">{upload.position}/{upload.total}</span>
            </div>
            <div role="progressbar" aria-label="Importing PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.percent} className="h-1 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${upload.percent}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-3 flex max-h-36 items-start gap-2 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
            <p className="min-w-0 flex-1 break-words whitespace-pre-line">{error}</p>
            <button type="button" onClick={onDismissError} aria-label="Dismiss upload error" className="mt-0.5 shrink-0 rounded-sm"><XIcon className="size-3.5" /></button>
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <div className="mx-5 shrink-0 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">In your library</span>
            <button type="button" disabled={disabled} onClick={onSelectAll} className="rounded-sm py-1 text-[10px] text-muted-foreground hover:text-primary disabled:opacity-50">
              {selectedCount === documents.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="relative mt-2">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-0 size-3.5 text-muted-foreground" />
            <input aria-label="Search files" placeholder="Find a file…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full border-b border-border bg-transparent pr-1 pl-6 text-[12px] outline-none placeholder:text-muted-foreground/80 focus:border-primary" />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
        {!ready ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground" role="status"><Spinner className="size-3" /> Loading your files…</div>
        ) : documents.length === 0 ? (
          <div className="border-t border-border pt-10 pb-6">
            <svg viewBox="0 0 112 96" fill="none" className="mb-6 h-24 w-28 text-primary" aria-hidden="true">
              <path d="m29 13 57 7-8 69-57-7 8-69Z" fill="var(--accent)" stroke="var(--border)" />
              <path d="m20 11 56-4 5 72-56 4-5-72Z" fill="var(--background)" stroke="var(--border)" />
              <path d="M30 14h40l12 12v59H30V14Z" fill="var(--surface)" stroke="currentColor" strokeOpacity=".35" />
              <path d="M70 14v12h12M40 41h29M40 47h23M40 53h27" stroke="currentColor" strokeOpacity=".3" />
              <path d="M40 66h14" stroke="currentColor" strokeWidth="2" />
              <path d="M8 89h89" stroke="var(--border)" />
            </svg>
            <p className="display-face text-[18px]">Nothing here. Yet.</p>
            <p className="mt-2 max-w-44 text-[11px] leading-5 text-muted-foreground">Add a PDF and turn a pile of pages into a conversation.</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="py-8 text-xs leading-5 text-muted-foreground">
            <p className="break-words">No files match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-primary underline underline-offset-4">Clear search</button>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {visibleDocuments.map((document) => {
              const selected = !excludedIds.has(document.id);
              return (
                <li key={document.id} className={cn("group relative -mx-2 flex items-start gap-2 py-4 pr-1 pl-2 transition-colors hover:bg-accent/40", selected && "before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-full before:bg-primary/60")}>
                  <label className="relative mt-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center">
                    <input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(document.id)} aria-label={`Use ${document.fileName} in chat`} className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    <span className="pointer-events-none flex size-3.5 items-center justify-center rounded-[3px] border border-input text-transparent transition-colors peer-checked:border-primary/35 peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50"><CheckIcon className="size-2.5" strokeWidth={2.5} /></span>
                  </label>
                  <button type="button" onClick={() => onPreview(document)} title={document.fileName} className="min-w-0 flex-1 rounded-sm text-left">
                    <span className={cn("block truncate text-[12px] leading-6 font-medium transition-colors group-hover:text-primary", !selected && "text-muted-foreground")}>{document.fileName}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="font-mono text-[9px] tracking-wide">PDF</span><span aria-hidden="true">·</span>
                      <span>{document.pageCount} {document.pageCount === 1 ? "page" : "pages"}</span>
                      {!document.chunkCount && <span className="w-full">No readable text</span>}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<button type="button" aria-label={`Manage ${document.fileName}`} className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"><MoreHorizontalIcon className="size-3.5" /></button>} />
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

      {documents.length > 0 && (
        <p className="mx-5 flex shrink-0 items-start gap-2 py-3 text-[11px] leading-5 text-muted-foreground" role="status">
          {indexing ? <Spinner className="mt-1 size-3 shrink-0" /> : <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", selectedCount ? "bg-primary" : "bg-muted-foreground/50")} aria-hidden="true" />}
          {indexing ? `Improving search · ${indexing.done} of ${indexing.total}` : `${selectedCount} of ${documents.length} files selected for chat`}
        </p>
      )}
    </div>
  );
}
