import { chunkText, extractPdf, type ExtractedPdf } from "@/lib/pdf";
import { tokenize } from "@/lib/retrieval/tokenize";

import {
  deleteChunksByDocument,
  deleteDocument,
  listFolders,
  putChunks,
  putDocument,
  putFolders,
} from "./store";
import type { Chunk, DocumentRecord, Folder } from "./types";

/**
 * Turns a PDF into a folder tree: one folder for the document, one folder per
 * chapter, and a chunk for every passage of every chapter.
 *
 * The chapter folders are what make the tree browsable, and the chunks are
 * what the retriever reads. Both are written to IndexedDB in one go.
 */

let idCounter = 0;

/** A short, collision-resistant id. */
export function createId(prefix: string): string {
  idCounter += 1;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${random}${idCounter.toString(36)}`;
}

export interface ImportResult {
  document: DocumentRecord;
  /** The document folder and one folder per chapter. */
  folders: Folder[];
  chunks: Chunk[];
}

/**
 * Imports a PDF into a folder.
 *
 * `parentId` is the folder the document folder is created in; when it is null
 * the document folder is created at the library root.
 */
export async function importPdfIntoFolder(
  file: File,
  parentId: string | null,
  onProgress?: (message: string, percent: number) => void
): Promise<ImportResult> {
  const existing = await listFolders();
  const parent = parentId
    ? existing.find((folder) => folder.id === parentId) ?? null
    : null;
  const parentPath = parent ? parent.path : "";

  const extracted: ExtractedPdf = await extractPdf(file, (message, percent) =>
    onProgress?.(message, percent)
  );

  const now = Date.now();
  const documentId = createId("doc");
  const documentFolderName = stripExtension(file.name);

  const documentFolder: Folder = {
    id: createId("folder"),
    name: documentFolderName,
    path: parentPath ? `${parentPath}/${documentFolderName}` : documentFolderName,
    parentId,
    createdAt: now,
    updatedAt: now,
  };

  const folders: Folder[] = [documentFolder];
  const chunks: Chunk[] = [];

  extracted.sections.forEach((section, sectionIndex) => {
    const sectionFolder: Folder = {
      id: createId("folder"),
      name: section.title,
      path: `${documentFolder.path}/${section.title}`,
      parentId: documentFolder.id,
      createdAt: now,
      updatedAt: now,
    };
    folders.push(sectionFolder);

    const texts = chunkText(section.text);
    texts.forEach((text, chunkIndex) => {
      chunks.push({
        id: createId("chunk"),
        documentId,
        folderId: sectionFolder.id,
        section: section.title,
        index: chunkIndex,
        fileName: `${String(chunkIndex + 1).padStart(3, "0")}.md`,
        startPage: section.startPage,
        endPage: section.endPage,
        text,
        embedding: null,
        tokens: tokenize(text),
        createdAt: now,
      });
    });

    void sectionIndex;
  });

  const document: DocumentRecord = {
    id: documentId,
    folderId: documentFolder.id,
    name: documentFolderName,
    fileName: file.name,
    pageCount: extracted.pageCount,
    chunkCount: chunks.length,
    usedOutline: extracted.usedOutline,
    createdAt: now,
    updatedAt: now,
  };

  await putFolders(folders);
  await putDocument(document);
  await putChunks(chunks);

  onProgress?.("Stored in your library", 100);

  return { document, folders, chunks };
}

/** Removes a document and every chunk it produced. */
export async function removeDocument(documentId: string): Promise<void> {
  await deleteChunksByDocument(documentId);
  await deleteDocument(documentId);
}

function stripExtension(name: string): string {
  return name.replace(/\.pdf$/i, "").trim() || "Document";
}

/** Formats a byte count for the library stats. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
