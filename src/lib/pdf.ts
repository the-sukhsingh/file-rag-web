import type { PDFDocumentProxy } from "pdfjs-dist";

import { VirtualFile } from "@/components/file-explorer/types";

/**
 * Client-side PDF indexing pipeline.
 *
 * Reads a PDF entirely in the browser, uses its outline (bookmarks) as the
 * source of truth for chapters, then splits every chapter into overlapping
 * text chunks and exposes them as virtual files, one folder per chapter.
 */

export const DEFAULT_TARGET_CHARS = 1200;
export const DEFAULT_OVERLAP_CHARS = 160;

export type PdfImportStage = "loading" | "extracting" | "structuring" | "chunking";

export interface PdfImportProgress {
  stage: PdfImportStage;
  /** 0 - 100, for the progress bar. */
  percent: number;
  message: string;
}

export interface PdfChapter {
  title: string;
  startPage: number;
  endPage: number;
  chunkCount: number;
}

export interface PdfImportResult {
  fileName: string;
  pageCount: number;
  chapters: PdfChapter[];
  files: VirtualFile[];
  /** False when the PDF has no usable outline and a single folder was created. */
  usedOutline: boolean;
}

interface PdfSection {
  title: string;
  startPageIndex: number;
  endPageIndex: number;
}

interface OutlineEntry {
  title: string;
  depth: number;
  pageIndex: number;
}

/* -------------------------------------------------------------------------- */
/*  PDF.js loader                                                             */
/* -------------------------------------------------------------------------- */

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Loads pdf.js once and points the worker at the bundled worker asset. */
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/* -------------------------------------------------------------------------- */
/*  Text extraction                                                           */
/* -------------------------------------------------------------------------- */

/** Yields to the browser so React can paint progress updates. */
function yieldToBrowser() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/([A-Za-z])-\n(?=[a-z])/g, "$1") // rejoin words split across lines
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageItemsToText(items: ReadonlyArray<unknown>): string {
  let text = "";
  for (const item of items) {
    if (!item || typeof item !== "object" || !("str" in item)) continue;
    const { str, hasEOL } = item as { str: string; hasEOL?: boolean };
    text += str;
    if (hasEOL) text += "\n";
  }
  return normalizeExtractedText(text);
}

/* -------------------------------------------------------------------------- */
/*  Outline -> chapters                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Outline destinations come in two shapes: a named destination (string) that
 * has to be looked up, or an explicit destination array whose first entry is
 * either a page reference or a zero-based page index.
 */
async function resolvePageIndex(
  doc: PDFDocumentProxy,
  dest: string | unknown[] | null
): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;

    const target = explicit[0];
    if (typeof target === "number") return Math.max(0, target);
    if (target && typeof target === "object" && "num" in target) {
      const index = await doc.getPageIndex(target as { num: number; gen: number });
      return typeof index === "number" ? index : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function collectOutline(
  doc: PDFDocumentProxy,
  nodes: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>,
  depth: number,
  entries: OutlineEntry[]
): Promise<void> {
  for (const node of nodes) {
    const title = node.title?.trim() ?? "";
    const pageIndex = await resolvePageIndex(doc, node.dest);
    if (title && pageIndex !== null && pageIndex >= 0) {
      entries.push({ title, depth, pageIndex });
    }
    if (node.items?.length) {
      await collectOutline(doc, node.items, depth + 1, entries);
    }
  }
}

/**
 * Picks the shallowest outline depth that actually looks like a chapter list,
 * so a single root bookmark ("Contents") does not swallow the whole document.
 */
function pickChapterEntries(entries: OutlineEntry[]): OutlineEntry[] {
  const byDepth = new Map<number, OutlineEntry[]>();
  for (const entry of entries) {
    const bucket = byDepth.get(entry.depth);
    if (bucket) bucket.push(entry);
    else byDepth.set(entry.depth, [entry]);
  }

  let fallback: OutlineEntry[] = [];
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const atDepth = byDepth.get(depth) ?? [];
    if (atDepth.length >= 2) return atDepth;
    if (!fallback.length) fallback = atDepth;
  }
  return fallback;
}

function buildSections(
  chapterEntries: OutlineEntry[],
  pageCount: number,
  fallbackTitle: string
): { sections: PdfSection[]; usedOutline: boolean } {
  const deduped = [
    ...new Map(chapterEntries.map((entry) => [entry.pageIndex, entry])).values(),
  ].sort((a, b) => a.pageIndex - b.pageIndex);

  if (deduped.length < 2) {
    return {
      sections: [{ title: fallbackTitle, startPageIndex: 0, endPageIndex: pageCount - 1 }],
      usedOutline: false,
    };
  }

  const sections: PdfSection[] = [];

  // Pages before the first bookmark are still worth indexing.
  if (deduped[0].pageIndex > 0) {
    sections.push({
      title: "Front Matter",
      startPageIndex: 0,
      endPageIndex: deduped[0].pageIndex - 1,
    });
  }

  deduped.forEach((entry, index) => {
    const next = deduped[index + 1];
    sections.push({
      title: entry.title,
      startPageIndex: entry.pageIndex,
      endPageIndex: next ? Math.max(entry.pageIndex, next.pageIndex - 1) : pageCount - 1,
    });
  });

  return { sections, usedOutline: true };
}

/* -------------------------------------------------------------------------- */
/*  Chunking                                                                  */
/* -------------------------------------------------------------------------- */

