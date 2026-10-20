"use client";

import * as React from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { MODELS, verifyApiKey } from "@/lib/groq/client";

import { useSettings } from "../library/settings-provider";

/**
 * The settings panel: the user's Groq key and the model they want to talk to.
 *
 * The key is verified against Groq before it is stored, so a typo is caught
 * now rather than at the first question.
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { apiKey, model, setApiKey, setModel } = useSettings();
  const [draftKey, setDraftKey] = React.useState(apiKey);
  const [state, setState] = React.useState<
    { kind: "idle" } | { kind: "checking" } | { kind: "ok"; message: string } | { kind: "bad"; message: string }
  >({ kind: "idle" });

  // The dialog keeps its own draft of the key, so the saved value is only
  // replaced once Groq has confirmed it. The draft is re-seeded whenever the
  // dialog is opened, which is a change of the dialog's identity rather than
  // a reaction to a state update.
  const [lastOpen, setLastOpen] = React.useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraftKey(apiKey);
      setState({ kind: "idle" });
    }
  }

  const check = async () => {
    setState({ kind: "checking" });
    const result = await verifyApiKey(draftKey);
    if (result.ok) {
      setApiKey(draftKey);
      setState({ kind: "ok", message: result.message });
    } else {
      setState({ kind: "bad", message: result.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-[24px] font-normal">
            Your API key
          </DialogTitle>
          <DialogDescription>
            Quarry talks to Groq straight from your browser. The key is stored on
            this device only, and your documents never leave it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="groq-key" className="text-[13px] font-medium">
              Groq API key
            </Label>
            <Input
              id="groq-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="gsk_..."
              value={draftKey}
              onChange={(event) => {
                setDraftKey(event.target.value);
                setState({ kind: "idle" });
              }}
              className="h-10 rounded-[12px] font-mono text-[13px]"
            />
            {state.kind === "ok" && (
              <p className="text-[13px] text-lichen-green">{state.message}</p>
            )}
            {state.kind === "bad" && (
              <p className="text-[13px] text-alarm-red">{state.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="groq-model" className="text-[13px] font-medium">
              Model
            </Label>
            <div className="flex flex-col gap-1.5">
              {MODELS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setModel(entry.id)}
                  className={cn(
                    "flex items-center justify-between rounded-[12px] border px-4 py-2.5 text-left transition-colors",
                    model === entry.id
                      ? "border-electric-indigo bg-electric-indigo/5"
                      : "border-stone-mist bg-paper-white hover:bg-warm-bone"
                  )}
                >
                  <span className="flex flex-col">
                    <span className="text-[14px] font-medium text-charcoal">
                      {entry.name}
                    </span>
                    <span className="font-mono text-[11px] text-bark-grey">
                      {entry.id}
                    </span>
                  </span>
                  <span className="tag-label text-[10px] text-bark-grey">
                    {entry.note}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="h-9 rounded-[8px] px-4 text-[13px] font-semibold uppercase tracking-[0.04em]"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            className="h-9 rounded-[8px] bg-electric-indigo px-4 text-[13px] font-semibold uppercase tracking-[0.04em] hover:bg-deep-violet"
            onClick={check}
            disabled={!draftKey.trim() || state.kind === "checking"}
          >
            {state.kind === "checking" && <Spinner className="size-3.5" />}
            Save and verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
