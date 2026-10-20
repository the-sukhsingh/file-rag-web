"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BookOpenIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  LayersIcon,
  MessageSquareIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { cn } from "cn";

import { SettingsDialog } from "@/components/layout/settings-dialog";
import { ShowcaseCard } from "@/components/layout/showcase-card";
import { TopNav } from "@/components/layout/top-nav";
import { FolderTree, buildTree } from "@/components/library/folder-tree";
import { ImportPdfDialog } from "@/components/library/import-pdf-dialog";
import { useLibrary } from "@/components/library/library-provider";
import { useSettings } from "@/components/library/settings-provider";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { onEmbeddingStatus } from "@/lib/retrieval/embeddings";
import type { Folder } from "@/lib/library/types";
import { pluralize } from "@/lib/utils";

/**
 * The library dashboard.
 *
 * The left column is the tree of folders; the middle column is the folder
 * that is open; the right column is the model. The dashboard is the home of
 * the app, and a folder is the unit of knowledge: open one and you can ask
 * it questions.
 */

type Status = { kind: "idle" } | { kind: "working" };

export default function LibraryDashboard() {
  const router = useRouter();
  const library = useLibrary();
  const settings = useSettings();

  const [activeFolderId, setActiveFolderId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [newFolderParent, setNewFolderParent] = React.useState<string | null>(null);
  const [folderToRename, setFolderToRename] = React.useState<Folder | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [folderToDelete, setFolderToDelete] = React.useState<Folder | null>(null);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [embedding, setEmbedding] = React.useState<
    { state: string; progress?: number; message?: string }
  >({ state: "idle" });

  React.useEffect(
    () =>
      onEmbeddingStatus((next) =>
        setEmbedding({
          state: next.state,
          progress: next.state === "loading" ? next.progress : undefined,
          message: next.state === "loading" ? next.message : undefined,
        })
      ),
    []
  );

  const tree = React.useMemo(
    () => buildTree(library.folders, library.documents),
    [library.folders, library.documents]
  );

  const activeFolder = activeFolderId
    ? library.getFolder(activeFolderId)
    : undefined;

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

  const handleOpenFolder = (folderId: string) => {
    setActiveFolderId(folderId);
  };

  const handleCreateFolder = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    const folder = await library.createFolder(name, newFolderParent);
    setNewFolderName("");
    setIsNewFolderOpen(false);
    setActiveFolderId(folder.id);
  };

  const handleImport = async (
    file: File,
    onProgress: (message: string, percent: number) => void
  ) => {
    setStatus({ kind: "working" });
    try {
      const result = await library.importPdf(
        file,
        activeFolderId ?? null,
        onProgress
      );
      setActiveFolderId(result.folders[0].id);
      return result;
    } finally {
      setStatus({ kind: "idle" });
    }
  };

  const handleRenameFolder = (folder: Folder) => {
    setFolderToRename(folder);
    setRenameValue(folder.name);
  };

  const handleDeleteFolder = (folder: Folder) => {
    setFolderToDelete(folder);
  };

  return (
    <div className="min-h-dvh bg-background">
      <TopNav
        active="library"
        hasKey={settings.hasKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewFolder={() => {
          setNewFolderParent(null);
          setIsNewFolderOpen(true);
        }}
      />

      <main className="mx-auto w-full max-w-[1200px] px-6 pb-24">
        {/* ---- Hero ------------------------------------------------- */}
        <section className="flex flex-col items-center py-20 text-center">
          <p className="eyebrow">A private library for your documents</p>
          <h1 className="display-face mt-6 max-w-[16ch] text-[clamp(40px,7vw,80px)] text-charcoal">
            Ask your documents <em className="italic text-electric-indigo">anything</em>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[18px] leading-[1.56] text-bark-grey">
            Import a PDF. It is split into chapters and chunks, indexed in your
            browser, and ready to answer questions - with your own API key.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              onClick={() => setIsNewFolderOpen(true)}
              variant="outline"
              className="h-11 rounded-[8px] border-stone-mist px-6 text-[14px] font-semibold uppercase tracking-[0.04em] text-charcoal hover:border-charcoal"
            >
              <FolderPlusIcon className="size-4" />
              New folder
            </Button>
            <Button
              onClick={() => setIsImportOpen(true)}
              className="h-11 rounded-[8px] bg-electric-indigo px-6 text-[14px] font-semibold uppercase tracking-[0.04em] text-white hover:bg-deep-violet"
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
            { value: stats.chunks, label: "Chunks indexed" },
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

        {/* ---- The library ------------------------------------------ */}
        <section className="mt-20 grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Tree */}
          <aside className="flex flex-col rounded-[16px] border border-stone-mist bg-paper-white">
            <div className="flex items-center justify-between border-b border-stone-mist px-4 py-3">
              <span className="tag-label text-bark-grey">Library</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="New folder"
                onClick={() => {
                  setNewFolderParent(activeFolderId);
                  setIsNewFolderOpen(true);
                }}
              >
                <FolderPlusIcon className="size-4" />
              </Button>
            </div>

            <div className="border-b border-stone-mist px-3 py-2.5">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-pebble" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a folder"
                  className="h-8 rounded-[12px] pl-8 text-[13px]"
                />
              </div>
            </div>

            <div className="min-h-[220px] flex-1 overflow-y-auto p-2">
              {tree.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                  <span className="flex size-10 items-center justify-center rounded-[12px] bg-warm-bone text-bark-grey">
                    <FolderIcon className="size-5" />
                  </span>
                  <p className="text-[13px] text-bark-grey">
                    No folders yet. Create one, then import a PDF into it.
                  </p>
                </div>
              ) : (
                <FolderTree
                  nodes={filterTree(tree, search)}
                  activeFolderId={activeFolderId ?? undefined}
                  onOpenFolder={handleOpenFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onNewSubfolder={(folder) => {
                    setNewFolderParent(folder.id);
                    setNewFolderName("");
                    setIsNewFolderOpen(true);
                  }}
                />
              )}
            </div>
          </aside>

          {/* The open folder */}
          <div className="flex flex-col rounded-[16px] border border-stone-mist bg-paper-white">
            {activeFolder ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-mist px-6 py-5">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="tag-label text-bark-grey">
                      {activeFolder.path}
                    </span>
                    <h2 className="text-[20px] font-semibold leading-[1.38] text-charcoal">
                      {activeFolder.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsImportOpen(true)}
                      className="h-9 rounded-[8px] border-stone-mist px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-charcoal hover:border-charcoal"
                    >
                      <UploadIcon className="size-3.5" />
                      Import
                    </Button>
                    <Button
                      onClick={() => router.push(`/folder/${activeFolder.id}`)}
                      className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white hover:bg-deep-violet"
                    >
                      <MessageSquareIcon className="size-3.5" />
                      Chat
                    </Button>
                  </div>
                </div>

                <FolderContents
                  folderId={activeFolder.id}
                  onOpenFolder={handleOpenFolder}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
                <span className="flex size-12 items-center justify-center rounded-[16px] bg-warm-bone text-bark-grey">
                  <BookOpenIcon className="size-6" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[16px] font-semibold text-charcoal">
                    Pick a folder
                  </p>
                  <p className="max-w-[38ch] text-[14px] leading-[1.43] text-bark-grey">
                    Choose a folder on the left to see what is inside it, or
                    import a PDF to start a new one.
                  </p>
                </div>
              </div>
            )}
          </div>
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
                body: "PDF.js reads the file on your device and splits it into chapter folders of overlapping chunks.",
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
        folderName={activeFolder?.name ?? "the library"}
        onImport={handleImport}
      />

      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateFolder}>
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

      {/* Rename folder */}
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
              setRenameValue("");
            }}
          >
            <DialogHeader>
              <DialogTitle className="font-display text-[24px] font-normal">
                Rename folder
              </DialogTitle>
              <DialogDescription>
                The folder keeps its documents and its passages.
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

      {/* Delete folder */}
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
              The folder, everything inside it and every passage it holds will
              be removed from this device. This cannot be undone.
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
                if (activeFolderId === folderToDelete.id) {
                  setActiveFolderId(null);
                }
                setFolderToDelete(null);
              }}
            >
              Delete folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {status.kind === "working" && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[12px] border border-stone-mist bg-paper-white px-4 py-2.5 text-[13px] text-charcoal shadow-xl">
          <Spinner className="size-3.5 text-electric-indigo" />
          Reading the document
        </div>
      )}

      {library.indexing && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[12px] border border-stone-mist bg-paper-white px-4 py-2.5 text-[13px] text-charcoal shadow-xl">
          <Spinner className="size-3.5 text-electric-indigo" />
          Indexing {library.indexing.done} of {library.indexing.total} passages
        </div>
      )}

      {embedding.state === "loading" && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-xs items-center gap-2 rounded-[12px] border border-stone-mist bg-paper-white px-4 py-2.5 text-[12px] text-bark-grey shadow-xl">
          <Spinner className="size-3.5 text-electric-indigo" />
          {embedding.message ?? "Preparing the embedding model"}
        </div>
      )}
    </div>
  );
}

