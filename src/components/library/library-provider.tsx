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
  createChunk,
  deleteChunk,
  deleteFolderTree,
  deleteGroup,
  listChunksByFolder,
  listDocuments,
  listFolders,
  listGroups,
  moveChunk,
  moveDocument,
  moveFolder,
  putFolder,
  putGroup,
  updateChunkEmbedding,
  updateChunkText,
  updateDocumentGroup,
  updateDocumentsGroup,
} from "@/lib/library/store";
import type { Chunk, DocumentRecord, FileGroup, Folder, FolderAccent } from "@/lib/library/types";
import { embedTexts } from "@/lib/retrieval/embeddings";
import { indexChunks } from "@/lib/retrieval/index";

/**
 * The library, in React.
 *
 * Folders, documents and chunks are read from IndexedDB once and kept in
 * memory; the chunk list is fetched per folder, because a large library would
 * not fit comfortably in memory and the retriever only ever needs the folder
 * that is open.
 *
 * A folder holds documents. A document is imported into a folder, and it
 * brings a chapter folder with it, so the tree the user sees has two kinds of
 * node: the folders they made, and the documents they added.
 */

export interface FolderSummary {
  /** The folder itself. */
  folder: Folder;
  /** Folders directly inside this one. */
  childCount: number;
  /** Documents directly inside this one. */
  documentCount: number;
  /** Passages in this folder and everything under it. */
  passageCount: number;
  /** The most recent change to anything inside it. */
  updatedAt: number;
}

