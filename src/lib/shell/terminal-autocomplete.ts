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
  { name: "grep", desc: "Search files for lines matching pattern (e.g. grep -rni 'term' .)" },
  { name: "rg", desc: "Fast ripgrep pattern search" },
  { name: "cat", desc: "Print file contents to screen (e.g. cat path/to/file.md)" },
  { name: "ls", desc: "List files and directories" },
  { name: "find", desc: "Find files in directory hierarchy (e.g. find /workspace -type f)" },
  { name: "head", desc: "Output first lines of files (e.g. head -n 20 file.md)" },
  { name: "tail", desc: "Output last lines of files (e.g. tail -n 20 file.md)" },
  { name: "wc", desc: "Print newline, word, and byte count (e.g. wc -l file.md)" },
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
    { flag: "-rni", desc: "Recursive, numbered, case-insensitive search" },
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
  head: [
    { flag: "-n", desc: "Number of lines to output" },
  ],
  tail: [
    { flag: "-n", desc: "Number of lines to output" },
  ],
  wc: [
    { flag: "-l", desc: "Count lines" },
    { flag: "-w", desc: "Count words" },
    { flag: "-c", desc: "Count bytes" },
  ],
};

/**
 * Builds directories and file lists suitable for autocompletion from a list of mounted file paths.
 */
export function buildFilesystemIndex(files: string[]): {
  absolutePaths: Set<string>;
  relativePaths: Set<string>;
  directories: Set<string>;
} {
  const absolutePaths = new Set<string>();
  const relativePaths = new Set<string>();
  const directories = new Set<string>();

  for (const filePath of files) {
    absolutePaths.add(filePath);

    // Extract relative path from /workspace
    const rel = filePath.startsWith("/workspace/")
      ? filePath.slice("/workspace/".length)
      : filePath.startsWith("/workspace")
      ? filePath.slice("/workspace".length)
      : filePath;

    if (rel) {
      relativePaths.add(rel);
    }

    // Extract parent directories
    const parts = filePath.split("/").filter(Boolean);
    let cur = "";
    for (let i = 0; i < parts.length - 1; i++) {
      cur += "/" + parts[i];
      directories.add(cur);
      if (cur.startsWith("/workspace/")) {
        directories.add(cur.slice("/workspace/".length));
      }
    }
  }

  return { absolutePaths, relativePaths, directories };
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
  const isFirstWord = tokenStart <= (input.length - trimmedBefore.length + (firstWordMatch ? firstWordMatch[1].length : 0));

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

    // 3. Files and directories completion
    const isAbs = token.startsWith("/");
    const { absolutePaths, relativePaths, directories } = buildFilesystemIndex(files);

    const targetList = isAbs ? Array.from(absolutePaths) : Array.from(relativePaths);
    const targetDirs = Array.from(directories).filter((d) => (isAbs ? d.startsWith("/") : !d.startsWith("/")));

    const lowToken = token.toLowerCase();

    // Directory suggestions (append trailing slash)
    for (const dir of targetDirs) {
      const dirSlash = dir.endsWith("/") ? dir : `${dir}/`;
      if (dirSlash.toLowerCase().startsWith(lowToken) && dirSlash !== token) {
        // Only suggest immediate child directory level if possible
        suggestions.push({
          value: dirSlash.includes(" ") ? `"${dirSlash}"` : dirSlash,
          display: dirSlash,
          type: "directory",
          description: "directory",
        });
      }
    }

    // File suggestions
    for (const file of targetList) {
      if (file.toLowerCase().startsWith(lowToken)) {
        suggestions.push({
          value: file.includes(" ") ? `"${file}"` : file,
          display: file,
          type: "file",
          description: "markdown passage",
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
    if (firstVal.toLowerCase().startsWith(token.toLowerCase())) {
      ghostText = firstVal.slice(token.length);
    }
  }

  return {
    token,
    tokenStart,
    tokenEnd,
    suggestions: uniqueSuggestions.slice(0, 20),
    ghostText,
  };
}

