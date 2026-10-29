export interface AutocompleteSuggestion {
  value: string;
  display?: string;
  type: "command" | "file" | "directory" | "flag" | "history";
  description?: string;
}

export interface AutocompleteResult {
  token: string;
  tokenStart: number;
  tokenEnd: number;
  suggestions: AutocompleteSuggestion[];
  ghostText?: string;
}

export const SHELL_COMMANDS: Array<{ name: string; desc: string }> = [
  { name: "grep", desc: "Search files for pattern: grep -rni 'term' ." },
  { name: "rg", desc: "Fast ripgrep pattern search: rg 'pattern'" },
  { name: "cat", desc: "Print file contents: cat <path>" },
  { name: "ls", desc: "List files and directories: ls -la" },
  { name: "find", desc: "Find files in hierarchy: find /workspace -type f" },
  { name: "head", desc: "Output first lines: head -n 20 <path>" },
  { name: "tail", desc: "Output last lines: tail -n 20 <path>" },
  { name: "wc", desc: "Count lines/words: wc -l <path>" },
  { name: "tree", desc: "Display directory structure as tree" },
  { name: "pwd", desc: "Print current working directory" },
  { name: "clear", desc: "Clear terminal screen" },
  { name: "help", desc: "List available commands and guidance" },
  { name: "echo", desc: "Print text to standard output" },
  { name: "sort", desc: "Sort lines of text" },
  { name: "uniq", desc: "Filter duplicate lines" },
];

export const COMMON_FLAGS: Record<string, Array<{ flag: string; desc: string }>> = {
  grep: [
    { flag: "-r", desc: "Search recursively" },
    { flag: "-n", desc: "Show line numbers" },
    { flag: "-i", desc: "Ignore case" },
    { flag: "-rni", desc: "Recursive, numbered, case-insensitive" },
    { flag: "-l", desc: "List matching filenames only" },
    { flag: "-c", desc: "Count matching lines" },
  ],
  rg: [
    { flag: "-i", desc: "Case insensitive" },
    { flag: "-l", desc: "Print only files with matches" },
  ],
  find: [
    { flag: "-type f", desc: "Search regular files" },
    { flag: "-type d", desc: "Search directories" },
    { flag: "-name", desc: "Pattern match on filename" },
  ],
  ls: [
    { flag: "-l", desc: "Long listing format" },
    { flag: "-a", desc: "Show all files including hidden" },
    { flag: "-la", desc: "Long format including hidden" },
  ],
  head: [{ flag: "-n", desc: "Number of lines to output" }],
  tail: [{ flag: "-n", desc: "Number of lines to output" }],
  wc: [
    { flag: "-l", desc: "Count lines" },
    { flag: "-w", desc: "Count words" },
    { flag: "-c", desc: "Count bytes" },
  ],
};

/**
 * Returns immediate children (directories and files) at a given parent directory path,
 * mimicking a real POSIX shell path completion.
 */
