"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/theme/ThemeToggle";

/**
 * The site's navigation bar.
 *
 * A single bar on the warm bone canvas with no bottom rule, so the content
 * sits on the page rather than inside a panel. The middle and the right hand
 * side are slots, so a page can put what matters to it there instead of
 * adding a second bar underneath.
 */
export function TopNav({
  active,
  onOpenSettings,
  onNewFolder,
  hasKey,
  middle,
  actions,
}: {
  active?: "library" | "folder";
  onOpenSettings?: () => void;
  onNewFolder?: () => void;
  hasKey?: boolean;
  /** Replaces the centre links. */
  middle?: React.ReactNode;
  /** Extra actions, placed before the settings button. */
  actions?: React.ReactNode;
}) {
  return (
    <header
      data-slot="top-nav"
      className="shrink-0 border-b border-stone-mist bg-background/90 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-12 w-full max-w-[1200px] items-center gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-electric-indigo text-[12px] font-semibold text-primary-foreground">
            Q
          </span>
          <span className="tag-label text-charcoal">Quarry</span>
        </Link>

        {middle ?? (
          <nav className="hidden items-center gap-7 md:flex">
            <Link
              href="/"
              className={cn(
                "text-[13px] transition-colors",
                active === "library"
                  ? "text-charcoal"
                  : "text-bark-grey hover:text-charcoal"
              )}
            >
              Library
            </Link>
            <span className="text-[13px] text-pebble">Docs</span>
            <span className="text-[13px] text-pebble">Changelog</span>
          </nav>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions}
          <ModeToggle />
          <Button
            variant="ghost"
            onClick={onOpenSettings}
            className="h-8 rounded-[8px] px-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-charcoal hover:bg-stone-mist/60"
          >
            {hasKey ? "Settings" : "API key"}
          </Button>
          {onNewFolder && (
            <Button
              onClick={onNewFolder}
              className="h-8 rounded-[8px] bg-electric-indigo px-3.5 text-[12px] font-semibold uppercase tracking-[0.04em] text-primary-foreground hover:bg-deep-violet"
            >
              New folder
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
