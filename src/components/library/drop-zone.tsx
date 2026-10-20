"use client";

import * as React from "react";
import { FileTextIcon, UploadIcon } from "lucide-react";
import { cn } from "cn";

/**
 * The drop zone.
 *
 * It is always on screen rather than hidden behind a button, so adding a
 * document is one drag away from anywhere in the folder.
 */
export function DropZone({
  onFiles,
  hint = "Drop PDFs here to add them to this folder",
  className,
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  hint?: string;
  className?: string;
  /** A slimmer version, for the side of the screen. */
  compact?: boolean;
}) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const depth = React.useRef(0);

  // The drag counter keeps the zone lit while a file passes over a child
  // element, which would otherwise flicker the highlight off.
  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    depth.current += 1;
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setIsDragging(false);
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    depth.current = 0;
    setIsDragging(false);

    const files = Array.from(event.dataTransfer.files ?? []).filter(
      (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    );
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn("relative", className)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center gap-2 rounded-[10px] border border-dashed text-left transition-colors",
          compact ? "px-3 py-2" : "px-4 py-3",
          isDragging
            ? "border-electric-indigo bg-electric-indigo/8 text-electric-indigo"
            : "border-stone-mist text-bark-grey hover:border-electric-indigo/40 hover:bg-warm-bone"
        )}
      >
        <UploadIcon className={cn("shrink-0", compact ? "size-3.5" : "size-4")} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            compact ? "text-[12px]" : "text-[13px]"
          )}
        >
          {isDragging ? "Drop to add" : hint}
        </span>
      </button>
    </div>
  );
}

/**
 * The drop zone as a full-panel overlay, for the middle of the screen.
 */
export function DropOverlay({
  active,
  onFiles,
}: {
  active: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />

      {active && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/85 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-[16px] border-2 border-dashed border-electric-indigo bg-paper-white px-10 py-8">
            <span className="flex size-11 items-center justify-center rounded-[12px] bg-electric-indigo/10 text-electric-indigo">
              <FileTextIcon className="size-5" />
            </span>
            <span className="text-[15px] font-semibold text-charcoal">
              Drop the PDFs here
            </span>
            <span className="text-[13px] text-bark-grey">
              They are parsed and indexed in your browser
            </span>
          </div>
        </div>
      )}
    </>
  );
}