interface LibraryContextValue {
  folders: Folder[];
  documents: DocumentRecord[];
  groups: FileGroup[];
  ready: boolean;
  /** A summary of every folder, with the counts the tree needs. */
  summaries: Map<string, FolderSummary>;
  createFolder: (name: string, parentId: string | null) => Promise<Folder>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  removeFolder: (folderId: string) => Promise<void>;
  moveFolderTo: (folderId: string, parentId: string | null) => Promise<void>;
  createGroup: (name: string, accent?: FolderAccent) => Promise<FileGroup>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  removeGroup: (groupId: string) => Promise<void>;
  setDocumentGroup: (documentId: string, groupId: string | null) => Promise<void>;
  setDocumentsGroup: (documentIds: string[], groupId: string | null) => Promise<void>;
  importPdf: (
    file: File,
    parentId: string | null,
    onProgress?: (message: string, percent: number) => void,
    groupId?: string | null
  ) => Promise<ImportResult>;
  removeDocument: (documentId: string) => Promise<void>;
  moveDocumentTo: (documentId: string, folderId: string) => Promise<void>;
  /** Rewrites a passage and re-embeds it. */
  editChunk: (chunkId: string, text: string) => Promise<void>;
  /** Adds a passage to a chapter folder. */
  addChunk: (input: {
    documentId: string;
    folderId: string;
    section: string;
    text: string;
  }) => Promise<void>;
  /** Removes a passage. */
  removeChunk: (chunkId: string) => Promise<void>;
  /** Moves a passage into another chapter folder. */
  moveChunkTo: (chunkId: string, folderId: string) => Promise<void>;
  loadChunks: (folderId: string) => Promise<Chunk[]>;
  clearAll: () => Promise<void>;
  /** How the background embedding job is going, if one is running. */
  indexing: { done: number; total: number } | null;
  /**
   * Bumped whenever the stored chunks change, so the pages that hold chunks in
   * memory can reload them. The vectors are written after the import, so an
   * open folder would otherwise keep searching passages without them.
   */
  revision: number;
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
  /** The chapter folders of a document, in reading order. */
  chaptersOf: (documentId: string) => Folder[];
  /** Everything under a folder, for the "what will be deleted" count. */
  contentsOf: (folderId: string) => {
    folders: number;
    documents: number;
    passages: number;
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
  const [groups, setGroups] = React.useState<FileGroup[]>([]);
  const [ready, setReady] = React.useState(false);
  const [indexing, setIndexing] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const [revision, setRevision] = React.useState(0);
  const chunkCache = React.useRef(new Map<string, Chunk[]>());

  const refresh = React.useCallback(async () => {
    const [nextFolders, nextDocuments, nextGroups] = await Promise.all([
      listFolders(),
      listDocuments(),
      listGroups(),
    ]);
    setFolders(nextFolders);
    setDocuments(nextDocuments);
    setGroups(nextGroups);
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

  const moveFolderTo = React.useCallback(
    async (folderId: string, parentId: string | null) => {
      await moveFolder(folderId, parentId);
      chunkCache.current.clear();
      await refresh();
    },
    [refresh]
  );

  const createGroup = React.useCallback(
    async (name: string, accent?: FolderAccent) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("A group needs a name.");
      const now = Date.now();
      const group: FileGroup = {
        id: createId("group"),
        name: trimmed,
        accent,
        createdAt: now,
        updatedAt: now,
      };
      await putGroup(group);
      await refresh();
      return group;
    },
    [refresh]
  );

  const renameGroup = React.useCallback(
    async (groupId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      await putGroup({
        ...group,
        name: trimmed,
        updatedAt: Date.now(),
      });
      await refresh();
    },
    [groups, refresh]
  );

  const removeGroup = React.useCallback(
    async (groupId: string) => {
      await deleteGroup(groupId);
      await refresh();
    },
    [refresh]
  );

  const setDocumentGroup = React.useCallback(
    async (documentId: string, groupId: string | null) => {
      await updateDocumentGroup(documentId, groupId);
      await refresh();
    },
    [refresh]
  );

  const setDocumentsGroup = React.useCallback(
    async (documentIds: string[], groupId: string | null) => {
      await updateDocumentsGroup(documentIds, groupId);
      await refresh();
    },
    [refresh]
  );

  const importPdf = React.useCallback(
    async (
      file: File,
      parentId: string | null,
      onProgress?: (message: string, percent: number) => void,
      groupId?: string | null
    ) => {
      const result = await importPdfIntoFolder(file, parentId, onProgress, groupId);
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
          // The vectors are new, so anything holding chunks in memory has to
          // read them again to be able to search by meaning.
          setRevision((value) => value + 1);
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

  const moveDocumentTo = React.useCallback(
    async (documentId: string, folderId: string) => {
      await moveDocument(documentId, folderId);
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

  /**
   * Re-embeds a passage after its text changed, so the vector search keeps
   * describing what the passage now says.
   */
  const reEmbed = React.useCallback(async (chunk: Chunk) => {
    const vectors = await embedTexts([chunk.text]);
    const vector = vectors?.[0];
    if (!vector) return;
    await updateChunkEmbedding(chunk.id, vector);
    chunkCache.current.clear();
    setRevision((value) => value + 1);
  }, []);

  const editChunk = React.useCallback(
    async (chunkId: string, text: string) => {
      const updated = await updateChunkText(chunkId, text);
      if (!updated) return;
      chunkCache.current.clear();
      setRevision((value) => value + 1);
      void reEmbed(updated);
    },
    [reEmbed]
  );

  const addChunk = React.useCallback(
    async (input: {
      documentId: string;
      folderId: string;
      section: string;
      text: string;
    }) => {
      const siblings = await listChunksByFolder(input.folderId);
      const created = await createChunk({
        ...input,
        index: siblings.length,
      });
      chunkCache.current.clear();
      setRevision((value) => value + 1);
      void reEmbed(created);
    },
    [reEmbed]
  );

  const removeChunk = React.useCallback(async (chunkId: string) => {
    await deleteChunk(chunkId);
    chunkCache.current.clear();
    setRevision((value) => value + 1);
  }, []);

  const moveChunkTo = React.useCallback(
    async (chunkId: string, folderId: string) => {
      await moveChunk(chunkId, folderId);
      chunkCache.current.clear();
      setRevision((value) => value + 1);
    },
    []
  );

  const clearAll = React.useCallback(async () => {
    await clearLibrary();
    chunkCache.current.clear();
    await refresh();
  }, [refresh]);

  /**
   * The counts the tree needs: how many folders and documents sit inside a
   * folder, how many passages they add up to, and when it last changed.
   */
  const summaries = React.useMemo(() => {
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

    const result = new Map<string, FolderSummary>();

    // The count of a folder is the count of what is directly inside it plus
    // the counts of its children, so the tree is built from the leaves up.
    const compute = (folder: Folder): FolderSummary => {
      const children = byParent.get(folder.id) ?? [];
      const own = documentsByFolder.get(folder.id) ?? [];

      const childSummaries = children.map(compute);
      const passageCount =
        own.reduce((total, document) => total + document.chunkCount, 0) +
        childSummaries.reduce((total, child) => total + child.passageCount, 0);

      const updatedAt = Math.max(
        folder.updatedAt,
        ...own.map((document) => document.updatedAt),
        ...childSummaries.map((child) => child.updatedAt)
      );

      const summary: FolderSummary = {
        folder,
        childCount: children.length,
        documentCount: own.length,
        passageCount,
        updatedAt,
      };

      result.set(folder.id, summary);
      return summary;
    };

    for (const folder of folders) {
      if (folder.parentId === null) compute(folder);
    }
    // Any folder whose parent is missing is treated as a root.
    for (const folder of folders) {
      if (!result.has(folder.id)) compute(folder);
    }

    return result;
  }, [folders, documents]);

  const value = React.useMemo<LibraryContextValue>(
    () => ({
      folders,
      documents,
      groups,
      ready,
      summaries,
      createFolder,
      renameFolder,
      removeFolder,
      moveFolderTo,
      createGroup,
      renameGroup,
      removeGroup,
      setDocumentGroup,
      setDocumentsGroup,
      importPdf,
      removeDocument: removeDocumentById,
      moveDocumentTo,
      editChunk,
      addChunk,
      removeChunk,
      moveChunkTo,
      loadChunks,
      clearAll,
      indexing,
      revision,
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
      chaptersOf: (documentId) => {
        const document = documents.find((entry) => entry.id === documentId);
        if (!document) return [];
        return folders
          .filter((folder) => folder.parentId === document.folderId)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      },
      contentsOf: (folderId) => {
        const ids = new Set<string>([folderId]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const folder of folders) {
            if (
              folder.parentId &&
              ids.has(folder.parentId) &&
              !ids.has(folder.id)
            ) {
              ids.add(folder.id);
              grew = true;
            }
          }
        }

        const inside = documents.filter((document) =>
          ids.has(document.folderId)
        );

        return {
          folders: ids.size - 1,
          documents: inside.length,
          passages: inside.reduce(
            (total, document) => total + document.chunkCount,
            0
          ),
        };
      },
    }),
    [
      folders,
      documents,
      groups,
      ready,
      summaries,
      createFolder,
      renameFolder,
      removeFolder,
      moveFolderTo,
      createGroup,
      renameGroup,
      removeGroup,
      setDocumentGroup,
      setDocumentsGroup,
      importPdf,
      removeDocumentById,
      moveDocumentTo,
      editChunk,
      addChunk,
      removeChunk,
      moveChunkTo,
      loadChunks,
      clearAll,
      indexing,
      revision,
    ]
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
