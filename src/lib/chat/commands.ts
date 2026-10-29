import type { DocumentRecord, FileGroup } from "@/lib/library/types";

export interface AgentCommand {
  command: string;
  description: string;
  aliases?: string[];
  promptDirective: string;
}

export const AGENT_COMMANDS: AgentCommand[] = [
  {
    command: "summarize",
    aliases: ["summarise", "summary"],
    description: "Executive summary of the documents with key themes",
    promptDirective:
      "Provide a comprehensive, well-structured executive summary of the document(s). Group findings into clear thematic sections, summarize the core thesis, and cite every passage used with [1], [2].",
  },
  {
    command: "takeaways",
    aliases: ["insights", "keypoints"],
    description: "Extract the most critical findings and actionable takeaways",
    promptDirective:
      "Extract the top high-impact takeaways from the document(s). Present them as clear, punchy bullet points with bold titles, followed by concise explanations and source citations.",
  },
  {
    command: "compare",
    aliases: ["contrast", "diff"],
    description: "Compare perspectives, agreements, and differences between files",
    promptDirective:
      "Compare and contrast the documents or perspectives. Detail where they agree, where they differ, and what complementary insights each brings, citing all sources.",
  },
  {
    command: "explain",
    aliases: ["elaborate", "clarify"],
    description: "Explain a concept, formula, or theorem from the documents simply",
    promptDirective:
      "Explain the requested concept or topic from the documents in clear, accessible language. Define key terms, break down formulas or arguments step-by-step, and ground the explanation with citations.",
  },
  {
    command: "find",
    aliases: ["search", "locate"],
    description: "Find specific facts, quotes, numbers, or definitions",
    promptDirective:
      "Search for the specific fact, quote, number, or detail in the documents. Quote the exact language from the source passages and provide precise citations.",
  },
  {
    command: "quiz",
    aliases: ["test", "qa"],
    description: "Generate comprehension questions and answers from the files",
    promptDirective:
      "Generate 5 comprehensive study and review questions based on the provided material, followed by detailed answers grounded in and citing the source passages.",
  },
  {
    command: "outline",
    aliases: ["structure", "toc"],
    description: "Generate a structured outline of topics covered in the files",
    promptDirective:
      "Create a detailed hierarchical outline of the topics, sections, and arguments presented across the document(s), referencing source sections.",
  },
];

export interface ParsedPrompt {
  raw: string;
  command: AgentCommand | null;
  cleanedText: string;
  mentionedFileNames: string[];
  mentionedGroupNames: string[];
}

/**
 * Parses user input to extract slash commands and @mentions.
 * Handles patterns like:
 *   "/summarize @Probability.pdf focus on Bayes rule"
 *   "@Research compare with @Financials"
 */
export function parsePrompt(
  input: string,
  availableDocuments: DocumentRecord[] = [],
  availableGroups: FileGroup[] = []
): ParsedPrompt {
  const raw = input.trim();
  if (!raw) {
    return {
      raw,
      command: null,
      cleanedText: "",
      mentionedFileNames: [],
      mentionedGroupNames: [],
    };
  }

  let text = raw;
  let matchedCommand: AgentCommand | null = null;

  // Check for leading slash command: e.g. "/summarize" or "/takeaways"
  const commandMatch = text.match(/^\/([a-zA-Z0-9_-]+)(?:\s+|$)/);
  if (commandMatch) {
    const cmdStr = commandMatch[1].toLowerCase();
    matchedCommand =
      AGENT_COMMANDS.find(
        (c) => c.command === cmdStr || (c.aliases && c.aliases.includes(cmdStr))
      ) ?? null;

    if (matchedCommand) {
      // Remove the slash command from the remaining query text
      text = text.slice(commandMatch[0].length).trim();
    }
  }

  // Extract @ mentions: @filename.pdf or @"file with spaces" or @groupname
  const mentionedFileNames: string[] = [];
  const mentionedGroupNames: string[] = [];

  // Match @"quoted text" or @nonWhitespace
  const mentionRegex = /@(?:"([^"]+)"|([^\s@]+))/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    const term = (match[1] || match[2] || "").trim();
    if (term) mentions.push(term);
  }

  const docNameMap = new Map(
    availableDocuments.map((d) => [d.fileName.toLowerCase(), d.fileName])
  );
  const groupNameMap = new Map(
    availableGroups.map((g) => [g.name.toLowerCase(), g.name])
  );

  for (const term of mentions) {
    const termLower = term.toLowerCase();
    // Check if it matches a document name
    const docMatch =
      docNameMap.get(termLower) ||
      availableDocuments.find((d) =>
        d.fileName.toLowerCase().includes(termLower)
      )?.fileName;

    if (docMatch) {
      if (!mentionedFileNames.includes(docMatch)) {
        mentionedFileNames.push(docMatch);
      }
      continue;
    }

    // Check if it matches a group name
    const groupMatch =
      groupNameMap.get(termLower) ||
      availableGroups.find((g) =>
        g.name.toLowerCase().includes(termLower)
      )?.name;

    if (groupMatch) {
      if (!mentionedGroupNames.includes(groupMatch)) {
        mentionedGroupNames.push(groupMatch);
      }
      continue;
    }

    // If neither directly matched but looks like a filename (e.g. ends in .pdf)
    if (term.endsWith(".pdf") && !mentionedFileNames.includes(term)) {
      mentionedFileNames.push(term);
    }
  }

  // Clean mention tokens from text for semantic search query if needed
  let cleanedText = text.replace(/@(?:"([^"]+)"|([^\s@]+))/g, "").replace(/\s+/g, " ").trim();

  // If text was only the command and/or mentions, provide sensible default text for search
  if (!cleanedText && matchedCommand) {
    cleanedText = matchedCommand.command;
  }

  return {
    raw,
    command: matchedCommand,
    cleanedText,
    mentionedFileNames,
    mentionedGroupNames,
  };
}

/**
 * Resolves the IDs of all documents referenced by @ mentions.
 */
export function resolveTargetDocuments(
  mentionedFileNames: string[],
  mentionedGroupNames: string[],
  allDocuments: DocumentRecord[],
  allGroups: FileGroup[]
): {
  targetDocumentIds: string[];
  resolvedFiles: DocumentRecord[];
  resolvedGroups: FileGroup[];
} {
  const targetIds = new Set<string>();
  const resolvedFiles: DocumentRecord[] = [];
  const resolvedGroups: FileGroup[] = [];

  // Match file names
  for (const name of mentionedFileNames) {
    const lower = name.toLowerCase();
    const doc = allDocuments.find(
      (d) =>
        d.fileName.toLowerCase() === lower ||
        d.fileName.toLowerCase().includes(lower)
    );
    if (doc && !targetIds.has(doc.id)) {
      targetIds.add(doc.id);
      resolvedFiles.push(doc);
    }
  }

  // Match group names and include all documents in that group
  for (const name of mentionedGroupNames) {
    const lower = name.toLowerCase();
    const group = allGroups.find(
      (g) => g.name.toLowerCase() === lower || g.name.toLowerCase().includes(lower)
    );
    if (group) {
      if (!resolvedGroups.some((g) => g.id === group.id)) {
        resolvedGroups.push(group);
      }
      const groupDocs = allDocuments.filter((d) => d.groupId === group.id);
      for (const doc of groupDocs) {
        if (!targetIds.has(doc.id)) {
          targetIds.add(doc.id);
          resolvedFiles.push(doc);
        }
      }
    }
  }

  return {
    targetDocumentIds: Array.from(targetIds),
    resolvedFiles,
    resolvedGroups,
  };
}
