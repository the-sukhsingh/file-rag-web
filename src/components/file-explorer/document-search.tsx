"use client";

import * as React from "react";
import { FileIcon, SearchIcon } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "cn";

import type { VirtualFile } from "./types";

/** One matching line of one document. */
export interface DocumentMatch {
  file: VirtualFile;
  /** 1-based line number, matching `nl -ba` output. */
  line: number;
  /** The matching line, trimmed and shortened for display. */
  text: string;
}

export interface DocumentSearchResult {
  matches: DocumentMatch[];
  /** How many documents matched, including those past the display cap. */
  fileCount: number;
  /** True when more matches exist than are listed. */
  truncated: boolean;
}

/** Enough to show the shape of the results without an unbounded list. */
const MAX_MATCHES = 40;
const MAX_MATCHES_PER_FILE = 5;
const MAX_SNIPPET_CHARS = 180;

/** Shortest query worth scanning every document for. */
export const MIN_QUERY_LENGTH = 2;

const EMPTY_RESULT: DocumentSearchResult = {
  matches: [],
  fileCount: 0,
  truncated: false,
};

/**
 * Greps every imported document for `query` and returns the matching lines.
 *
 * This is what the agent sees when it greps the workspace, done in the browser
 * over the chunks the user imported: plain case-insensitive substring matching,
 * capped so a one-letter query on a large library cannot freeze the tab.
 */
export function searchDocuments(
  files: VirtualFile[],
  query: string,
  limit: number = MAX_MATCHES
): DocumentSearchResult {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) return EMPTY_RESULT;

  const matches: DocumentMatch[] = [];
  const matchedFileIds = new Set<string>();
  let truncated = false;

  for (const file of files) {
    const lines = file.content.split("\n");
    let shownForFile = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index];
      if (!text.toLowerCase().includes(needle)) continue;

      matchedFileIds.add(file.id);

      if (shownForFile >= MAX_MATCHES_PER_FILE) {
        truncated = true;
        continue;
      }

      if (matches.length >= limit) {
        truncated = true;
        break;
      }

      matches.push({
        file,
        line: index + 1,
        text: text.trim().slice(0, MAX_SNIPPET_CHARS),
      });
      shownForFile += 1;
    }

    if (matches.length >= limit) {
      truncated = true;
      break;
    }
  }

  return { matches, fileCount: matchedFileIds.size, truncated };
}

/** Splits a snippet so the matched text can be marked without innerHTML. */
function splitOnMatch(
  text: string,
  query: string
): Array<{ part: string; match: boolean }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ part: text, match: false }];

  const haystack = text.toLowerCase();
  const parts: Array<{ part: string; match: boolean }> = [];
  let cursor = 0;

  for (;;) {
    const found = haystack.indexOf(needle, cursor);
    if (found === -1) break;

    if (found > cursor) {
      parts.push({ part: text.slice(cursor, found), match: false });
    }
    parts.push({ part: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
  }

  if (cursor < text.length) parts.push({ part: text.slice(cursor), match: false });
  return parts;
}

/**
 * Matching lines across the imported documents, grouped under each file, with
 * the searched text marked. Clicking a match opens that document.
 */
export function DocumentSearchResults({
  query,
  result,
  onSelectFile,
  className,
}: {
  query: string;
  result: DocumentSearchResult;
  onSelectFile: (file: VirtualFile) => void;
  className?: string;
}) {
  const grouped = React.useMemo(() => {
    const byFile = new Map<string, DocumentMatch[]>();
    for (const match of result.matches) {
      const bucket = byFile.get(match.file.id);
      if (bucket) bucket.push(match);
      else byFile.set(match.file.id, [match]);
    }
    return [...byFile.values()];
  }, [result.matches]);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <SearchIcon className="size-3" />
        <span>
          {result.matches.length} match{result.matches.length === 1 ? "" : "es"} in{" "}
          {result.fileCount} file{result.fileCount === 1 ? "" : "s"}
        </span>
      </div>

      <ScrollArea className="max-h-[45vh] pr-1">
        <div className="flex flex-col gap-2 pb-1">
          {grouped.map((bucket) => {
            const file = bucket[0].file;
            return (
              <div key={file.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelectFile(file)}
                  className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  title={file.path}
                >
                  <FileIcon className="size-3 shrink-0" />
                  <span className="truncate">{file.path}</span>
                </button>

                {bucket.map((match) => (
                  <button
                    key={`${file.id}-${match.line}`}
                    type="button"
                    onClick={() => onSelectFile(file)}
                    className="flex w-full items-baseline gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/60"
                  >
                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/70">
                      {match.line}
                    </span>
                    <span className="min-w-0 break-words text-[11px] text-muted-foreground">
                      {splitOnMatch(match.text, query).map((piece, index) =>
                        piece.match ? (
                          <mark
                            key={index}
                            className="rounded-sm bg-primary/25 px-0.5 text-foreground"
                          >
                            {piece.part}
                          </mark>
                        ) : (
                          <React.Fragment key={index}>{piece.part}</React.Fragment>
                        )
                      )}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}

          {result.truncated && (
            <p className="px-1 text-[10px] text-muted-foreground/70">
              More matches than shown. Narrow the search to see the rest.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
