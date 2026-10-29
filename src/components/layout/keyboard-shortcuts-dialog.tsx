"use client";

import * as React from "react";
import { KeyboardIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isMac } from "@/lib/hooks/use-keyboard-shortcuts";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mac, setMac] = React.useState(false);

  React.useEffect(() => {
    setMac(isMac());
  }, []);

  const mod = mac ? "⌘" : "Ctrl";

  const sections = [
    {
      title: "Workspace & Layout",
      shortcuts: [
        { label: "Toggle sidebar", keys: [mod, "B"] },
        { label: "Toggle theme (Light / Dark)", keys: ["D"] },
        { label: "Toggle theme (Global)", keys: [mod, "Shift", "D"] },
        { label: "Switch Files / Chats view", keys: [mod, "Shift", "S"] },
      ],
    },
    {
      title: "Chat & Prompting",
      shortcuts: [
        { label: "Focus prompt box", keys: [mod, "K"], altKey: "/" },
        { label: "New conversation", keys: [mod, "N"], altKey: "C" },
        { label: "Send message", keys: ["Enter"] },
        { label: "New line in prompt", keys: ["Shift", "Enter"] },
      ],
    },
    {
      title: "Agent Tools",
      shortcuts: [
        { label: "Slash commands menu", keys: ["/ in prompt"] },
        { label: "Mention file or group", keys: ["@ in prompt"] },
        { label: "Open settings", keys: [mod, ","] },
        { label: "Keyboard shortcuts", keys: ["?"] },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-4 p-5 sm:p-6">
        <DialogHeader className="gap-1.5 text-left">
          <div className="flex items-center gap-2 text-primary">
            <KeyboardIcon className="size-4" />
            <span className="text-[11px] font-medium tracking-wide uppercase">Shortcuts</span>
          </div>
          <DialogTitle className="text-base font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Navigate and manage your workspace with fast shortcuts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h4 className="text-[11px] font-medium text-muted-foreground/80 tracking-wider uppercase">
                {section.title}
              </h4>
              <div className="divide-y divide-border/40 rounded-lg border border-border/60 bg-muted/15">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between px-3 py-2 text-[12px]"
                  >
                    <span className="text-foreground/90">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((k, idx) => (
                        <React.Fragment key={k}>
                          <Kbd>{k}</Kbd>
                          {idx < shortcut.keys.length - 1 && (
                            <span className="text-[10px] text-muted-foreground/50">+</span>
                          )}
                        </React.Fragment>
                      ))}
                      {shortcut.altKey && (
                        <>
                          <span className="text-[10px] text-muted-foreground/40 mx-0.5">or</span>
                          <Kbd>{shortcut.altKey}</Kbd>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
