"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "cn";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FolderSummary } from "@/components/library/library-provider";
import type { DocumentRecord, Folder } from "@/lib/library/types";

/**
 * The folder tree.
 *
 * Only the folders the user made appear here. A document is a leaf under the
 * folder it was imported into, and the chapter folders that a document brings
 * with it stay out of sight - they are how the passages are stored, not
 * something the reader has to think about.
 */

export interface TreeNode {
  folder: Folder;
  summary: FolderSummary;
  children: TreeNode[];
  documents: DocumentRecord[];
}

/**
 * The folders that hold documents are the containers an import creates. They
 * are not shown as folders of their own, because the document inside them is
 * what the user put in the folder.
 */
function isDocumentContainer(
  folder: Folder,
  documents: DocumentRecord[]
): boolean {
  return documents.some((document) => document.folderId === folder.id);
}

export function buildTree(
  folders: Folder[],
  documents: DocumentRecord[],
  summaries: Map<string, FolderSummary>
): TreeNode[] {
  // The folders the user made: everything that is not a document container
  // and not a chapter inside one.
  const visible = folders.filter(
    (folder) => !isDocumentContainer(folder, documents)
  );

  const byParent = new Map<string | null, Folder[]>();
  for (const folder of visible) {
    const list = byParent.get(folder.parentId);
    if (list) list.push(folder);
    else byParent.set(folder.parentId, [folder]);
  }

  const documentsByFolder = new Map<string, DocumentRecord[]>();
  for (const document of documents) {
    const list = documentsByFolder.get(document.folderId);
    if (list) list.push(document);
    else documentsByFolder.set(document.folderId, [document]);
  }

  const build = (parentId: string | null): TreeNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((folder) => ({
        folder,
        summary: summaries.get(folder.id) ?? {
          folder,
          childCount: 0,
          documentCount: 0,
          passageCount: 0,
          updatedAt: folder.updatedAt,
        },
        children: build(folder.id),
        documents: (documentsByFolder.get(folder.id) ?? []).sort(
          (a, b) => b.createdAt - a.createdAt
        ),
      }));

  return build(null);
}

/**
 * The documents that live in a folder, whether they sit in it directly or in
 * a container the import created.
 */
export function documentsInFolder(
  folderId: string,
  folders: Folder[],
  documents: DocumentRecord[]
): DocumentRecord[] {
  const containers = new Set(
    folders
      .filter((folder) => folder.parentId === folderId)
      .map((folder) => folder.id)
  );

  return documents
    .filter(
      (document) =>
        document.folderId === folderId || containers.has(document.folderId)
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

const ACCENT_STROKE: Record<NonNullable<Folder["accent"]>, string> = {
  indigo: "text-electric-indigo",
  terracotta: "text-terracotta",
  teal: "text-tide-teal",
  green: "text-lichen-green",
};

export function LibraryTree({
  nodes,
  activeFolderId,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onNewSubfolder,
  onOpenDocument,
  className,
}: {
  nodes: TreeNode[];
  activeFolderId?: string;
  onOpenFolder: (folderId: string) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  onNewSubfolder?: (folder: Folder) => void;
  onOpenDocument?: (document: DocumentRecord) => void;
  className?: string;
}) {
  if (!nodes.length) return null;

  return (
    <ul className={cn("flex flex-col gap-0.5", className)}>
      {nodes.map((node) => (
        <TreeItem
          key={node.folder.id}
          node={node}
          activeFolderId={activeFolderId}
          onOpenFolder={onOpenFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onNewSubfolder={onNewSubfolder}
          onOpenDocument={onOpenDocument}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  activeFolderId,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onNewSubfolder,
  onOpenDocument,
}: {
  node: TreeNode;
  activeFolderId?: string;
  onOpenFolder: (folderId: string) => void;
  onRenameFolder?: (folder: Folder) => void;
  onDeleteFolder?: (folder: Folder) => void;
  onNewSubfolder?: (folder: Folder) => void;
  onOpenDocument?: (document: DocumentRecord) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const isActive = node.folder.id === activeFolderId;
  const hasChildren = node.children.length > 0 || node.documents.length > 0;

  return (
    <li>
      <div
        className={cn(
          "group/folder flex items-center gap-0.5 rounded-[8px] pr-1 transition-colors",
          isActive ? "bg-stone-mist/70" : "hover:bg-stone-mist/40"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? `Collapse ${node.folder.name}` : `Expand ${node.folder.name}`}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded text-pebble transition-colors hover:text-charcoal",
            !hasChildren && "pointer-events-none opacity-0"
          )}
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
          onClick={() => onOpenFolder(node.folder.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          {open ? (
            <FolderOpenIcon
              className={cn(
                "size-4 shrink-0",
                ACCENT_STROKE[node.folder.accent ?? "indigo"]
              )}
            />
          ) : (
            <FolderIcon
              className={cn(
                "size-4 shrink-0",
                ACCENT_STROKE[node.folder.accent ?? "indigo"]
              )}
            />
          )}
          <span
            className={cn(
              "truncate text-[13px]",
              isActive
                ? "font-semibold text-charcoal"
                : "text-charcoal/80 group-hover/folder:text-charcoal"
            )}
          >
            {node.folder.name}
          </span>
        </button>

        {node.summary.documentCount > 0 && (
          <span className="shrink-0 font-mono text-[10px] text-pebble">
            {node.summary.documentCount}
          </span>
        )}

        {(onRenameFolder || onDeleteFolder || onNewSubfolder) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Actions for ${node.folder.name}`}
                  className="flex size-5 shrink-0 items-center justify-center rounded-[5px] text-pebble opacity-0 transition-opacity hover:bg-stone-mist/60 hover:text-charcoal focus-visible:opacity-100 group-hover/folder:opacity-100"
                >
                  <MoreHorizontalIcon className="size-3.5" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onNewSubfolder?.(node.folder)}>
                <FolderPlusIcon className="mr-2 size-3.5" />
                New sub-folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRenameFolder?.(node.folder)}>
                <PencilIcon className="mr-2 size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteFolder?.(node.folder)}
              >
                <Trash2Icon className="mr-2 size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && hasChildren && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <TreeItem
              key={child.folder.id}
              node={child}
              activeFolderId={activeFolderId}
              onOpenFolder={onOpenFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onNewSubfolder={onNewSubfolder}
              onOpenDocument={onOpenDocument}
            />
          ))}

          {node.documents.map((document) => (
            <li key={document.id}>
              <button
                type="button"
                onClick={() => onOpenDocument?.(document)}
                className="group/document flex w-full items-center gap-2 rounded-[8px] py-1.5 pr-2 text-left transition-colors hover:bg-stone-mist/40"
                style={{ paddingLeft: 20 }}
              >
                <FileTextIcon className="size-3.5 shrink-0 text-pebble" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-bark-grey group-hover/document:text-charcoal">
                  {document.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-pebble">
                  {document.chunkCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
