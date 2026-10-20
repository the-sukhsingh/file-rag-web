"use client";

import { LibraryProvider } from "@/components/library/library-provider";
import { SettingsProvider } from "@/components/library/settings-provider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <LibraryProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </LibraryProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
