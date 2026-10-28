"use client";

import * as React from "react";
import { CheckIcon, KeyRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { MODELS, listModels, verifyApiKey, type GroqModel } from "@/lib/groq/client";
import { useSettings } from "../library/settings-provider";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { apiKey, model, setApiKey, setModel } = useSettings();
  const [draftKey, setDraftKey] = React.useState(apiKey);
  const [draftModel, setDraftModel] = React.useState(model);
  const [models, setModels] = React.useState<GroqModel[]>([]);
  const [state, setState] = React.useState<
    { kind: "idle" } | { kind: "checking" } | { kind: "ok" } | { kind: "bad"; message: string }
  >({ kind: "idle" });
  const [lastOpen, setLastOpen] = React.useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraftKey(apiKey);
      setDraftModel(model);
      setState({ kind: "idle" });
    }
  }

  React.useEffect(() => {
    if (!open || !apiKey) return;
    let cancelled = false;
    void listModels(apiKey).then((live) => { if (!cancelled) setModels(live); });
    return () => { cancelled = true; };
  }, [apiKey, open]);

  const availableModels: GroqModel[] = models.length ? [...models] : [...MODELS];
  if (!availableModels.some((entry) => entry.id === draftModel)) {
    availableModels.unshift({ id: draftModel, name: draftModel.split("/").pop() ?? draftModel, note: "Selected" });
  }

  const save = async () => {
    setState({ kind: "checking" });
    const result = await verifyApiKey(draftKey);
    if (!result.ok) {
      setState({ kind: "bad", message: result.message });
      return;
    }
    setApiKey(draftKey);
    setModel(draftModel);
    setState({ kind: "ok" });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (state.kind !== "checking") onOpenChange(next); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader className="px-2 pt-2">
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/7 text-primary"><KeyRoundIcon className="size-4" strokeWidth={1.6} /></span>
          <DialogTitle className="text-xl font-medium tracking-tight">Make yourself at home.</DialogTitle>
          <DialogDescription className="text-[13px] leading-6">Connect Groq to ask questions about your files.</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-5 px-2 py-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="groq-key" className="text-xs">API key</Label>
              {apiKey && <span className="flex items-center gap-1 text-[10px] text-primary"><CheckIcon className="size-3" /> Connected</span>}
            </div>
            <Input id="groq-key" type="password" autoComplete="off" spellCheck={false} placeholder="gsk_…" value={draftKey} disabled={state.kind === "checking"} onChange={(event) => { setDraftKey(event.target.value); setState({ kind: "idle" }); }} className="h-10 rounded-lg font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground">Saved on this device. Only sent to Groq.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="groq-model" className="text-xs">Answer model</Label>
            <Select
              items={availableModels.map((entry) => ({ value: entry.id, label: entry.name }))}
              value={draftModel}
              disabled={state.kind === "checking"}
              onValueChange={(value) => {
                if (value === null) return;
                setDraftModel(value);
                setState({ kind: "idle" });
              }}
            >
              <SelectTrigger
                id="groq-model"
                className="w-full min-w-0 bg-background px-3 text-[13px] data-[size=default]:h-10 focus-visible:border-primary/50 focus-visible:ring-primary/15 dark:bg-background dark:hover:bg-muted/40"
              >
                <SelectValue className="min-w-0">
                  <span className="truncate">{availableModels.find((entry) => entry.id === draftModel)?.name}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                sideOffset={6}
                className="max-h-[min(18rem,var(--available-height))] max-w-[calc(100vw-2rem)] rounded-xl border border-border p-1 shadow-lg ring-0"
              >
                {availableModels.map((entry) => (
                  <SelectItem
                    key={entry.id}
                    value={entry.id}
                    className="min-h-10 rounded-lg py-2 pr-9 pl-3 text-[13px] data-highlighted:bg-accent data-highlighted:text-foreground data-selected:text-primary"
                  >
                    <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{entry.note}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-lg bg-muted/65 p-3 text-[11px] leading-5 text-muted-foreground">Your PDFs are processed in your browser. When you chat, relevant document text and your conversation are sent to Groq to generate an answer.</p>
          {state.kind === "bad" && <p role="alert" className="text-xs leading-5 text-destructive">{state.message}</p>}
          {state.kind === "ok" && <p role="status" className="flex items-center gap-2 text-xs text-primary"><CheckIcon className="size-3.5" /> You’re connected. Ready when you are.</p>}
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {apiKey ? <button type="button" disabled={state.kind === "checking"} onClick={() => { setApiKey(""); setDraftKey(""); setModels([]); setState({ kind: "idle" }); }} className="rounded-sm text-xs text-muted-foreground hover:text-destructive disabled:opacity-50">Disconnect</button> : <span />}
          {state.kind === "ok" ? <Button onClick={() => onOpenChange(false)} className="h-9 px-4 text-xs">Back to chat</Button> : <Button onClick={() => void save()} disabled={!draftKey.trim() || state.kind === "checking"} className="h-9 px-4 text-xs">{state.kind === "checking" && <Spinner className="size-3.5" />}{state.kind === "checking" ? "Connecting…" : "Save connection"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
