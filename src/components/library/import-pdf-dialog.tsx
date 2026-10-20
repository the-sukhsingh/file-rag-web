"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  FileTextIcon,
  FolderIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { ImportResult } from "@/lib/library/import";
import { pluralize } from "@/lib/utils";

/**
 * The import dialog.
 *
 * The PDF is parsed in the browser, split into chapters and chunks, and
 * written to the local library. Nothing is uploaded.
 */

const MAX_FILE_BYTES = 50 * 1024 * 1024;

interface ImportPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The folder the document is imported into. */
  folderName: string;
  onImport: (
    file: File,
    onProgress: (message: string, percent: number) => void
  ) => Promise<ImportResult>;
  onImported?: (result: ImportResult) => void;
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/password/i.test(raw)) {
    return "This PDF is password protected. Remove the password and try again.";
  }
  return raw || "Could not read this PDF. It may be corrupted or unsupported.";
}

export function ImportPdfDialog({
  open,
  onOpenChange,
  folderName,
  onImport,
  onImported,
}: ImportPdfDialogProps) {
  const [status, setStatus] = React.useState<"idle" | "working" | "done">(
    "idle"
  );
  const [progress, setProgress] = React.useState({
    message: "Preparing",
    percent: 0,
  });
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    setStatus("idle");
    setProgress({ message: "Preparing", percent: 0 });
    setResult(null);
    setError(null);
    setIsDragging(false);
  }, []);

  const handleImport = React.useCallback(
    async (file: File) => {
      if (!isPdf(file)) {
        setError("That file is not a PDF. Choose a .pdf file to import.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError("This PDF is larger than 50 MB. Try a smaller document.");
        return;
      }

      setError(null);
      setResult(null);
      setStatus("working");
      setProgress({ message: "Preparing", percent: 0 });

      try {
        const imported = await onImport(file, (message, percent) =>
          setProgress({ message, percent })
        );
        setResult(imported);
        setStatus("done");
        onImported?.(imported);
      } catch (err) {
        console.error("PDF import failed:", err);
        setStatus("idle");
        setProgress({ message: "Preparing", percent: 0 });
        setError(describeError(err));
      }
    },
    [onImport, onImported]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.data.files?.[0];
    if (file) void handleImport(file);
  };

  const isWorking = status === "working";

  // Every close path funnels through here so a finished import cannot leak
  // into the next time the dialog is opened.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (isWorking) return;
      reset();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[24px] font-normal">
            Import a PDF
          </DialogTitle>
          <DialogDescription>
            Parsed in your browser. Each bookmark becomes a chapter folder
            holding that chapter&apos;s chunks.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
            event.target.value = "";
          }}
        />

        {status === "idle" && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a PDF file to import"
            className={cn(
              "flex cursor-pointer flex-col items-center gap-3 rounded-[16px] border border-dashed px-6 py-12 text-center transition-colors",
              isDragging
                ? "border-electric-indigo/60 bg-electric-indigo/5"
                : "border-stone-mist bg-paper-white hover:border-electric-indigo/40 hover:bg-warm-bone"
            )}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
          >
            <span className="flex size-11 items-center justify-center rounded-[12px] bg-electric-indigo/10 text-electric-indigo">
              <UploadIcon className="size-5" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[16px] font-semibold text-charcoal">
                Drop a PDF here
              </span>
              <span className="text-[14px] text-bark-grey">
                or click to browse. The file stays on your device.
              </span>
            </span>
          </div>
        )}

        {isWorking && (
          <div className="flex flex-col gap-3 rounded-[16px] border border-stone-mist bg-warm-bone p-4">
            <div className="flex items-center gap-2 text-[13px]">
              <Spinner className="size-3.5 text-electric-indigo" />
              <span className="truncate font-medium text-charcoal">
                {progress.message}
              </span>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-bark-grey">
                {progress.percent}%
              </span>
            </div>
            <Progress value={progress.percent} />
          </div>
        )}

        {status === "done" && result && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <CheckCircle2Icon className="size-4 text-lichen-green" />
              <span className="min-w-0 max-w-full truncate font-medium text-charcoal">
                {result.document.name}
              </span>
              <Badge
                variant="outline"
                className="h-5 rounded-[8px] px-1.5 text-[10px]"
              >
                {pluralize(result.document.pageCount, "page")}
              </Badge>
              <Badge
                variant="outline"
                className="h-5 rounded-[8px] px-1.5 text-[10px]"
              >
                {pluralize(result.folders.length - 1, "chapter")}
              </Badge>
              <Badge
                variant="outline"
                className="h-5 rounded-[8px] px-1.5 text-[10px]"
              >
                {pluralize(result.chunks.length, "chunk")}
              </Badge>
            </div>

            {!result.document.usedOutline && (
              <div className="flex items-start gap-2 rounded-[12px] border border-terracotta/40 bg-terracotta/5 p-3">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-terracotta" />
                <p className="text-[13px] text-bark-grey">
                  This PDF has no usable bookmarks, so every chunk landed in a
                  single folder.
                </p>
              </div>
            )}

            <ScrollArea className="max-h-48 rounded-[12px] border border-stone-mist">
              <div className="flex flex-col gap-0.5 p-2">
                {result.folders.slice(1).map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-warm-bone"
                  >
                    <FolderIcon className="size-3.5 shrink-0 text-electric-indigo" />
                    <span className="min-w-0 flex-1 truncate text-charcoal">
                      {folder.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-bark-grey">
                      {result.chunks.filter((chunk) => chunk.folderId === folder.id).length}{" "}
                      chunks
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-[12px] border border-alarm-red/40 bg-alarm-red/5 p-3">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-alarm-red" />
            <p className="text-[13px] text-bark-grey">{error}</p>
          </div>
        )}

        <DialogFooter>
          {status === "done" ? (
            <Button
              className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={isWorking}
                onClick={() => handleOpenChange(false)}
                className="h-9 rounded-[8px] px-4 text-[13px] font-semibold uppercase tracking-[0.04em]"
              >
                Cancel
              </Button>
              <Button
                disabled={isWorking}
                onClick={() => inputRef.current?.click()}
                className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
              >
                <FileTextIcon className="size-3.5" />
                Choose PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
