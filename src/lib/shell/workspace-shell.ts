import { Bash } from "just-bash/browser";

import type { Chunk } from "@/lib/library/types";

/**
 * The shell the agent works in.
 *
 * The passages of a folder are written to a real virtual filesystem, one file
 * per passage, so the agent can reach for them with `grep`, `cat`, `head` and
 * `wc` - the same way it would reach for files on a disk. The vector search
 * and the shell are two views of the same library: one finds by meaning, the
 * other finds by pattern.
 *
 * The shell runs entirely in the browser against an in-memory filesystem.
 * Nothing is written to the user's machine and nothing leaves it.
 */

/** Where the passages are mounted. */
export const WORKSPACE_ROOT = "/workspace";

/** The largest a single command's output may be, so a stray `cat` cannot
 *  blow up the context window. */
const MAX_OUTPUT_CHARS = 20_000;

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** True when the output was cut short. */
  truncated: boolean;
}

export interface WorkspaceShell {
  /** Runs a command line and returns what it printed. */
  run: (command: string) => Promise<ShellResult>;
  /** The files that are mounted, as workspace-relative paths. */
  files: string[];
  /** A map of workspace-relative path to the chunk id behind it. */
  chunkByPath: Map<string, string>;
}

/**
 * The path a passage is mounted at.
 *
 * The chapter and the passage number are in the path, so the agent can find a
 * passage by its name in a `ls` and reason about where it sits.
 */
export function chunkPath(
  documentName: string,
  section: string,
  index: number
): string {
  const safe = (value: string) =>
    value
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "untitled";

  const padded = String(index + 1).padStart(3, "0");

  return `${WORKSPACE_ROOT}/${safe(documentName)}/${safe(section)}/${padded}.md`;
}

/**
 * Builds a shell over the passages of a folder.
 */
export async function createWorkspaceShell(
  chunks: Chunk[],
  documentNames: Map<string, string>
): Promise<WorkspaceShell> {
  const files: Record<string, string> = {};
  const chunkByPath = new Map<string, string>();

  for (const chunk of chunks) {
    const documentName = documentNames.get(chunk.documentId) ?? "document";
    const path = chunkPath(documentName, chunk.section, chunk.index);

    // Two passages can land on the same path if a section repeats, so the
    // name is made unique rather than one file overwriting the other.
    let unique = path;
    let suffix = 2;
    while (files[unique] !== undefined) {
      unique = path.replace(/\.md$/, `-${suffix}.md`);
      suffix += 1;
    }

    files[unique] = chunk.text;
    chunkByPath.set(unique, chunk.id);
  }

  const bash = new Bash({
    files,
    cwd: WORKSPACE_ROOT,
    env: { HOME: WORKSPACE_ROOT },
    // The shell only ever reads, so the commands that change things are left
    // out. `grep`, `cat`, `head`, `tail`, `wc`, `ls`, `find` and `tree` are
    // what a search needs.
    commands: [
      "ls",
      "cat",
      "head",
      "tail",
      "grep",
      "rg",
      "find",
      "wc",
      "tree",
      "sort",
      "uniq",
      "cut",
      "tr",
      "sed",
      "awk",
      "echo",
      "pwd",
      "which",
      "basename",
      "dirname",
      "expr",
    ],
  });

  return {
    run: async (command: string): Promise<ShellResult> => {
      const result = await bash.exec(command, { signal: undefined });

      const stdout = result.stdout ?? "";
      const stderr = result.stderr ?? "";
      const truncated = stdout.length > MAX_OUTPUT_CHARS;

      return {
        stdout: truncated
          ? `${stdout.slice(0, MAX_OUTPUT_CHARS)}\n[... ${stdout.length - MAX_OUTPUT_CHARS} more characters]`
          : stdout,
        stderr: stderr.slice(0, 4_000),
        exitCode: result.exitCode ?? 0,
        truncated,
      };
    },
    files: Object.keys(files),
    chunkByPath,
  };
}

/**
 * The instructions the agent gets for the shell.
 */
export const SHELL_INSTRUCTIONS = [
  "You also have a shell over the same passages, mounted as files under",
  `${WORKSPACE_ROOT}. Each passage is one markdown file, and the path shows`,
  "the document, the chapter and the passage number.",
  "",
  "Use it when a question is about a term, a name, a number or a phrase that",
  "the vector search may have missed - the shell is exact, the search is by",
  "meaning. For example:",
  `  grep -rn "probability" ${WORKSPACE_ROOT}`,
  `  ls ${WORKSPACE_ROOT}/Handbook`,
  `  wc -l ${WORKSPACE_ROOT}/Handbook/*/*.md`,
  "",
  "Read a passage with `cat`, not with the whole file, when a file is long.",
].join("\n");
