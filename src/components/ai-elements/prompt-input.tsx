"use client";

import * as React from "react";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  FileTextIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AttachmentFile = {
  id: string;
  name: string;
};

const providers = [
  {
    name: "Groq / OpenAI",
    models: [
      { id: "gpt-oss-120b", name: "GPT-OSS 120B" },
      { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
      { id: "mixtral-8x7b", name: "Mixtral 8x7B" },
    ],
  },
  {
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    ],
  },
];

const models = providers.flatMap((provider) => provider.models);

export function PromptInputDemo({
  onSubmitText,
  className,
  placeholder = "Ask anything about your code...",
  externalText,
}: {
  onSubmitText: (text: string) => Promise<void>;
  className?: string;
  placeholder?: string;
  externalText?: string;
}) {
  const [text, setText] = React.useState("");
  const [files, setFiles] = React.useState<AttachmentFile[]>([]);
  const [model, setModel] = React.useState(models[0].id);
  const formRef = React.useRef<HTMLFormElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const currentModel = models.find((item) => item.id === model) ?? models[0];
  const canSend = text.trim().length > 0;

  React.useEffect(() => {
    if (externalText) {
      setText(externalText);
      textareaRef.current?.focus();
    }
  }, [externalText]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend || !text.trim()) {
      return;
    }
    onSubmitText(text.trim());
    setText("");
    setFiles([]);
  }

  function onAttach(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files;
    if (!selected) return;

    setFiles((current) => [
      ...current,
      ...Array.from(selected, (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
      })),
    ]);
    event.target.value = "";
  }

  return (
    <div className={cn("w-full", className)}>
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="relative flex flex-col rounded-xl border border-border/70 bg-card/60 backdrop-blur-xs shadow-2xs transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 overflow-hidden"
      >
        {/* Hidden native file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          onChange={onAttach}
        />

        {/* Attachment Badges */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs text-foreground/80 border border-border/40"
              >
                <FileTextIcon className="size-3 text-muted-foreground" />
                <span className="truncate max-w-36 text-[11px] font-medium">
                  {file.name}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground rounded p-0.5 ml-0.5 cursor-pointer"
                  onClick={() =>
                    setFiles((curr) => curr.filter((f) => f.id !== file.id))
                  }
                  aria-label={`Remove ${file.name}`}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Clean auto-sizing Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="w-full resize-none border-0 bg-transparent px-3 pt-2.5 pb-1 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 min-h-9 max-h-36 field-sizing-content leading-relaxed"
        />

        {/* Minimal Bottom Toolbar */}
        <div className="flex items-center justify-between px-2.5 pb-2 pt-0.5 select-none">
          <div className="flex items-center gap-1">
            {/* Attach Button */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="size-6 text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-md"
                    aria-label="Attach files"
                    onClick={() => inputRef.current?.click()}
                  >
                    <PaperclipIcon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipContent>Attach files</TooltipContent>
            </Tooltip>

            {/* Model Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted/60 transition-colors cursor-pointer"
                  >
                    <span>{currentModel.name}</span>
                    <ChevronDownIcon className="size-2.5 opacity-60" />
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                  {providers.map((provider, index) => (
                    <React.Fragment key={provider.name}>
                      {index > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {provider.name}
                        </DropdownMenuLabel>
                        {provider.models.map((item) => (
                          <DropdownMenuRadioItem
                            key={item.id}
                            value={item.id}
                            className="text-xs"
                          >
                            {item.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuGroup>
                    </React.Fragment>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="icon-xs"
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              "size-6 rounded-full transition-all duration-200 cursor-pointer",
              canSend
                ? "bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:scale-105"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed opacity-60"
            )}
          >
            <ArrowUpIcon className="size-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
