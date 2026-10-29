import * as React from "react";
import { createWorkspaceShell, type WorkspaceShell, type ShellResult } from "./workspace-shell";
import { listChunksByDocument } from "@/lib/library/store";
import type { DocumentRecord } from "@/lib/library/types";

export interface UseWorkspaceShellReturn {
  shell: WorkspaceShell | null;
  files: string[];
  passageCount: number;
  isLoading: boolean;
  runCommand: (command: string) => Promise<ShellResult>;
  refresh: () => Promise<void>;
}

export function useWorkspaceShell(documents: DocumentRecord[]): UseWorkspaceShellReturn {
  const [shell, setShell] = React.useState<WorkspaceShell | null>(null);
  const [files, setFiles] = React.useState<string[]>([]);
  const [passageCount, setPassageCount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // Serialize document ids and modification times to trigger updates only when documents change
  const docsKey = React.useMemo(() => {
    return documents.map((d) => `${d.id}:${d.chunkCount}`).join("|");
  }, [documents]);

  const initShell = React.useCallback(async () => {
    if (!documents.length) {
      // Empty workspace shell
      const empty = await createWorkspaceShell([], new Map());
      setShell(empty);
      setFiles([]);
      setPassageCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const groups = await Promise.all(documents.map((d) => listChunksByDocument(d.id)));
      const chunks = groups.flat();
      const documentNames = new Map(documents.map((d) => [d.id, d.fileName]));
      const nextShell = await createWorkspaceShell(chunks, documentNames);
      setShell(nextShell);
      setFiles(nextShell.files);
      setPassageCount(chunks.length);
    } catch (err) {
      console.error("Failed to build workspace shell:", err);
    } finally {
      setIsLoading(false);
    }
  }, [docsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    void initShell();
  }, [initShell]);

  const runCommand = React.useCallback(
    async (command: string): Promise<ShellResult> => {
      if (!shell) {
        return {
          stdout: "",
          stderr: "Shell is initializing, please wait...",
          exitCode: 1,
          truncated: false,
        };
      }
      return shell.run(command);
    },
    [shell]
  );

  return {
    shell,
    files,
    passageCount,
    isLoading,
    runCommand,
    refresh: initShell,
  };
}

