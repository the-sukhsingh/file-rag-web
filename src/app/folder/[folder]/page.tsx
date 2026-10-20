"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { SettingsDialog } from "@/components/layout/settings-dialog";
import { TopNav } from "@/components/layout/top-nav";
import { ImportPdfDialog } from "@/components/library/import-pdf-dialog";
import {
  LibraryTree,
  buildTree,
  documentsInFolder,
  homeFolderId,
} from "@/components/library/library-tree";
import { MovePicker } from "@/components/library/move-picker";
import { useLibrary } from "@/components/library/library-provider";
import { useSettings } from "@/components/library/settings-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentRecord, Folder } from "@/lib/library/types";
import { pluralize } from "@/lib/utils";

/**
 * The folder.
 *
 * This is where a folder is managed: what is in it, what can be added to it,
 * and where each thing can be moved. The chat lives one step further in, at
 * `/folder/<id>/chat`, so that "tidy the folder" and "ask the folder" stay
 * separate jobs.
 */
export default function FolderPage() {
  const params = useParams<{ folder: string }>();
  const router = useRouter();
  const library = useLibrary();
  const settings = useSettings();

  const folderId = params?.folder ?? "";
  const folder = library.getFolder(folderId);

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [folderToRename, setFolderToRename] = React.useState<Folder | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [folderToDelete, setFolderToDelete] = React.useState<Folder | null>(null);
  const [folderToMove, setFolderToMove] = React.useState<Folder | null>(null);
  const [documentToMove, setDocumentToMove] = React.useState<DocumentRecord | null>(
    null
  );
  const [documentToDelete, setDocumentToDelete] =
    React.useState<DocumentRecord | null>(null);

  const tree = React.useMemo(
    () => buildTree(library.folders, library.documents, library.summaries),
    [library.folders, library.documents, library.summaries]
  );

  const summary = library.summaries.get(folderId);

  const documents = React.useMemo(
    () => documentsInFolder(folderId, library.folders, library.documents),
    [library.documents, library.folders, folderId]
  );

  if (!library.ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner className="size-5 text-electric-indigo" />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-[16px] bg-warm-bone text-bark-grey">
          <FolderIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[20px] font-semibold text-charcoal">
            That folder is gone
          </h1>
          <p className="max-w-[40ch] text-[14px] text-bark-grey">
            It may have been deleted. Head back to the library to pick another
            one.
          </p>
        </div>
        <Link href="/">
          <Button className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet">
            Back to the library
          </Button>
        </Link>
      </div>
    );
  }

  const ancestors = collectAncestors(folder, library.folders);
  const passageCount = summary?.passageCount ?? 0;
  const canChat = passageCount > 0;

  /**
   * The sub-folders the reader made. The containers an import creates are not
   * among them - a document is not a sub-folder.
   */
  const children = library
    .childFolders(folder.id)
    .filter(
      (child) => !library.documents.some((doc) => doc.folderId === child.id)
    );

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        active="folder"
        hasKey={settings.hasKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        middle={
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
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
            </nav>

            <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] text-pebble sm:flex">
              <span className="h-3 w-px bg-stone-mist" />
              {pluralize(documents.length, "document")} ·{" "}
              {pluralize(passageCount, "passage")}
            </span>
          </div>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsNewFolderOpen(true)}
              className="h-8 gap-1 px-2.5 font-mono text-[10px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
            >
              <FolderPlusIcon className="size-3.5" />
              Sub-folder
            </Button>

            <Button
              size="xs"
              onClick={() => router.push(`/folder/${folder.id}/chat`)}
              disabled={!canChat}
              className="h-8 gap-1 rounded-[8px] bg-electric-indigo px-3 font-mono text-[10px] uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet disabled:opacity-40"
            >
              <MessageSquareIcon className="size-3" />
              Ask
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Actions for ${folder.name}`}
                    className="flex size-8 items-center justify-center rounded-[8px] text-bark-grey transition-colors hover:bg-stone-mist/60 hover:text-charcoal"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setFolderToMove(folder)}>
                  <FolderIcon className="mr-2 size-3.5" />
                  Move folder
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setFolderToRename(folder);
                    setRenameValue(folder.name);
                  }}
                >
                  <PencilIcon className="mr-2 size-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setFolderToDelete(folder)}
                >
                  <Trash2Icon className="mr-2 size-3.5" />
                  Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* The tree */}
          <aside className="flex flex-col self-start rounded-[16px] border border-stone-mist bg-paper-white">
            <div className="border-b border-stone-mist px-4 py-3">
              <span className="tag-label text-bark-grey">Library</span>
            </div>
            <nav className="p-2">
              {tree.length === 0 ? (
                <p className="px-2 py-6 text-center text-[12px] text-bark-grey">
                  No folders yet.
                </p>
              ) : (
                <LibraryTree
                  nodes={tree}
                  activeFolderId={folder.id}
                  onOpenFolder={(id) => router.push(`/folder/${id}`)}
                  onRenameFolder={(target) => {
                    setFolderToRename(target);
                    setRenameValue(target.name);
                  }}
                  onDeleteFolder={setFolderToDelete}
                  onNewSubfolder={() => setIsNewFolderOpen(true)}
                />
              )}
            </nav>
          </aside>

          {/* What is in the folder */}
          <section className="flex flex-col gap-6">
            {documents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-stone-mist bg-paper-white px-6 py-16 text-center">
                <span className="flex size-11 items-center justify-center rounded-[12px] bg-warm-bone text-bark-grey">
                  <UploadIcon className="size-5" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-[16px] font-semibold text-charcoal">
                    This folder is empty
                  </h2>
                  <p className="max-w-[42ch] text-[14px] leading-[1.5] text-bark-grey">
                    Import a PDF and it is split into chapters and passages
                    here. Or move a document in from another folder.
                  </p>
                </div>
                <Button
                  onClick={() => setIsImportOpen(true)}
                  className="mt-1 h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
                >
                  <UploadIcon className="size-3.5" />
                  Import a PDF
                </Button>
              </div>
            ) : (
              <div className="flex flex-col overflow-hidden rounded-[16px] border border-stone-mist bg-paper-white">
                <div className="flex items-center justify-between border-b border-stone-mist px-5 py-3.5">
                  <span className="tag-label text-bark-grey">
                    {pluralize(documents.length, "document")}
                  </span>
                  <span className="font-mono text-[11px] text-pebble">
                    {pluralize(passageCount, "passage")}
                  </span>
                </div>

                <ul className="flex flex-col divide-y divide-stone-mist">
                  {documents.map((document) => {
                    const chapters = library.chaptersOf(document.id);

                    return (
                      <li
                        key={document.id}
                        className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-warm-bone"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-warm-bone text-bark-grey">
                          <FileTextIcon className="size-4" />
                        </span>

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate text-[14px] font-medium text-charcoal">
                            {document.name}
                          </span>
                          <span className="truncate font-mono text-[11px] text-bark-grey">
                            {pluralize(document.chunkCount, "passage")} ·{" "}
                            {pluralize(document.pageCount, "page")} ·{" "}
                            {pluralize(chapters.length, "chapter")}
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                aria-label={`Actions for ${document.name}`}
                                className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-pebble opacity-0 transition-opacity hover:bg-stone-mist hover:text-charcoal focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <MoreHorizontalIcon className="size-4" />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => setDocumentToMove(document)}
                            >
                              <FolderIcon className="mr-2 size-3.5" />
                              Move to folder
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDocumentToDelete(document)}
                            >
                              <Trash2Icon className="mr-2 size-3.5" />
                              Delete document
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* The sub-folders */}
            {children.length > 0 && (
              <div className="flex flex-col overflow-hidden rounded-[16px] border border-stone-mist bg-paper-white">
                <div className="border-b border-stone-mist px-5 py-3.5">
                  <span className="tag-label text-bark-grey">Sub-folders</span>
                </div>
                <ul className="flex flex-col divide-y divide-stone-mist">
                  {children.map((child) => {
                    const childSummary = library.summaries.get(child.id);
                    return (
                      <li
                        key={child.id}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-warm-bone"
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/folder/${child.id}`)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <FolderIcon className="size-4 shrink-0 text-electric-indigo" />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-charcoal">
                            {child.name}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-pebble">
                            {pluralize(
                              childSummary?.documentCount ?? 0,
                              "document"
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ---- Dialogs -------------------------------------------------- */}

      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const name = newFolderName.trim();
              if (!name) return;
              await library.createFolder(name, folder.id);
              setNewFolderName("");
              setIsNewFolderOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-display text-[24px] font-normal">
                New sub-folder
              </DialogTitle>
              <DialogDescription>
                Inside {folder.name}. A folder is what you chat with.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4">
              <Label htmlFor="sub-folder-name" className="text-[13px] font-medium">
                Name
              </Label>
              <Input
                id="sub-folder-name"
                autoFocus
                required
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="e.g. Chapter drafts"
                className="h-10 rounded-[12px]"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewFolderOpen(false)}
                className="h-9 rounded-[8px] px-4 text-[13px] font-semibold uppercase tracking-[0.04em]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
              >
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(folderToRename)}
        onOpenChange={(open) => !open && setFolderToRename(null)}
      >
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!folderToRename) return;
              const name = renameValue.trim();
              if (!name) return;
              await library.renameFolder(folderToRename.id, name);
              setFolderToRename(null);
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-display text-[24px] font-normal">
                Rename folder
              </DialogTitle>
              <DialogDescription>
                The documents and passages inside are kept.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4">
              <Label htmlFor="rename-folder" className="text-[13px] font-medium">
                Name
              </Label>
              <Input
                id="rename-folder"
                autoFocus
                required
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className="h-10 rounded-[12px]"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFolderToRename(null)}
                className="h-9 rounded-[8px] px-4 text-[13px] font-semibold uppercase tracking-[0.04em]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
              >
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(folderToMove)}
        onOpenChange={(open) => !open && setFolderToMove(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-[24px] font-normal">
              Move folder
            </DialogTitle>
            <DialogDescription>
              Choose where {folderToMove?.name} should live. Everything inside
              it moves too.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <MovePicker
              folders={library.folders}
              documents={library.documents}
              summaries={library.summaries}
              currentFolderId={folderToMove?.id}
              excludeIds={
                folderToMove
                  ? [
                      folderToMove.id,
                      ...descendantIds(folderToMove.id, library.folders),
                    ]
                  : []
              }
              onPick={(targetId) => {
                if (!folderToMove) return;
                void library.moveFolderTo(
                  folderToMove.id,
                  targetId === "" ? null : targetId
                );
                setFolderToMove(null);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsImportOpen(true)}
              className="h-8 gap-1 px-2.5 font-mono text-[10px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
            >
              <UploadIcon className="size-3.5" />
              Import
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsNewFolderOpen(true)}
              className="h-8 gap-1 px-2.5 font-mono text-[10px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
            >
              <FolderPlusIcon className="size-3.5" />
              Sub-folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(documentToMove)}
        onOpenChange={(open) => !open && setDocumentToMove(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-[24px] font-normal">
              Move document
            </DialogTitle>
            <DialogDescription>
              Choose where {documentToMove?.name} should live.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <MovePicker
              folders={library.folders}
              documents={library.documents}
              summaries={library.summaries}
              currentFolderId={
                documentToMove
                  ? containerOf(documentToMove, library.folders)
                  : null
              }
              onPick={(targetId) => {
                if (!documentToMove || !targetId) return;
                void library.moveDocumentTo(documentToMove.id, targetId);
                setDocumentToMove(null);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDocumentToMove(null)}
              className="h-9 rounded-[8px] px-4 text-[13px] font-semibold uppercase tracking-[0.04em]"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(folderToDelete)}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{folderToDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {folderToDelete &&
                describeContents(library.contentsOf(folderToDelete.id))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFolderToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!folderToDelete) return;
                const wasHere = folderToDelete.id === folderId;
                await library.removeFolder(folderToDelete.id);
                setFolderToDelete(null);
                if (wasHere) router.push("/");
              }}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(documentToDelete)}
        onOpenChange={(open) => !open && setDocumentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{documentToDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete
                ? `The document and its ${pluralize(
                    documentToDelete.chunkCount,
                    "passage"
                  )} will be removed from this device. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDocumentToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!documentToDelete) return;
                await library.removeDocument(documentToDelete.id);
                setDocumentToDelete(null);
              }}
            >
              Delete document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <ImportPdfDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        folderName={folder.name}
        onImport={async (file, onProgress) => {
          const result = await library.importPdf(file, folder.id, onProgress);
          return result;
        }}
      />
    </div>
  );
}

/**
 * The folders above this one, root first.
 */
function collectAncestors(folder: Folder, folders: Folder[]): Folder[] {
  const byId = new Map(folders.map((entry) => [entry.id, entry]));
  const ancestors: Folder[] = [];

  let current = folder.parentId ? byId.get(folder.parentId) : undefined;
  while (current) {
    ancestors.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return ancestors;
}

/**
 * The folder a document's container sits in.
 */
function containerOf(
  document: DocumentRecord,
  folders: Folder[]
): string | null {
  return homeFolderId(document, folders);
}

/**
 * The ids of a folder's descendants, so a folder is never moved inside
 * itself.
 */
function descendantIds(folderId: string, folders: Folder[]): string[] {
  const all = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (
        folder.parentId &&
        all.has(folder.parentId) &&
        !all.has(folder.id)
      ) {
        all.add(folder.id);
        changed = true;
      }
    }
  }
  return [...all];
}

/**
 * A plain sentence describing what a delete will take with it.
 */
function describeContents(contents: {
  folders: number;
  documents: number;
  passages: number;
}): string {
  const parts: string[] = [];
  if (contents.folders > 0) {
    parts.push(pluralize(contents.folders, "sub-folder"));
  }
  if (contents.documents > 0) {
    parts.push(pluralize(contents.documents, "document"));
  }
  if (contents.passages > 0) {
    parts.push(pluralize(contents.passages, "passage"));
  }

  if (!parts.length) {
    return "This folder is empty, so nothing else will be removed.";
  }

  return `${parts.join(", ")} will be removed from this device. This cannot be undone.`;
}