/** Splits a block that is already larger than the target into sentence groups. */
function splitOversizedBlock(block: string, targetChars: number): string[] {
  if (block.length <= targetChars) return [block];

  const sentences = block.match(/[^.!?\n]+[.!?]+["')\]]*\s*|[^.!?\n]+$/g) ?? [block];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const piece = sentence.trim();
    if (!piece) continue;

    if (piece.length > targetChars) {
      if (current) {
        parts.push(current);
        current = "";
      }
      parts.push(...hardSplit(piece, targetChars));
      continue;
    }

    if (current && current.length + 1 + piece.length > targetChars) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/** Last resort split for text with no sentence or word boundaries. */
function hardSplit(text: string, targetChars: number): string[] {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > targetChars) {
    const slice = remaining.slice(0, targetChars);
    const spaceAt = slice.lastIndexOf(" ");
    const cutAt = spaceAt > targetChars * 0.5 ? spaceAt : targetChars;
    parts.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

/** Trailing slice of the previous chunk, snapped to a word boundary. */
function tailOverlap(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) return "";
  const tail = text.slice(-overlapChars);
  const firstSpace = tail.search(/\s/);
  return (firstSpace === -1 ? tail : tail.slice(firstSpace + 1)).trim();
}

/**
 * Paragraph-aware chunker: packs whole paragraphs up to `targetChars`, falls
 * back to sentence grouping, and repeats a small tail of the previous chunk so
 * context is not lost at the boundary.
 */
export function chunkText(
  text: string,
  targetChars: number = DEFAULT_TARGET_CHARS,
  overlapChars: number = DEFAULT_OVERLAP_CHARS
): string[] {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return [];

  const blocks: string[] = [];
  for (const paragraph of normalized.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (trimmed) blocks.push(...splitOversizedBlock(trimmed, targetChars));
  }

  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (!current) {
      current = block;
      continue;
    }

    if (current.length + 2 + block.length <= targetChars) {
      current = `${current}\n\n${block}`;
      continue;
    }

    chunks.push(current);
    const overlap = tailOverlap(current, overlapChars);
    const withOverlap = overlap ? `${overlap}\n\n${block}` : block;
    current = withOverlap.length <= targetChars + overlapChars ? withOverlap : block;
  }

  if (current) chunks.push(current);
  return chunks;
}

/* -------------------------------------------------------------------------- */
/*  Virtual files                                                             */
/* -------------------------------------------------------------------------- */

function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\[\]\\/:*?"<>|#%{}^~`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
  return cleaned.slice(0, 60) || fallback;
}

function uniqueFolderName(title: string, index: number, taken: Set<string>): string {
  const base = sanitizeSegment(title, `Chapter ${index + 1}`);
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (${suffix})`;
    suffix += 1;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function chunkFileName(index: number): string {
  return `chunk-${String(index + 1).padStart(3, "0")}.md`;
}

function buildFiles(
  sections: PdfSection[],
  pageTexts: string[],
  stamp: number
): { files: VirtualFile[]; chapters: PdfChapter[] } {
  const files: VirtualFile[] = [];
  const chapters: PdfChapter[] = [];
  const takenFolderNames = new Set<string>();

  sections.forEach((section, sectionIndex) => {
    const folder = uniqueFolderName(section.title, sectionIndex, takenFolderNames);
    const text = pageTexts
      .slice(section.startPageIndex, section.endPageIndex + 1)
      .join("\n\n");
    const chunks = chunkText(text);

    chunks.forEach((chunk, chunkIndex) => {
      files.push({
        id: `pdf-${stamp}-${sectionIndex}-${chunkIndex}`,
        name: chunkFileName(chunkIndex),
        path: `${folder}/${chunkFileName(chunkIndex)}`,
        content: chunk,
        language: "markdown",
        size: chunk.length,
        updatedAt: "Just now",
      });
    });

    chapters.push({
      title: section.title,
      startPage: section.startPageIndex + 1,
      endPage: section.endPageIndex + 1,
      chunkCount: chunks.length,
    });
  });

  return { files, chapters };
}

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export async function importPdf(
  file: File,
  onProgress?: (progress: PdfImportProgress) => void
): Promise<PdfImportResult> {
  const report = (stage: PdfImportStage, percent: number, message: string) =>
    onProgress?.({ stage, percent, message });

  report("loading", 2, `Reading ${file.name}`);

  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const pageCount = doc.numPages;

    report("loading", 5, `Opened ${pageCount} page${pageCount === 1 ? "" : "s"}`);

    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(pageItemsToText(content.items));
      page.cleanup();

      report(
        "extracting",
        5 + Math.round((pageNumber / pageCount) * 75),
        `Extracting text - page ${pageNumber} of ${pageCount}`
      );
      await yieldToBrowser();
    }

    report("structuring", 84, "Reading document outline");

    const outline = await doc.getOutline().catch(() => null);
    const entries: OutlineEntry[] = [];
    if (outline?.length) await collectOutline(doc, outline, 0, entries);

    const metadata = await doc.getMetadata().catch(() => null);
    const infoTitle = (metadata?.info as { Title?: string } | undefined)?.Title?.trim();
    const fallbackTitle = sanitizeSegment(
      infoTitle || file.name.replace(/\.pdf$/i, ""),
      "Document"
    );

    const { sections, usedOutline } = buildSections(
      pickChapterEntries(entries),
      pageCount,
      fallbackTitle
    );

    report("chunking", 92, `Chunking ${sections.length} chapter${sections.length === 1 ? "" : "s"}`);

    const { files, chapters } = buildFiles(sections, pageTexts, Date.now());
    await yieldToBrowser();

    report("chunking", 100, `Created ${files.length} chunks`);

    return { fileName: file.name, pageCount, chapters, files, usedOutline };
  } finally {
    await loadingTask.destroy();
  }
}