export function getFilesystemChildren(
  files: string[],
  parentPath: string
): Array<{ name: string; isDir: boolean; fullRelPath: string; count?: number }> {
  // Normalize parent path relative to /workspace
  let normParent = parentPath.trim().replace(/^"/, "").replace(/"$/, "");
  if (normParent.startsWith("/workspace/")) {
    normParent = normParent.slice("/workspace/".length);
  } else if (normParent === "/workspace" || normParent === "/workspace/") {
    normParent = "";
  } else if (normParent.startsWith("/")) {
    normParent = normParent.slice(1);
  }
  if (normParent.endsWith("/")) {
    normParent = normParent.slice(0, -1);
  }

  const dirs = new Map<string, number>();
  const directFiles = new Set<string>();

  for (const filePath of files) {
    const rel = filePath.startsWith("/workspace/")
      ? filePath.slice("/workspace/".length)
      : filePath.startsWith("/workspace")
      ? filePath.slice("/workspace".length)
      : filePath;

    if (!normParent) {
      // Direct children of /workspace
      const slashIdx = rel.indexOf("/");
      if (slashIdx === -1) {
        directFiles.add(rel);
      } else {
        const dirName = rel.slice(0, slashIdx);
        dirs.set(dirName, (dirs.get(dirName) ?? 0) + 1);
      }
    } else {
      // Must be under normParent
      const prefix = normParent + "/";
      if (rel.startsWith(prefix)) {
        const sub = rel.slice(prefix.length);
        const slashIdx = sub.indexOf("/");
        if (slashIdx === -1) {
          directFiles.add(sub);
        } else {
          const dirName = sub.slice(0, slashIdx);
          dirs.set(dirName, (dirs.get(dirName) ?? 0) + 1);
        }
      }
    }
  }

  const results: Array<{ name: string; isDir: boolean; fullRelPath: string; count?: number }> = [];

  // Directories first (alphabetical)
  const sortedDirs = Array.from(dirs.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  for (const d of sortedDirs) {
    results.push({
      name: `${d}/`,
      isDir: true,
      fullRelPath: normParent ? `${normParent}/${d}/` : `${d}/`,
      count: dirs.get(d),
    });
  }

  // Files second (natural sort, e.g. 001.md, 002.md, 010.md)
  const sortedFiles = Array.from(directFiles).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
  for (const f of sortedFiles) {
    results.push({
      name: f,
      isDir: false,
      fullRelPath: normParent ? `${normParent}/${f}` : f,
    });
  }

  return results;
}

/**
 * Parses the command line at cursor to determine active token and prefix.
 */
export function getActiveToken(input: string, cursor: number): {
  token: string;
  tokenStart: number;
  tokenEnd: number;
  isFirstWord: boolean;
  commandName: string;
} {
  const textBefore = input.slice(0, cursor);

  // Find start of current token
  let tokenStart = cursor;
  while (tokenStart > 0 && !/\s/.test(input[tokenStart - 1])) {
    tokenStart--;
  }

  // Find end of current token
  let tokenEnd = cursor;
  while (tokenEnd < input.length && !/\s/.test(input[tokenEnd])) {
    tokenEnd++;
  }

  const token = input.slice(tokenStart, tokenEnd);

  // Parse command name (first non-whitespace token)
  const trimmedBefore = textBefore.trimStart();
  const firstWordMatch = trimmedBefore.match(/^([^\s]+)/);
  const commandName = firstWordMatch ? firstWordMatch[1] : "";
  const isFirstWord =
    tokenStart <=
    input.length -
      trimmedBefore.length +
      (firstWordMatch ? firstWordMatch[1].length : 0);

  return { token, tokenStart, tokenEnd, isFirstWord, commandName };
}

/**
 * Gets autocompletions and ghost suggestion for current input and cursor.
 */
export function getTerminalCompletions(
  input: string,
  cursor: number,
  files: string[],
  history: string[] = []
): AutocompleteResult {
  const { token, tokenStart, tokenEnd, isFirstWord, commandName } = getActiveToken(input, cursor);
  const suggestions: AutocompleteSuggestion[] = [];

  // 1. First word: Complete shell commands
  if (isFirstWord) {
    const lowToken = token.toLowerCase();
    for (const cmd of SHELL_COMMANDS) {
      if (!token || cmd.name.toLowerCase().startsWith(lowToken)) {
        suggestions.push({
          value: cmd.name,
          display: cmd.name,
          type: "command",
          description: cmd.desc,
        });
      }
    }
  } else {
    // 2. Flags completion if token starts with '-'
    if (token.startsWith("-") && commandName && COMMON_FLAGS[commandName]) {
      for (const flagItem of COMMON_FLAGS[commandName]) {
        if (flagItem.flag.startsWith(token)) {
          suggestions.push({
            value: flagItem.flag,
            display: flagItem.flag,
            type: "flag",
            description: flagItem.desc,
          });
        }
      }
    }

    // 3. Hierarchical filesystem completion
    const rawCleanToken = token.replace(/^"/, "").replace(/"$/, "");
    const lastSlashIndex = rawCleanToken.lastIndexOf("/");

    let parentPath = "";
    let needle = rawCleanToken;

    if (lastSlashIndex !== -1) {
      parentPath = rawCleanToken.slice(0, lastSlashIndex + 1);
      needle = rawCleanToken.slice(lastSlashIndex + 1);
    }

    const lowNeedle = needle.toLowerCase();
    const children = getFilesystemChildren(files, parentPath);

    for (const child of children) {
      if (!lowNeedle || child.name.toLowerCase().startsWith(lowNeedle)) {
        const fullPath = parentPath + child.name;
        const requiresQuotes = fullPath.includes(" ");
        const completionVal = requiresQuotes ? `"${fullPath}"` : fullPath;

        suggestions.push({
          value: completionVal,
          display: child.name,
          type: child.isDir ? "directory" : "file",
          description: child.isDir
            ? `${child.count ?? 1} item${(child.count ?? 1) === 1 ? "" : "s"}`
            : "passage",
        });
      }
    }
  }

  // Deduplicate suggestions by value
  const seen = new Set<string>();
  const uniqueSuggestions = suggestions.filter((s) => {
    if (seen.has(s.value)) return false;
    seen.add(s.value);
    return true;
  });

  // Calculate ghost text
  let ghostText: string | undefined;

  // First check if current input can be matched by command history
  if (input.trim().length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h.startsWith(input) && h !== input) {
        ghostText = h.slice(input.length);
        break;
      }
    }
  }

  // If no history ghost text, check if first suggestion can complete current token
  if (!ghostText && uniqueSuggestions.length > 0 && cursor === input.length && token.length > 0) {
    const firstVal = uniqueSuggestions[0].value.replace(/^"/, "").replace(/"$/, "");
    const cleanToken = token.replace(/^"/, "");
    if (firstVal.toLowerCase().startsWith(cleanToken.toLowerCase())) {
      ghostText = firstVal.slice(cleanToken.length);
    }
  }

  return {
    token,
    tokenStart,
    tokenEnd,
    suggestions: uniqueSuggestions.slice(0, 15),
    ghostText,
  };
}
