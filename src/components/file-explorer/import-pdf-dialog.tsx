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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  importPdf,
  type PdfImportProgress,
  type PdfImportResult,
} from "@/lib/pdf";

interface ImportPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: PdfImportResult) => void;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const INITIAL_PROGRESS: PdfImportProgress = {
  stage: "loading",
  percent: 0,
  message: "Preparing",
};

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
  onImport,
}: ImportPdfDialogProps) {
  const [status, setStatus] = React.useState<"idle" | "working" | "done">("idle");
  const [progress, setProgress] = React.useState<PdfImportProgress>(INITIAL_PROGRESS);
  const [result, setResult] = React.useState<PdfImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const reset = React.useCallback(() => {
    setStatus("idle");
    setProgress(INITIAL_PROGRESS);
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
      setProgress(INITIAL_PROGRESS);

      try {
        const imported = await importPdf(file, setProgress);
        setResult(imported);
        setStatus("done");
        onImport(imported);
      } catch (err) {
        console.error("PDF import failed:", err);
        setStatus("idle");
        setProgress(INITIAL_PROGRESS);
        setError(describeError(err));
      }
    },
    [onImport]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleImport(file);
  };

  const isWorking = status === "working";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isWorking) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import PDF</DialogTitle>
          <DialogDescription>
            Parsed in your browser. Each entry in the PDF outline becomes a
            folder holding that chapter&apos;s chunks.
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

        {/* Drop zone */}
        {status === "idle" && (
          <Empty
            role="button"
            tabIndex={0}
            aria-label="Choose a PDF file to import"
            className={cn(
              "cursor-pointer border border-dashed transition-colors",
              isDragging
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
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
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UploadIcon />
              </EmptyMedia>
              <EmptyTitle>Drop a PDF here</EmptyTitle>
              <EmptyDescription>
                or click to browse. Files stay on your device.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {/* Progress */}
        {isWorking && (
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-xs">
              <Spinner className="size-3.5 text-primary" />
              <span className="truncate font-medium text-foreground">
                {progress.message}
              </span>
              <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                {progress.percent}%
              </span>
            </div>
            <Progress value={progress.percent} />
          </div>
        )}

        {/* Result */}
        {status === "done" && result && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              <span className="truncate font-medium text-foreground">
                {result.fileName}
              </span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {result.pageCount} pages
              </Badge>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {result.chapters.length}{" "}
                {result.chapters.length === 1 ? "folder" : "folders"}
              </Badge>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {result.files.length} chunks
              </Badge>
            </div>

            {!result.usedOutline && (
              <Alert>
                <TriangleAlertIcon />
                <AlertTitle>No outline found</AlertTitle>
                <AlertDescription>
                  This PDF has no usable bookmarks, so every chunk landed in one
                  folder.
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="max-h-48 rounded-lg border border-border/60">
              <div className="flex flex-col gap-0.5 p-1.5">
                {result.chapters.map((chapter) => (
                  <div
                    key={`${chapter.title}-${chapter.startPage}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                  >
                    <FolderIcon className="size-3.5 shrink-0 text-primary/80" />
                    <span className="truncate">{chapter.title}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                      p. {chapter.startPage}-{chapter.endPage} ·{" "}
                      {chapter.chunkCount} chunks
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {status === "done" ? (
            <Button onClick={() => onOpenChange(false)}>View workspace</Button>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={isWorking}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={isWorking}
                onClick={() => inputRef.current?.click()}
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
