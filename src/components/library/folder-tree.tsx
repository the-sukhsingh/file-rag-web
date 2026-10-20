"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { cn } from "cn";

import type { DocumentRecord, Folder } from "@/lib/library/types";

/**
 * The folder tree.
 *
 * Folders nest, documents sit at the bottom, and the tree is the map of the
 * library: clicking a folder opens it, clicking a document opens the folder
 * it lives in.
 */

export interface TreeNode {
  folder: Folder;
  children: TreeNode[];
  documents: DocumentRecord[];
}

export function buildTree(
  folders: Folder[],
  documents: DocumentRecord[]
): TreeNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
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
        children: build(folder.id),
        documents: (documentsByFolder.get(folder.id) ?? []).sort(
          (a, b) => b.createdAt - a.createdAt
        ),
      }));

  return build(null);
}

const ACCENT_STROKE: Record<NonNullable<Folder["accent"]>, string> = {
  indigo: "text-electric-indigo",
  terracotta: "text-terracotta",
  teal: "text-tide-teal",
  green: "text-lichen-green",
};

export function FolderTree({
  nodes,
  activeFolderId,
  onOpenFolder,
  depth = 0,
}: {
  nodes: TreeNode[];
  activeFolderId?: string;
  onOpenFolder: (folderId: string) => void;
  depth?: number;
}) {
  if (!nodes.length) return null;

  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <FolderTreeItem
          key={node.folder.id}
          node={node}
          activeFolderId={activeFolderId}
          onOpenFolder={onOpenFolder}
          depth={depth}
        />
      ))}
    </ul>
  );
}

function FolderTreeItem({
  node,
  activeFolderId,
  onOpenFolder,
  depth,
}: {
  node: TreeNode;
  activeFolderId?: string;
  onOpenFolder: (folderId: string) => void;
  depth: number;
}) {
  const [open, setOpen] = React.useState(depth < 1);
  const isActive = node.folder.id === activeFolderId;
  const hasChildren = node.children.length > 0 || node.documents.length > 0;

  return (
    <li>
      <div
        className={cn(
          "group/folder flex items-center gap-1 rounded-[8px] pr-1 transition-colors",
          isActive ? "bg-stone-mist/70" : "hover:bg-stone-mist/40"
        )}
        style={{ paddingLeft: depth * 14 }}
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
              "truncate text-[14px]",
              isActive
                ? "font-semibold text-charcoal"
                : "text-charcoal/80 group-hover/folder:text-charcoal"
            )}
          >
            {node.folder.name}
          </span>
          {node.documents.length > 0 && (
            <span className="ml-auto shrink-0 font-mono text-[11px] text-pebble">
              {node.documents.length}
            </span>
          )}
        </button>
      </div>

      {open && (node.children.length > 0 || node.documents.length > 0) && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.folder.id}
              node={child}
              activeFolderId={activeFolderId}
              onOpenFolder={onOpenFolder}
              depth={depth + 1}
            />
          ))}
          {node.documents.map((document) => (
            <li key={document.id}>
              <div
                className="group/document flex items-center gap-2 rounded-[8px] py-1.5 pr-2 transition-colors hover:bg-stone-mist/40"
                style={{ paddingLeft: depth * 14 + 26 }}
              >
                <FileTextIcon className="size-3.5 shrink-0 text-pebble" />
                <span className="truncate text-[13px] text-bark-grey">
                  {document.name}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-pebble">
                  {document.chunkCount}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
