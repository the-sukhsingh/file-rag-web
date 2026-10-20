"use client";

import * as React from "react";

import {
  createId,
  importPdfIntoFolder,
  removeDocument,
  type ImportResult,
} from "@/lib/library/import";
import {
  clearLibrary,
  deleteFolder,
  deleteFolderTree,
  listChunksByFolder,
  listDocuments,
  listFolders,
  putFolder,
} from "@/lib/library/store";
import type { Chunk, DocumentRecord, Folder } from "@/lib/library/types";
import { indexChunks } from "@/lib/retrieval/index";

/**
 * The library, in React.
 *
 * Folders, documents and chunks are read from IndexedDB once and kept in
 * memory; the chunk list is fetched per folder, because a large library would
 * not fit comfortably in memory and the retriever only ever needs the folder
 * that is open.
 */

interface LibraryContextValue {
  folders: Folder[];
  documents: DocumentRecord[];
  ready: boolean;
  /** Folders that hold nothing yet, and so cannot be chatted with. */
  folderHasContent: (folderId: string) => boolean;
  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  removeFolder: (folderId: string) => Promise<void>;
  importPdf: (
    file: File,
    parentId: string | null,
    onProgress?: (message: string, percent: number) => void
  ) => Promise<ImportResult>;
  removeDocument: (documentId: string) => Promise<void>;
  loadChunks: (folderId: string) => Promise<Chunk[]>;
  clearAll: () => Promise<void>;
  /** How the background embedding job is going, if one is running. */
  indexing: { done: number; total: number } | null;
  getFolder: (folderId: string) => Folder | undefined;
  getDocument: (documentId: string) => DocumentRecord | undefined;
  childFolders: (parentId: string | null) => Folder[];
  documentsIn: (folderId: string) => DocumentRecord[];
  /** The folder that holds a document, and the document folder above it. */
  documentLocation: (documentId: string) => {
    documentFolder: Folder | undefined;
    document: DocumentRecord | undefined;
    chapterFolders: Folder[];
  };
}

const LibraryContext = React.createContext<LibraryContextValue | null>(null);

export function useLibrary(): LibraryContextValue {
  const context = React.useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used inside the library provider");
  }
  return context;
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [documents, setDocuments] = React.useState<DocumentRecord[]>([]);
  const [ready, setReady] = React.useState(false);
  const [indexing, setIndexing] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const chunkCache = React.useRef(new Map<string, Chunk[]>());

  const refresh = React.useCallback(async () => {
    const [nextFolders, nextDocuments] = await Promise.all([
      listFolders(),
      listDocuments(),
    ]);
    setFolders(nextFolders);
    setDocuments(nextDocuments);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const createFolder = React.useCallback(
    async (name: string, parentId: string | null) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("A folder needs a name.");

      const parent = parentId
        ? folders.find((folder) => folder.id === parentId)
        : undefined;

      const now = Date.now();
      const folder: Folder = {
        id: createId("folder"),
        name: trimmed,
        path: parent ? `${parent.path}/${trimmed}` : trimmed,
        parentId: parentId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await putFolder(folder);
      await refresh();
      return folder;
    },
    [folders, refresh]
  );

  const renameFolder = React.useCallback(
    async (folderId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const folder = folders.find((entry) => entry.id === folderId);
      if (!folder) return;

      const parent = folder.parentId
        ? folders.find((entry) => entry.id === folder.parentId)
        : undefined;
      const parentPath = parent ? parent.path : "";

      const updated: Folder = {
        ...folder,
        name: trimmed,
        path: parentPath ? `${parentPath}/${trimmed}` : trimmed,
        updatedAt: Date.now(),
      };

      await putFolder(updated);
      await refresh();
    },
    [folders, refresh]
  );

  const removeFolder = React.useCallback(
    async (folderId: string) => {
      await deleteFolderTree(folderId);
      chunkCache.current.delete(folderId);
      await refresh();
    },
    [refresh]
  );

  const importPdf = React.useCallback(
    async (
      file: File,
      parentId: string | null,
      onProgress?: (message: string, percent: number) => void
    ) => {
      const result = await importPdfIntoFolder(file, parentId, onProgress);
      chunkCache.current.clear();
      await refresh();

      // The vectors are filled in after the import is done, so the document
      // is usable straight away with lexical search while the embedding model
      // catches up.
      setIndexing({ done: 0, total: result.chunks.length });
      void indexChunks(result.chunks, (progress) =>
        setIndexing({ done: progress.done, total: progress.total })
      )
        .catch((error) => {
          console.warn("Embedding the document failed:", error);
        })
        .finally(() => {
          setIndexing(null);
          chunkCache.current.clear();
        });

      return result;
    },
    [refresh]
  );

  const removeDocumentById = React.useCallback(
    async (documentId: string) => {
      await removeDocument(documentId);
      chunkCache.current.clear();
      await refresh();
    },
    [refresh]
  );

  const loadChunks = React.useCallback(async (folderId: string) => {
    const cached = chunkCache.current.get(folderId);
    if (cached) return cached;

    const chunks = await listChunksByFolder(folderId);
    chunkCache.current.set(folderId, chunks);
    return chunks;
  }, []);

  const clearAll = React.useCallback(async () => {
    await clearLibrary();
    chunkCache.current.clear();
    await refresh();
  }, [refresh]);

  const value = React.useMemo<LibraryContextValue>(
    () => ({
      folders,
      documents,
      ready,
      folderHasContent: (folderId) =>
        documents.some((document) => document.folderId === folderId) ||
        folders.some(
          (folder) => folder.parentId === folderId && folder.id !== folderId
        ),
      createFolder,
      renameFolder,
      removeFolder,
      importPdf,
      removeDocument: removeDocumentById,
      loadChunks,
      clearAll,
      indexing,
      getFolder: (folderId) => folders.find((folder) => folder.id === folderId),
      getDocument: (documentId) =>
        documents.find((document) => document.id === documentId),
      childFolders: (parentId) =>
        folders
          .filter((folder) => folder.parentId === parentId)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      documentsIn: (folderId) =>
        documents
          .filter((document) => document.folderId === folderId)
          .sort((a, b) => b.createdAt - a.createdAt),
      documentLocation: (documentId) => {
        const document = documents.find((entry) => entry.id === documentId);
        const documentFolder = document
          ? folders.find((folder) => folder.id === document.folderId)
          : undefined;
        const chapterFolders = documentFolder
          ? folders
              .filter((folder) => folder.parentId === documentFolder.id)
              .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { numeric: true })
              )
          : [];
        return { documentFolder, document, chapterFolders };
      },
    }),
    [
      folders,
      documents,
      ready,
      createFolder,
      renameFolder,
      removeFolder,
      importPdf,
      removeDocumentById,
      loadChunks,
      clearAll,
      indexing,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
