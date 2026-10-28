"use client";

import * as React from "react";
import {
  CheckIcon,
  FileTextIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";

import { ModeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
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
  onOpenSettings,
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
  onOpenSettings: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const selectedCount = documents.filter((document) => !excludedIds.has(document.id)).length;
  const visibleDocuments = documents
    .filter((document) => document.fileName.toLowerCase().includes(query.trim().toLowerCase()))
    .toSorted((a, b) => b.createdAt - a.createdAt);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar" aria-label="Your files">
      <div className="flex h-20 shrink-0 items-center gap-2.5 px-6">
        <svg viewBox="0 0 32 32" fill="none" className="size-8 text-primary" aria-hidden="true">
          <path d="M7 5h13l6 6v15H7V5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M20 5v7h6M3 10v20h17M12 17h9M12 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-[25px] font-semibold tracking-[-0.055em]">quarry<span className="text-primary">.</span></span>
      </div>

      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={!ready || !!upload || disabled}
          onDragOver={(event) => {
            event.preventDefault();
            if (!upload && !disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!upload && !disabled) onFiles(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            "group flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-6 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            dragging ? "border-primary bg-primary/10" : "border-primary/25 bg-background/60 hover:border-primary/50 hover:bg-background"
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-primary shadow-xs transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none">
            {upload ? <Spinner className="size-4" /> : <UploadIcon className="size-4" strokeWidth={1.6} />}
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[13px] font-medium">{upload ? "Adding your files…" : dragging ? "Drop to add files" : "Upload files"}</span>
            <span className="text-[11px] text-muted-foreground">PDFs up to 50 MB · or drag & drop</span>
          </span>
        </button>

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

      <div className="mt-7 flex items-center justify-between px-5">
        <h2 className="text-[12px] font-medium text-muted-foreground">Your files <span className="ml-1.5 font-mono text-[10px]">{documents.length.toString().padStart(2, "0")}</span></h2>
        {documents.length > 0 && (
          <button type="button" disabled={disabled} onClick={onSelectAll} className="text-[11px] text-muted-foreground hover:text-primary disabled:opacity-50">
            {selectedCount === documents.length ? "Deselect all" : "Select all"}
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <div className="relative mx-4 mt-3">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
          <input aria-label="Search files" placeholder="Search files…" value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 w-full rounded-lg border border-transparent bg-background/70 pr-3 pl-8 text-[12px] outline-none placeholder:text-muted-foreground focus:border-input" />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!ready ? (
          <div className="flex items-center gap-2 px-2 py-6 text-xs text-muted-foreground" role="status"><Spinner className="size-3" /> Loading your files…</div>
        ) : documents.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <FileTextIcon className="mx-auto mb-3 size-6 text-muted-foreground/40" strokeWidth={1.2} />
            <p className="text-[12px] text-muted-foreground">A home for your documents.</p>
            <p className="mt-1 text-[11px] text-muted-foreground/75">Files you add will appear here.</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            <p>No files match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-primary underline underline-offset-4">Clear search</button>
          </div>
        ) : (
          <ul className="space-y-1">
            {visibleDocuments.map((document) => {
              const selected = !excludedIds.has(document.id);
              return (
                <li key={document.id} className={cn("group flex items-center gap-2 rounded-lg px-2 py-3 transition-colors", selected ? "bg-accent/60" : "hover:bg-accent/50")}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background text-primary/75"><FileTextIcon className="size-4" strokeWidth={1.5} /></span>
                  <button type="button" onClick={() => onPreview(document)} title={document.fileName} className="min-w-0 flex-1 rounded-sm text-left">
                    <span className="block truncate text-[12px] font-medium">{document.fileName}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{document.pageCount} {document.pageCount === 1 ? "page" : "pages"} <span className="mx-1">·</span> {document.chunkCount ? "Ready" : "No readable text"}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<button type="button" aria-label={`Manage ${document.fileName}`} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background"><MoreHorizontalIcon className="size-3.5" /></button>} />
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuItem onClick={() => onPreview(document)}><FileTextIcon /> View extracted text</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" disabled={disabled} onClick={() => onRemove(document)}><Trash2Icon /> Remove file</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <label className="relative flex size-6 shrink-0 cursor-pointer items-center justify-center">
                    <input type="checkbox" checked={selected} disabled={disabled} onChange={() => onToggle(document.id)} aria-label={`Use ${document.fileName} in chat`} className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
                    <span className="pointer-events-none flex size-4 items-center justify-center rounded-[5px] border border-input bg-background text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50"><CheckIcon className="size-3" strokeWidth={2.5} /></span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {documents.length > 0 && (
        <p className="px-5 pb-4 text-[11px] leading-5 text-muted-foreground" role="status">
          {indexing ? `Improving search · ${indexing.done} of ${indexing.total}` : `${selectedCount} of ${documents.length} files selected for chat`}
        </p>
      )}
      <div className="mx-4 shrink-0 border-t border-border/80 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onOpenSettings} className="h-9 justify-start gap-2 px-2 text-[12px] font-normal text-muted-foreground"><Settings2Icon className="size-3.5" /> Settings</Button>
          <ModeToggle />
        </div>
        <p className="mt-3 flex items-center gap-1.5 px-2 text-[10px] text-muted-foreground"><HardDriveIcon className="size-3" /> Library saved in this browser</p>
      </div>
    </aside>
  );
}
