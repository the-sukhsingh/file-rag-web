"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LayersIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { cn } from "cn";

import { SettingsDialog } from "@/components/layout/settings-dialog";
import { ProgressPopup } from "@/components/layout/progress-popup";
import { ShowcaseCard } from "@/components/layout/showcase-card";
import { TopNav } from "@/components/layout/top-nav";
import { ImportPdfDialog } from "@/components/library/import-pdf-dialog";
import { documentsInFolder } from "@/components/library/library-tree";
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
import type { Folder } from "@/lib/library/types";
import { onEmbeddingStatus } from "@/lib/retrieval/embeddings";
import { pluralize } from "@/lib/utils";

/**
 * The library.
 *
 * The folders are the front door: each one is a card that says what is in it
 * and where to go next. Managing a folder happens on its own page, so the
 * dashboard only has to answer one question - which folder do I want?
 */
export default function LibraryDashboard() {
  const router = useRouter();
  const library = useLibrary();
  const settings = useSettings();

  const [search, setSearch] = React.useState("");
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [newFolderParent, setNewFolderParent] = React.useState<string | null>(null);
  const [folderToRename, setFolderToRename] = React.useState<Folder | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [folderToDelete, setFolderToDelete] = React.useState<Folder | null>(null);
  const [folderToMove, setFolderToMove] = React.useState<Folder | null>(null);
  const [embedding, setEmbedding] = React.useState<{
    state: string;
    message?: string;
    percent?: number;
  }>({ state: "idle" });

  React.useEffect(
    () =>
      onEmbeddingStatus((next) =>
        setEmbedding({
          state: next.state,
          message: next.state === "loading" ? next.message : undefined,
          percent: next.state === "loading" ? next.progress : undefined,
        })
      ),
    []
  );

  /**
   * The top level of the library. A folder that sits inside another one is
   * reached through its parent, so the root is what the dashboard lists.
   */
  const rootFolders = React.useMemo(
    () =>
      library.folders
        .filter((folder) => folder.parentId === null)
        .filter((folder) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return (
            folder.name.toLowerCase().includes(query) ||
            folder.path.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [library.folders, search]
  );

  /**
   * The documents that sit at the library root, with no folder of their own.
   */
  const rootDocuments = React.useMemo(
    () => documentsInFolder(null, library.folders, library.documents),
    [library.folders, library.documents]
  );

  const stats = React.useMemo(() => {
    const chunks = library.documents.reduce(
      (total, document) => total + document.chunkCount,
      0
    );
    const pages = library.documents.reduce(
      (total, document) => total + document.pageCount,
      0
    );
    return {
      folders: library.folders.length,
      documents: library.documents.length,
      chunks,
      pages,
    };
  }, [library.folders, library.documents]);

  const handleImport = async (
    file: File,
    onProgress: (message: string, percent: number) => void
  ) => {
    const result = await library.importPdf(
      file,
      newFolderParent ?? null,
      onProgress
    );
    return result;
  };

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        active="library"
        hasKey={settings.hasKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewFolder={() => {
          setNewFolderParent(null);
          setNewFolderName("");
          setIsNewFolderOpen(true);
        }}
      />

      <main className="mx-auto w-full max-w-[1200px] px-6 pb-24">
        {/* ---- Hero ------------------------------------------------- */}
        <section className="flex flex-col items-center py-16 text-center">
          <p className="eyebrow">A private library for your documents</p>
          <h1 className="display-face mt-6 max-w-[16ch] text-[clamp(40px,7vw,80px)] text-charcoal">
            Ask your documents{" "}
            <em className="italic text-electric-indigo">anything</em>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[18px] leading-[1.56] text-bark-grey">
            Import a PDF. It is split into chapters and passages, indexed in
            your browser, and ready to answer questions - with your own API key.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              onClick={() => {
                setNewFolderParent(null);
                setNewFolderName("");
                setIsNewFolderOpen(true);
              }}
              variant="outline"
              className="h-11 rounded-[8px] border-stone-mist px-6 text-[14px] font-semibold uppercase tracking-[0.04em] text-charcoal hover:border-charcoal"
            >
              <FolderPlusIcon className="size-4" />
              New folder
            </Button>
            <Button
              onClick={() => {
                setNewFolderParent(null);
                setIsImportOpen(true);
              }}
              className="h-11 rounded-[8px] bg-electric-indigo px-6 text-[14px] font-semibold uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet"
            >
              <UploadIcon className="size-4" />
              Import PDF
            </Button>
          </div>
        </section>

        {/* ---- Stats bar -------------------------------------------- */}
        <section className="grid grid-cols-2 border-y border-stone-mist bg-paper-white md:grid-cols-4">
          {[
            { value: stats.folders, label: "Folders" },
            { value: stats.documents, label: "Documents" },
            { value: stats.chunks, label: "Passages indexed" },
            { value: stats.pages, label: "Pages read" },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-6 text-center",
                index > 0 && "border-l border-stone-mist"
              )}
            >
              <span className="font-numeric text-[24px] leading-[1.33] text-charcoal">
                {stat.value}
              </span>
              <span className="text-[12px] text-bark-grey">{stat.label}</span>
            </div>
          ))}
        </section>

        {/* ---- The folders ------------------------------------------ */}
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[20px] font-semibold text-charcoal">
                Your folders
              </h2>
              <p className="text-[14px] text-bark-grey">
                A folder is a set of documents you can ask questions of.
              </p>
            </div>

            {library.folders.length > 0 && (
              <div className="relative w-full sm:w-64">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-pebble" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a folder"
                  className="h-9 rounded-[10px] pl-8 text-[13px]"
                />
              </div>
            )}
          </div>

          {rootFolders.length === 0 && rootDocuments.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-4 rounded-[16px] border border-dashed border-stone-mist bg-paper-white px-6 py-20 text-center">
              <span className="flex size-12 items-center justify-center rounded-[16px] bg-warm-bone text-bark-grey">
                <FolderIcon className="size-6" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[16px] font-semibold text-charcoal">
                  {search ? "No folder matches that search" : "No folders yet"}
                </h3>
                <p className="max-w-[40ch] text-[14px] leading-[1.5] text-bark-grey">
                  {search
                    ? "Try a different name, or clear the search."
                    : "Create a folder, then import a PDF into it. The folder becomes the thing you chat with."}
                </p>
              </div>
              {!search && (
                <Button
                  onClick={() => {
                    setNewFolderParent(null);
                    setNewFolderName("");
                    setIsNewFolderOpen(true);
                  }}
                  className="mt-1 h-10 rounded-[8px] bg-electric-indigo px-5 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
                >
                  <FolderPlusIcon className="size-4" />
                  New folder
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rootFolders.map((folder) => {
                const summary = library.summaries.get(folder.id);
                const documentCount = summary?.documentCount ?? 0;
                const passageCount = summary?.passageCount ?? 0;
                const childCount = summary?.childCount ?? 0;

                return (
                  <article
                    key={folder.id}
                    className="group flex flex-col rounded-[16px] border border-stone-mist bg-paper-white transition-colors hover:border-electric-indigo/30"
                  >
                    <div className="flex items-start gap-3 p-5 pb-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-warm-bone text-electric-indigo">
                        <FolderIcon className="size-4.5" />
                      </span>

                      <button
                        type="button"
                        onClick={() => router.push(`/folder/${folder.id}`)}
                        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                      >
                        <span className="w-full truncate text-[16px] font-semibold text-charcoal">
                          {folder.name}
                        </span>
                        <span className="font-mono text-[11px] text-bark-grey">
                          {documentCount > 0
                            ? `${pluralize(documentCount, "document")} · ${pluralize(passageCount, "passage")}`
                            : "Empty"}
                        </span>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Actions for ${folder.name}`}
                              className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-pebble opacity-0 transition-opacity hover:bg-stone-mist/60 hover:text-charcoal focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => router.push(`/folder/${folder.id}`)}
                          >
                            <FolderIcon className="mr-2 size-3.5" />
                            Open folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setNewFolderParent(folder.id);
                              setNewFolderName("");
                              setIsNewFolderOpen(true);
                            }}
                          >
                            <FolderPlusIcon className="mr-2 size-3.5" />
                            New sub-folder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFolderToMove(folder)}>
                            <ArrowRightIcon className="mr-2 size-3.5" />
                            Move
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
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-auto flex items-center gap-2 border-t border-stone-mist px-5 py-3">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => router.push(`/folder/${folder.id}`)}
                        className="h-7 gap-1 px-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-bark-grey hover:text-charcoal"
                      >
                        Manage
                      </Button>

                      {childCount > 0 && (
                        <span className="font-mono text-[10px] text-pebble">
                          {pluralize(childCount, "sub-folder")}
                        </span>
                      )}

                      <Button
                        size="xs"
                        onClick={() => router.push(`/folder/${folder.id}/chat`)}
                        disabled={passageCount === 0}
                        className="ml-auto h-7 gap-1 rounded-[7px] bg-electric-indigo px-2.5 font-mono text-[10px] uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet disabled:opacity-40"
                      >
                        <MessageSquareIcon className="size-3" />
                        Ask
                      </Button>
                    </div>
                  </article>
                );
              })}

              {/* The documents that sit at the root of the library. */}
              {rootDocuments.map((document) => (
                <article
                  key={document.id}
                  className="group flex flex-col rounded-[16px] border border-stone-mist bg-paper-white transition-colors hover:border-electric-indigo/30"
                >
                  <div className="flex items-start gap-3 p-5 pb-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-warm-bone text-bark-grey">
                      <FileTextIcon className="size-4.5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[16px] font-semibold text-charcoal">
                        {document.name}
                      </span>
                      <span className="font-mono text-[11px] text-bark-grey">
                        {pluralize(document.chunkCount, "passage")} ·{" "}
                        {pluralize(document.pageCount, "page")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-2 border-t border-stone-mist px-5 py-3">
                    <span className="font-mono text-[10px] text-pebble">
                      At the library root
                    </span>
                    <Button
                      size="xs"
                      onClick={() =>
                        router.push(
                          `/folder/${library.documentLocation(document.id).documentFolder?.id ?? ""}/chat`
                        )
                      }
                      className="ml-auto h-7 gap-1 rounded-[7px] bg-electric-indigo px-2.5 font-mono text-[10px] uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet"
                    >
                      <MessageSquareIcon className="size-3" />
                      Ask
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ---- Product showcase --------------------------------------- */}
        <section className="mt-20">
          <ShowcaseCard />
        </section>

        {/* ---- Feature cards ----------------------------------------- */}
        <section className="mt-20">
          <p className="eyebrow text-center">
            Everything stays on your machine
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Parsed in the browser",
                body: "PDF.js reads the file on your device and splits it into chapter folders of overlapping passages.",
                icon: LayersIcon,
              },
              {
                title: "Hybrid retrieval",
                body: "BM25 finds the exact terms you typed. A local embedding model finds the passages that mean the right thing.",
                icon: SearchIcon,
              },
              {
                title: "Your key, your calls",
                body: "The Groq key is stored on your device and used only to call Groq. There is no server between you and the model.",
                icon: FileTextIcon,
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="flex flex-col gap-3 rounded-[8px] border border-stone-mist bg-paper-white p-6"
              >
                <feature.icon className="size-5 text-electric-indigo" />
                <h3 className="text-[18px] font-semibold text-charcoal">
                  {feature.title}
                </h3>
                <p className="text-[14px] leading-[1.43] text-bark-grey">
                  {feature.body}
                </p>
                <div className="mt-auto border-t border-stone-mist pt-3">
                  <span className="tag-label text-charcoal">
                    Learn more <ArrowRightIcon className="inline size-3" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* ---- Dialogs ------------------------------------------------ */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />

      <ImportPdfDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        folderName={
          newFolderParent
            ? library.getFolder(newFolderParent)?.name ?? "the library"
            : "the library"
        }
        onImport={handleImport}
      />

      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const name = newFolderName.trim();
              if (!name) return;
              const folder = await library.createFolder(
                name,
                newFolderParent ?? null
              );
              setNewFolderName("");
              setIsNewFolderOpen(false);
              router.push(`/folder/${folder.id}`);
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-display text-[24px] font-normal">
                New folder
              </DialogTitle>
              <DialogDescription>
                A folder holds documents, and is the unit you chat with.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4">
              <Label htmlFor="folder-name" className="text-[13px] font-medium">
                Name
              </Label>
              <Input
                id="folder-name"
                autoFocus
                required
                value={newFolderName}
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="e.g. Research papers"
                className="h-10 rounded-[12px]"
              />
              {newFolderParent && (
                <p className="text-[12px] text-bark-grey">
                  Inside {library.getFolder(newFolderParent)?.name}
                </p>
              )}
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
                Create folder
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
              variant="outline"
              onClick={() => setFolderToMove(null)}
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
                await library.removeFolder(folderToDelete.id);
                setFolderToDelete(null);
              }}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {embedding.state === "loading" && (
        <ProgressPopup
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          label={embedding.message ?? "Preparing the embedding model"}
          percent={embedding.percent}
        />
      )}
    </div>
  );
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
