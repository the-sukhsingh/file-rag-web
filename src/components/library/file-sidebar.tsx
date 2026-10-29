"use client";

import * as React from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentRecord, FileGroup } from "@/lib/library/types";

export type UploadState = { name: string; percent: number; position: number; total: number };

export function FileSidebar({
  documents,
  groups = [],
  ready,
  excludedIds,
  onToggle,
  onToggleGroup,
  onSelectGroupOnly,
  onSelectAll,
  onPreview,
  onRemove,
  onPickFiles,
  onFiles,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onMoveDocumentToGroup,
  upload,
  error,
  onDismissError,
  disabled,
  indexing,
}: {
  documents: DocumentRecord[];
  groups?: FileGroup[];
  ready: boolean;
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleGroup?: (groupId: string | null) => void;
  onSelectGroupOnly?: (groupId: string | null) => void;
  onSelectAll: () => void;
  onPreview: (document: DocumentRecord) => void;
  onRemove: (document: DocumentRecord) => void;
  onPickFiles: (groupId?: string | null) => void;
  onFiles: (files: File[], groupId?: string | null) => void;
  onCreateGroup?: (name: string) => Promise<void>;
  onRenameGroup?: (groupId: string, name: string) => Promise<void>;
  onDeleteGroup?: (groupId: string) => Promise<void>;
  onMoveDocumentToGroup?: (documentId: string, groupId: string | null) => Promise<void>;
  upload: UploadState | null;
  error: string | null;
  onDismissError: () => void;
  disabled: boolean;
  indexing: { done: number; total: number } | null;
}) {
  const [query, setQuery] = React.useState("");
  const [draggingGlobal, setDraggingGlobal] = React.useState(false);
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null | undefined>(undefined);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [renamingGroupId, setRenamingGroupId] = React.useState<string | null>(null);
  const [renamingName, setRenamingName] = React.useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = React.useState<Set<string>>(new Set());
  const [groupPendingDelete, setGroupPendingDelete] = React.useState<FileGroup | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = React.useState(false);

  const newGroupInputRef = React.useRef<HTMLInputElement>(null);

  const selectedCount = documents.filter((document) => !excludedIds.has(document.id)).length;
  const normalizedQuery = query.trim().toLowerCase();

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery("");
  };

  const toggleGroupCollapse = (id: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroupSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newGroupName.trim();
    if (!name || !onCreateGroup) return;
    try {
      await onCreateGroup(name);
      setNewGroupName("");
      setIsCreatingGroup(false);
    } catch {
      // Ignored, user can retry
    }
  };

  const handleRenameSubmit = async (groupId: string) => {
    const name = renamingName.trim();
    if (!name || !onRenameGroup) {
      setRenamingGroupId(null);
      return;
    }
    try {
      await onRenameGroup(groupId, name);
    } finally {
      setRenamingGroupId(null);
    }
  };

  const handleDeleteGroupConfirm = async () => {
    if (!groupPendingDelete || !onDeleteGroup || isDeletingGroup) return;
    setIsDeletingGroup(true);
    try {
      await onDeleteGroup(groupPendingDelete.id);
      setGroupPendingDelete(null);
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // Group documents by groupId
  const groupMap = React.useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // Documents matching the query
  const matchingDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      if (!normalizedQuery) return true;
      const fileMatches = doc.fileName.toLowerCase().includes(normalizedQuery);
      const group = doc.groupId ? groupMap.get(doc.groupId) : undefined;
      const groupMatches = group ? group.name.toLowerCase().includes(normalizedQuery) : false;
      return fileMatches || groupMatches;
    });
  }, [documents, normalizedQuery, groupMap]);

  // Map of grouped docs
  const docsByGroup = React.useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    for (const group of groups) {
      map.set(group.id, []);
    }
    const ungrouped: DocumentRecord[] = [];

    for (const doc of matchingDocuments) {
      if (doc.groupId && map.has(doc.groupId)) {
        map.get(doc.groupId)!.push(doc);
      } else {
        ungrouped.push(doc);
      }
    }

    // Sort documents in each group by creation date descending
    for (const list of map.values()) {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    ungrouped.sort((a, b) => b.createdAt - a.createdAt);

    return { grouped: map, ungrouped };
  }, [groups, matchingDocuments]);

  // Automatically expand groups if there's a search query
  const isCollapsed = (groupId: string) => {
    if (normalizedQuery) return false;
    return collapsedGroupIds.has(groupId);
  };

  const renderFileRow = (document: DocumentRecord, isNested = false) => {
    const selected = !excludedIds.has(document.id);
    return (
      <li
        key={document.id}
        draggable={!disabled}
        onDragStart={(event) => {
          event.dataTransfer.setData("application/x-document-id", document.id);
          event.dataTransfer.effectAllowed = "move";
        }}
        className={cn(
          "group relative flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-accent/50",
          isNested && "ml-3 border-l border-border/40 pl-2 rounded-l-none"
        )}
      >
        <label className="relative flex size-5 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={() => onToggle(document.id)}
            aria-label={`Use ${document.fileName} in chat`}
            className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
          <span className="pointer-events-none flex size-3.5 items-center justify-center rounded-[3px] border border-input text-transparent transition-colors peer-checked:border-primary/35 peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50">
            <CheckIcon className="size-2.5" strokeWidth={2.5} />
          </span>
        </label>
        <button
          type="button"
          onClick={() => onPreview(document)}
          title={document.fileName}
          className="min-w-0 flex-1 rounded-sm py-0.5 text-left"
        >
          <span
            className={cn(
              "block truncate text-[12px] leading-5 font-medium transition-colors",
              selected ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {document.fileName}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
            <span>
              {document.pageCount} {document.pageCount === 1 ? "page" : "pages"}
            </span>
            {!document.chunkCount && (
              <>
                <span aria-hidden="true">·</span>
                <span>No readable text</span>
              </>
            )}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`Manage ${document.fileName}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-background hover:text-foreground max-md:opacity-100"
              >
                <MoreHorizontalIcon className="size-3.5" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => onPreview(document)}>
              <FileTextIcon /> View extracted text
            </DropdownMenuItem>
            {groups.length > 0 && onMoveDocumentToGroup && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderIcon /> Move to group
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {groups.map((group) => {
                    const isCurrent = document.groupId === group.id;
                    return (
                      <DropdownMenuItem
                        key={group.id}
                        disabled={isCurrent}
                        onClick={() => void onMoveDocumentToGroup(document.id, group.id)}
                      >
                        <FolderIcon className="text-primary/70" />
                        <span className="truncate">{group.name}</span>
                        {isCurrent && <CheckIcon className="ml-auto size-3.5" />}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!document.groupId}
                    onClick={() => void onMoveDocumentToGroup(document.id, null)}
                  >
                    <span>Remove from group</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={disabled} onClick={() => onRemove(document)}>
              <Trash2Icon /> Remove file
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    );
  };

  const renderGroup = (group: FileGroup) => {
    const groupDocs = docsByGroup.grouped.get(group.id) ?? [];
    const totalDocsInGroup = documents.filter((d) => d.groupId === group.id);
    const selectedGroupDocs = groupDocs.filter((doc) => !excludedIds.has(doc.id));
    const allSelected = groupDocs.length > 0 && selectedGroupDocs.length === groupDocs.length;
    const someSelected = selectedGroupDocs.length > 0 && selectedGroupDocs.length < groupDocs.length;
    const collapsed = isCollapsed(group.id);
    const isDragOver = dragOverGroupId === group.id;
    const isRenaming = renamingGroupId === group.id;

    return (
      <li
        key={group.id}
        className={cn(
          "rounded-lg transition-colors",
          isDragOver && "bg-primary/10 ring-1 ring-primary/30"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverGroupId(group.id);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverGroupId((prev) => (prev === group.id ? undefined : prev));
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverGroupId(undefined);
          const docId = e.dataTransfer.getData("application/x-document-id");
          if (docId && onMoveDocumentToGroup) {
            void onMoveDocumentToGroup(docId, group.id);
          } else if (e.dataTransfer.files.length > 0) {
            onFiles(Array.from(e.dataTransfer.files), group.id);
          }
        }}
      >
        <div className="group/group-row flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-accent/40">
          <button
            type="button"
            onClick={() => toggleGroupCollapse(group.id)}
            aria-label={collapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon
              className={cn("size-3.5 transition-transform duration-150", !collapsed && "rotate-90")}
            />
          </button>

          <label
            className="relative flex size-5 shrink-0 cursor-pointer items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              disabled={disabled || groupDocs.length === 0}
              onChange={() => onToggleGroup?.(group.id)}
              aria-label={`Select group ${group.name} for chat`}
              className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span
              className={cn(
                "pointer-events-none flex size-3.5 items-center justify-center rounded-[3px] border border-input text-transparent transition-colors",
                (allSelected || someSelected) && "border-primary/35 bg-primary/10 text-primary",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50"
              )}
            >
              {allSelected ? (
                <CheckIcon className="size-2.5" strokeWidth={2.5} />
              ) : someSelected ? (
                <MinusIcon className="size-2.5" strokeWidth={2.5} />
              ) : null}
            </span>
          </label>

          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-0.5 text-left"
            onClick={() => toggleGroupCollapse(group.id)}
          >
            {collapsed ? (
              <FolderIcon className="size-3.5 shrink-0 text-primary/80" />
            ) : (
              <FolderOpenIcon className="size-3.5 shrink-0 text-primary/80" />
            )}

            {isRenaming ? (
              <input
                autoFocus
                value={renamingName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRenamingName(e.target.value)}
                onBlur={() => void handleRenameSubmit(group.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameSubmit(group.id);
                  if (e.key === "Escape") setRenamingGroupId(null);
                }}
                className="h-5 min-w-0 flex-1 rounded bg-background px-1 text-[12px] font-medium text-foreground outline-none ring-1 ring-primary"
              />
            ) : (
              <span className="truncate text-[12px] font-medium text-foreground">{group.name}</span>
            )}

            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              {totalDocsInGroup.length}
            </span>
          </div>

          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/group-row:opacity-100 group-focus-within/group-row:opacity-100 focus-visible:opacity-100 max-md:opacity-100">
            <button
              type="button"
              title="Add files to group"
              aria-label={`Add files to ${group.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onPickFiles(group.id);
              }}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <PlusIcon className="size-3" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Manage group ${group.name}`}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-48">
                {groupDocs.length > 0 && onToggleGroup && (
                  <>
                    <DropdownMenuItem onClick={() => onToggleGroup(group.id)}>
                      <CheckIcon /> {allSelected ? "Deselect group files" : "Select all in group"}
                    </DropdownMenuItem>
                    {onSelectGroupOnly && (
                      <DropdownMenuItem onClick={() => onSelectGroupOnly(group.id)}>
                        <span>Select only this group</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setRenamingGroupId(group.id);
                    setRenamingName(group.name);
                  }}
                >
                  <PencilIcon /> Rename group
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setGroupPendingDelete(group)}
                >
                  <Trash2Icon /> Delete group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {!collapsed && (
          <ul className="mt-0.5 space-y-px">
            {groupDocs.length === 0 ? (
              <li className="py-1 pr-2 pl-7 text-[11px] text-muted-foreground/50 italic">
                No files here yet
              </li>
            ) : (
              groupDocs.map((doc) => renderFileRow(doc, true))
            )}
          </ul>
        )}
      </li>
    );
  };

  const renderUngroupedSection = () => {
    const ungroupedDocs = docsByGroup.ungrouped;
    if (groups.length === 0) {
      // If no groups exist, render flat list
      return (
        <ul className="space-y-px">
          {ungroupedDocs.map((doc) => renderFileRow(doc, false))}
        </ul>
      );
    }

    if (ungroupedDocs.length === 0) return null;

    const selectedUngrouped = ungroupedDocs.filter((doc) => !excludedIds.has(doc.id));
    const allSelected = ungroupedDocs.length > 0 && selectedUngrouped.length === ungroupedDocs.length;
    const someSelected = selectedUngrouped.length > 0 && selectedUngrouped.length < ungroupedDocs.length;
    const collapsed = isCollapsed("ungrouped");
    const isDragOver = dragOverGroupId === null;

    return (
      <li
        className={cn(
          "rounded-lg transition-colors",
          isDragOver && "bg-primary/10 ring-1 ring-primary/30"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverGroupId(null);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverGroupId((prev) => (prev === null ? undefined : prev));
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverGroupId(undefined);
          const docId = e.dataTransfer.getData("application/x-document-id");
          if (docId && onMoveDocumentToGroup) {
            void onMoveDocumentToGroup(docId, null);
          } else if (e.dataTransfer.files.length > 0) {
            onFiles(Array.from(e.dataTransfer.files), null);
          }
        }}
      >
        <div className="group/group-row flex items-center gap-1.5 rounded-lg px-1 py-1 transition-colors hover:bg-accent/40">
          <button
            type="button"
            onClick={() => toggleGroupCollapse("ungrouped")}
            aria-label={collapsed ? "Expand ungrouped files" : "Collapse ungrouped files"}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <ChevronRightIcon
              className={cn("size-3.5 transition-transform duration-150", !collapsed && "rotate-90")}
            />
          </button>

          <label
            className="relative flex size-5 shrink-0 cursor-pointer items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              disabled={disabled || ungroupedDocs.length === 0}
              onChange={() => onToggleGroup?.(null)}
              aria-label="Select ungrouped files for chat"
              className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
            <span
              className={cn(
                "pointer-events-none flex size-3.5 items-center justify-center rounded-[3px] border border-input text-transparent transition-colors",
                (allSelected || someSelected) && "border-primary/35 bg-primary/10 text-primary",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:opacity-50"
              )}
            >
              {allSelected ? (
                <CheckIcon className="size-2.5" strokeWidth={2.5} />
              ) : someSelected ? (
                <MinusIcon className="size-2.5" strokeWidth={2.5} />
              ) : null}
            </span>
          </label>

          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-0.5 text-left"
            onClick={() => toggleGroupCollapse("ungrouped")}
          >
            {collapsed ? (
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
            ) : (
              <FolderOpenIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
            )}
            <span className="truncate text-[12px] font-medium text-foreground">Ungrouped</span>
            <span className="text-[10px] text-muted-foreground/70 tabular-nums">
              {ungroupedDocs.length}
            </span>
          </div>

          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/group-row:opacity-100 group-focus-within/group-row:opacity-100 focus-visible:opacity-100 max-md:opacity-100">
            <button
              type="button"
              title="Add ungrouped files"
              aria-label="Add ungrouped files"
              onClick={(e) => {
                e.stopPropagation();
                onPickFiles(null);
              }}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <PlusIcon className="size-3" />
            </button>
          </div>
        </div>

        {!collapsed && (
          <ul className="mt-0.5 space-y-px">
            {ungroupedDocs.map((doc) => renderFileRow(doc, true))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragOver={(event) => {
        event.preventDefault();
        if (ready && !upload && !disabled) setDraggingGlobal(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingGlobal(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDraggingGlobal(false);
        if (ready && !upload && !disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="flex shrink-0 items-center gap-1 px-3 pb-1">
        <button
          type="button"
          onClick={() => onPickFiles()}
          disabled={!ready || !!upload || disabled}
          title="PDF files, up to 50 MB each"
          className={cn(
            "-ml-2 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            draggingGlobal ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/60"
          )}
        >
          {upload ? (
            <Spinner className="size-3.5" />
          ) : draggingGlobal ? (
            <UploadIcon className="size-3.5 text-primary" />
          ) : (
            <PlusIcon className="size-3.5 text-primary" />
          )}
          {upload ? `Adding ${upload.position}/${upload.total}` : draggingGlobal ? "Drop to add" : "Add files"}
        </button>

        {onCreateGroup && (
          <button
            type="button"
            onClick={() => {
              setIsCreatingGroup(true);
              setTimeout(() => newGroupInputRef.current?.focus(), 50);
            }}
            disabled={!ready || !!upload || disabled}
            title="Create a folder group"
            className="flex h-8 items-center gap-1 rounded-lg px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:opacity-40"
          >
            <FolderPlusIcon className="size-3.5 text-primary" />
            <span>New group</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {documents.length > 1 && (
            <button
              type="button"
              disabled={disabled}
              onClick={onSelectAll}
              className="rounded-md px-1.5 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              {selectedCount === documents.length ? "Deselect all" : "Select all"}
            </button>
          )}
          {documents.length > 0 && (
            <button
              type="button"
              aria-label={isSearchOpen ? "Close file search" : "Search files"}
              aria-expanded={isSearchOpen}
              onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
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
          <input
            autoFocus
            aria-label="Search files"
            placeholder="Find a file or group…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-full border-b border-border bg-transparent pr-1 pl-6 text-[12px] outline-none placeholder:text-muted-foreground/80 focus:border-primary"
          />
        </div>
      )}

      {isCreatingGroup && (
        <form
          onSubmit={(e) => void handleCreateGroupSubmit(e)}
          className="mx-3 my-1 flex items-center gap-1 rounded-lg border border-primary/30 bg-card px-2 py-1 shadow-xs"
        >
          <FolderIcon className="size-3.5 shrink-0 text-primary" />
          <input
            ref={newGroupInputRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsCreatingGroup(false);
                setNewGroupName("");
              }
            }}
            placeholder="Group name…"
            className="h-6 min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={!newGroupName.trim()}
            className="flex size-5 items-center justify-center rounded text-primary hover:bg-primary/10 disabled:opacity-40"
            aria-label="Save group"
          >
            <CheckIcon className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreatingGroup(false);
              setNewGroupName("");
            }}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            aria-label="Cancel"
          >
            <XIcon className="size-3" />
          </button>
        </form>
      )}

      {(upload || error) && (
        <div className="shrink-0 space-y-2 px-3 pt-2">
          {upload && (
            <div role="status">
              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span className="truncate">{upload.name}</span>
                <span className="shrink-0 tabular-nums">{upload.percent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Importing PDF"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={upload.percent}
                className="mt-1 h-0.5 overflow-hidden rounded-full bg-border"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${upload.percent}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex max-h-36 items-start gap-2 overflow-y-auto rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-[11px] leading-5 text-destructive"
            >
              <p className="min-w-0 flex-1 break-words whitespace-pre-line">{error}</p>
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss upload error"
                className="mt-0.5 shrink-0 rounded-sm"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-1">
        {!ready ? (
          <div className="flex items-center gap-2 px-1 py-6 text-xs text-muted-foreground" role="status">
            <Spinner className="size-3" /> Loading your files…
          </div>
        ) : documents.length === 0 && groups.length === 0 ? (
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
            <p className="mt-1.5 max-w-44 text-[11px] leading-5 text-muted-foreground">
              Add a PDF and turn a pile of pages into a conversation.
            </p>
          </div>
        ) : matchingDocuments.length === 0 && groups.length === 0 ? (
          <div className="px-1 py-8 text-[11px] leading-5 text-muted-foreground">
            <p className="break-words">No files match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-2 text-primary underline underline-offset-4">
              Clear search
            </button>
          </div>
        ) : (
          <ul className="space-y-1">
            {groups.map((group) => renderGroup(group))}
            {renderUngroupedSection()}
          </ul>
        )}
      </div>

      {indexing && (
        <p className="mx-3 flex shrink-0 items-center gap-2 py-2 text-[10px] text-muted-foreground" role="status">
          <Spinner className="size-3" /> Improving search · {indexing.done} of {indexing.total}
        </p>
      )}

      {/* Delete Group Confirmation Dialog */}
      <Dialog
        open={!!groupPendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeletingGroup) setGroupPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription className="break-words">
              “{groupPendingDelete?.name}” will be deleted. Any files inside will not be removed; they will become ungrouped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeletingGroup}
              onClick={() => setGroupPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeletingGroup}
              onClick={() => void handleDeleteGroupConfirm()}
            >
              {isDeletingGroup && <Spinner className="size-3.5" />} Delete group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