/**
 * The contents of the open folder: its documents and its sub-folders.
 */
function FolderContents({
  folderId,
  onOpenFolder,
}: {
  folderId: string;
  onOpenFolder: (folderId: string) => void;
}) {
  const library = useLibrary();
  const documents = library.documentsIn(folderId);
  const children = library.childFolders(folderId);

  if (!documents.length && !children.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="flex size-11 items-center justify-center rounded-[12px] bg-warm-bone text-bark-grey">
          <UploadIcon className="size-5" />
        </span>
        <p className="text-[14px] text-bark-grey">
          This folder is empty. Import a PDF and it will be split into
          chapters and chunks here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {children.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="tag-label text-bark-grey">Folders</span>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => onOpenFolder(folder.id)}
                className="flex items-center gap-3 rounded-[12px] border border-stone-mist bg-warm-bone px-4 py-3 text-left transition-colors hover:border-electric-indigo/40 hover:bg-paper-white"
              >
                <FolderIcon className="size-4 shrink-0 text-electric-indigo" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-charcoal">
                  {folder.name}
                </span>
                <ArrowRightIcon className="size-3.5 shrink-0 text-pebble" />
              </button>
            ))}
          </div>
        </section>
      )}

      {documents.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="tag-label text-bark-grey">Documents</span>
          <div className="flex flex-col divide-y divide-stone-mist">
            {documents.map((document) => {
              const { documentFolder, chapterFolders } =
                library.documentLocation(document.id);
              return (
                <div
                  key={document.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-warm-bone text-bark-grey">
                    <FileTextIcon className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14px] font-medium text-charcoal">
                      {document.name}
                    </span>
                    <span className="truncate font-mono text-[11px] text-bark-grey">
                      {documentFolder?.path} · {pluralize(document.chunkCount, "chunk")}{" "}
                      · {pluralize(document.pageCount, "page")} ·{" "}
                      {pluralize(chapterFolders.length, "chapter")}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="h-5 shrink-0 rounded-[8px] px-1.5 text-[10px]"
                  >
                    Indexed
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${document.name}`}
                    onClick={() => void library.removeDocument(document.id)}
                    className="text-bark-grey hover:text-alarm-red"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** Filters the tree by folder name, keeping the parents of a match. */
function filterTree(
  nodes: ReturnType<typeof buildTree>,
  search: string
): ReturnType<typeof buildTree> {
  const query = search.trim().toLowerCase();
  if (!query) return nodes;

  const walk = (
    list: ReturnType<typeof buildTree>
  ): ReturnType<typeof buildTree> => {
    const result: ReturnType<typeof buildTree> = [];
    for (const node of list) {
      const children = walk(node.children);
      if (
        node.folder.name.toLowerCase().includes(query) ||
        children.length > 0
      ) {
        result.push({ ...node, children });
      }
    }
    return result;
  };

  return walk(nodes);
}
