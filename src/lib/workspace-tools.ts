import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { runWorkspaceCommand, type CommandOutput } from "@/lib/server/vfs";

/**
 * Retrieval tools for the workspace: one per shell command an agent naturally
 * reaches for when it goes looking for information.
 *
 * The bash tool alone was not enough. Models read "grep for keywords, then cat
 * the matches" and call `cat` and `grep` *as tools*, and Groq rejects the whole
 * request non-retryably when the model calls a tool that was not advertised:
 *
 *   AI_APICallError: attempted to call tool 'cat' which was not in request.tools
 *
 * Advertising `ls`, `cat`, `grep`, `find`, `head`, `tail`, `wc` and `tree` as
 * real tools keeps those calls valid, and each one runs through the same
 * `runWorkspaceCommand` path as the bash tool so the workspace bookkeeping,
 * command cap and reported output stay identical.
 */

/** Single-quotes a shell argument so paths with spaces stay one word. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Keeps model-supplied numbers inside a sane range. */
function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function createWorkspaceTools(sessionId: string): ToolSet {
  const run = (command: string): Promise<CommandOutput> =>
    runWorkspaceCommand(sessionId, command);

  return {
    ls: tool({
      description:
        "List the files and folders in a workspace directory. Start here to learn the chapter folders and chunk files that exist.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Directory to list, relative to the working directory. Defaults to the workspace root."),
        all: z.boolean().optional().describe("Include hidden dotfiles."),
        recursive: z.boolean().optional().describe("List subdirectories as well."),
      }),
      execute: async ({ path: dir, all, recursive }) =>
        run(
          `ls -1${all ? "a" : ""}${recursive ? "R" : ""} ${quote(dir || ".")}`
        ),
    }),

    tree: tool({
      description:
        "Show the workspace as a folder tree. Useful for questions about document structure, chapters or how the chunks are organised.",
      inputSchema: z.object({
        path: z.string().optional().describe("Directory to print. Defaults to the workspace root."),
        depth: z.number().optional().describe("Maximum folder depth to show (default 3)."),
        all: z.boolean().optional().describe("Include hidden dotfiles."),
      }),
      execute: async ({ path: dir, depth, all }) =>
        run(
          `tree -L ${clamp(depth, 1, 10, 3)}${all ? " -a" : ""} ${quote(dir || ".")}`
        ),
    }),

    find: tool({
      description:
        "Find files by name using a glob pattern such as '*.md' or '*chunk*'. Use it when you know part of a file name but not its folder.",
      inputSchema: z.object({
        pattern: z.string().describe("Glob for the file name, e.g. '*.md' or '*chapter*'."),
        path: z.string().optional().describe("Directory to search in. Defaults to the workspace root."),
        maxDepth: z.number().optional().describe("Maximum folder depth to descend."),
      }),
      execute: async ({ pattern: glob, path: dir, maxDepth }) =>
        run(
          `find ${quote(dir || ".")}${maxDepth ? ` -maxdepth ${clamp(maxDepth, 1, 20, 20)}` : ""} -type f -name ${quote(glob)}`
        ),
    }),

    grep: tool({
      description:
        "Search file contents with a regular expression and return matching file:line:text rows. This is the fastest way to locate a keyword before reading anything, so search first and read second.",
      inputSchema: z.object({
        pattern: z.string().describe("Regular expression to search for, e.g. 'rank|bm25'."),
        path: z.string().optional().describe("File or directory to search. Defaults to the workspace root."),
        ignoreCase: z.boolean().optional().describe("Match case-insensitively."),
        filesOnly: z.boolean().optional().describe("Return only the names of matching files."),
        maxMatchesPerFile: z.number().optional().describe("Cap on matches per file (default 50)."),
      }),
      execute: async ({ pattern: regex, path: target, ignoreCase, filesOnly, maxMatchesPerFile }) =>
        run(
          `grep -rn${ignoreCase ? "i" : ""}${filesOnly ? "l" : ""} -m ${clamp(maxMatchesPerFile, 1, 500, 50)} ${quote(regex)} ${quote(target || ".")}`
        ),
    }),

    cat: tool({
      description:
        "Read a file from the workspace. Use the line range for long chunks so you only pull in the part you need.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file, relative to the working directory."),
        startLine: z.number().optional().describe("First line to read (1-based)."),
        endLine: z.number().optional().describe("Last line to read, inclusive."),
        lineNumbers: z.boolean().optional().describe("Prefix every line with its line number."),
      }),
      execute: async ({ path: file, startLine, endLine, lineNumbers }) => {
        const target = quote(file);
        if (startLine || endLine) {
          const from = clamp(startLine, 1, Number.MAX_SAFE_INTEGER, 1);
          const to = clamp(endLine, from, Number.MAX_SAFE_INTEGER, from);
          return run(
            lineNumbers
              ? `nl -ba ${target} | sed -n '${from},${to}p'`
              : `sed -n '${from},${to}p' ${target}`
          );
        }
        return run(`cat${lineNumbers ? " -n" : ""} ${target}`);
      },
    }),

    head: tool({
      description: "Show the first lines of a file. Good for previewing a chunk without reading all of it.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file, relative to the working directory."),
        lines: z.number().optional().describe("How many lines to show (default 40)."),
      }),
      execute: async ({ path: file, lines }) =>
        run(`head -n ${clamp(lines, 1, 500, 40)} ${quote(file)}`),
    }),

    tail: tool({
      description: "Show the last lines of a file.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file, relative to the working directory."),
        lines: z.number().optional().describe("How many lines to show (default 40)."),
      }),
      execute: async ({ path: file, lines }) =>
        run(`tail -n ${clamp(lines, 1, 500, 40)} ${quote(file)}`),
    }),

    wc: tool({
      description:
        "Count the lines, words or characters in a file. Handy for sizing a chunk before reading it.",
      inputSchema: z.object({
        path: z.string().describe("Path to the file, relative to the working directory."),
        mode: z
          .enum(["lines", "words", "chars", "all"])
          .optional()
          .describe("What to count. Defaults to lines."),
      }),
      execute: async ({ path: file, mode }) => {
        const flag =
          mode === "words" ? "-w" : mode === "chars" ? "-c" : mode === "all" ? "-lwc" : "-l";
        return run(`wc ${flag} ${quote(file)}`);
      },
    }),
  };
}
