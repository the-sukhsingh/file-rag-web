"use client";

import * as React from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

/**
 * The site's navigation bar.
 *
 * A single sticky bar on the warm bone canvas with no bottom rule, so the
 * content sits on the page rather than inside a panel.
 */

export function TopNav({
  active,
  onOpenSettings,
  hasKey,
}: {
  active?: "library" | "folder";
  onOpenSettings?: () => void;
  hasKey?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-electric-indigo text-[13px] font-semibold text-white">
            Q
          </span>
          <span className="tag-label text-charcoal">Quarry</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/"
            className={cn(
              "text-sm transition-colors",
              active === "library"
                ? "text-charcoal"
                : "text-bark-grey hover:text-charcoal"
            )}
          >
            Library
          </a>
          <span className="text-sm text-pebble">Docs</span>
          <span className="text-sm text-pebble">Changelog</span>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onOpenSettings}
            className="h-9 rounded-[8px] px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-charcoal hover:bg-stone-mist/60"
          >
            {hasKey ? "Settings" : "API key"}
          </Button>
          <a href="#new-folder">
            <Button className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-white hover:bg-deep-violet">
              New folder
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
