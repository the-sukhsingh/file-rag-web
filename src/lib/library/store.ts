import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Chunk, DocumentRecord, Folder } from "./types";

/**
 * Local persistence for the library.
 *
 * Everything the user imports lives in their browser's IndexedDB: the folders,
 * the documents and every chunk with its vector. Nothing is uploaded, which is
 * the whole point of the BYOK design - the API key and the documents never
 * reach a server we control.
 */

const DB_NAME = "quarry-library";
const DB_VERSION = 1;

const FOLDER_STORE = "folders";
const DOCUMENT_STORE = "documents";
const CHUNK_STORE = "chunks";

interface LibrarySchema extends DBSchema {
  folders: {
    key: string;
    value: Folder;
    indexes: { "by-path": string };
  };
  documents: {
    key: string;
    value: DocumentRecord;
    indexes: { "by-folder": string };
  };
  chunks: {
    key: string;
    value: Chunk;
    indexes: { "by-document": string; "by-folder": string };
  };
}

let dbPromise: Promise<IDBPDatabase<LibrarySchema>> | null = null;

function getDb(): Promise<IDBPDatabase<LibrarySchema>> {
  if (!dbPromise) {
    dbPromise = openDB<LibrarySchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FOLDER_STORE)) {
          const store = db.createObjectStore(FOLDER_STORE, { keyPath: "id" });
          store.createIndex("by-path", "path");
        }
        if (!db.objectStoreNames.contains(DOCUMENT_STORE)) {
          const store = db.createObjectStore(DOCUMENT_STORE, { keyPath: "id" });
          store.createIndex("by-folder", "folderId");
        }
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          const store = db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
          store.createIndex("by-document", "documentId");
          store.createIndex("by-folder", "folderId");
        }
      },
      blocked() {
        console.warn(
          "[quarry] another tab is holding an older version of the library open"
        );
      },
    });
  }
  return dbPromise;
}

/* -------------------------------------------------------------------------- */
/*  Folders                                                                   */
/* -------------------------------------------------------------------------- */

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  return db.getAll(FOLDER_STORE);
}

export async function putFolder(folder: Folder): Promise<void> {
  const db = await getDb();
  await db.put(FOLDER_STORE, folder);
}

export async function putFolders(folders: Folder[]): Promise<void> {
  if (!folders.length) return;
  const db = await getDb();
  const tx = db.transaction(FOLDER_STORE, "readwrite");
  await Promise.all([...folders.map((folder) => tx.store.put(folder)), tx.done]);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(FOLDER_STORE, id);
}

/* -------------------------------------------------------------------------- */
/*  Documents                                                                 */
/* -------------------------------------------------------------------------- */

export async function listDocuments(): Promise<DocumentRecord[]> {
  const db = await getDb();
  return db.getAll(DOCUMENT_STORE);
}

export async function putDocument(document: DocumentRecord): Promise<void> {
  const db = await getDb();
  await db.put(DOCUMENT_STORE, document);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(DOCUMENT_STORE, id);
}

/* -------------------------------------------------------------------------- */
/*  Chunks                                                                    */
/* -------------------------------------------------------------------------- */

export async function putChunks(chunks: Chunk[]): Promise<void> {
  if (!chunks.length) return;
  const db = await getDb();
  const tx = db.transaction(CHUNK_STORE, "readwrite");
  await Promise.all([...chunks.map((chunk) => tx.store.put(chunk)), tx.done]);
}

export async function listChunksByFolder(folderId: string): Promise<Chunk[]> {
  const db = await getDb();
  return db.getAllFromIndex(CHUNK_STORE, "by-folder", folderId);
}

export async function listChunksByDocument(
  documentId: string
): Promise<Chunk[]> {
  const db = await getDb();
  return db.getAllFromIndex(CHUNK_STORE, "by-document", documentId);
}

export async function deleteChunksByDocument(
  documentId: string
): Promise<void> {
  const db = await getDb();
  const chunks = await listChunksByDocument(documentId);
  const tx = db.transaction(CHUNK_STORE, "readwrite");
  await Promise.all([
    ...chunks.map((chunk) => tx.store.delete(chunk.id)),
    tx.done,
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Whole-library operations                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Removes a folder and everything under it: nested folders, the documents
 * inside them and every chunk those documents produced.
 */
export async function deleteFolderTree(folderId: string): Promise<void> {
  const db = await getDb();

  const folders = await db.getAll(FOLDER_STORE);
  const documents = await db.getAll(DOCUMENT_STORE);

  const doomedFolders = new Set<string>([folderId]);
  // Walk down the tree: a folder is doomed if its parent is doomed.
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (
        folder.parentId &&
        doomedFolders.has(folder.parentId) &&
        !doomedFolders.has(folder.id)
      ) {
        doomedFolders.add(folder.id);
        grew = true;
      }
    }
  }

  const doomedDocuments = documents.filter((document) =>
    doomedFolders.has(document.folderId)
  );

  const chunkTx = db.transaction(CHUNK_STORE, "readwrite");
  const documentTx = db.transaction(DOCUMENT_STORE, "readwrite");
  const folderTx = db.transaction(FOLDER_STORE, "readwrite");

  await Promise.all([
    ...doomedDocuments.map((document) => documentTx.store.delete(document.id)),
    ...[...doomedFolders].map((id) => folderTx.store.delete(id)),
    chunkTx.done,
    documentTx.done,
    folderTx.done,
  ]);
}

/** Wipes the library. Used by the "clear everything" action. */
export async function clearLibrary(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear(FOLDER_STORE),
    db.clear(DOCUMENT_STORE),
    db.clear(CHUNK_STORE),
  ]);
}

/**
 * Replaces the stored vector of a chunk, so the embedding pipeline can fill
 * in vectors after the chunks are already written.
 */
export async function updateChunkEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  const db = await getDb();
  const chunk = await db.get(CHUNK_STORE, chunkId);
  if (!chunk) return;
  await db.put(CHUNK_STORE, { ...chunk, embedding });
}
