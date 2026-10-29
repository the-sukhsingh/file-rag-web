import { describe, expect, it } from "vitest";

import {
  AGENT_COMMANDS,
  parsePrompt,
  resolveTargetDocuments,
} from "./commands";
import type { DocumentRecord, FileGroup } from "@/lib/library/types";

function mockDoc(id: string, fileName: string, groupId?: string | null): DocumentRecord {
  return {
    id,
    fileName,
    name: fileName.replace(/\.pdf$/i, ""),
    folderId: `folder-${id}`,
    pageCount: 5,
    chunkCount: 10,
    usedOutline: false,
    createdAt: 100,
    updatedAt: 100,
    groupId: groupId ?? null,
  };
}

const docs = [
  mockDoc("d1", "probability-short.pdf", "grp-1"),
  mockDoc("d2", "financial-report.pdf", "grp-2"),
  mockDoc("d3", "annual-budget.pdf", "grp-2"),
  mockDoc("d4", "notes.pdf", null),
];

const groups: FileGroup[] = [
  { id: "grp-1", name: "AI Research", createdAt: 1, updatedAt: 1 },
  { id: "grp-2", name: "Finance", createdAt: 2, updatedAt: 2 },
];

describe("agent commands and @mentions parsing", () => {
  it("has predefined commands with directives and aliases", () => {
    expect(AGENT_COMMANDS.length).toBeGreaterThanOrEqual(5);
    const summarize = AGENT_COMMANDS.find((c) => c.command === "summarize");
    expect(summarize).toBeDefined();
    expect(summarize?.aliases).toContain("summary");
    expect(summarize?.promptDirective).toContain("summary");
  });

  it("parses slash command without mentions", () => {
    const parsed = parsePrompt("/summarize give me a quick overview");
    expect(parsed.command?.command).toBe("summarize");
    expect(parsed.cleanedText).toBe("give me a quick overview");
    expect(parsed.mentionedFileNames).toEqual([]);
  });

  it("parses slash command aliases like /summary or /diff", () => {
    const parsedSummary = parsePrompt("/summary");
    expect(parsedSummary.command?.command).toBe("summarize");
    expect(parsedSummary.cleanedText).toBe("summarize");

    const parsedDiff = parsePrompt("/diff what changed?");
    expect(parsedDiff.command?.command).toBe("compare");
    expect(parsedDiff.cleanedText).toBe("what changed?");
  });

  it("parses @file mentions", () => {
    const parsed = parsePrompt(
      "Analyze @probability-short.pdf and tell me about Bayes",
      docs,
      groups
    );
    expect(parsed.command).toBeNull();
    expect(parsed.mentionedFileNames).toEqual(["probability-short.pdf"]);
    expect(parsed.cleanedText).toBe("Analyze and tell me about Bayes");
  });

  it("parses combined slash command and @file mention", () => {
    const parsed = parsePrompt(
      "/takeaways @probability-short.pdf main principles",
      docs,
      groups
    );
    expect(parsed.command?.command).toBe("takeaways");
    expect(parsed.mentionedFileNames).toEqual(["probability-short.pdf"]);
    expect(parsed.cleanedText).toBe("main principles");
  });

  it("parses @group mentions", () => {
    const parsed = parsePrompt("/compare @Finance", docs, groups);
    expect(parsed.command?.command).toBe("compare");
    expect(parsed.mentionedGroupNames).toEqual(["Finance"]);
  });

  it("parses multiple @mentions", () => {
    const parsed = parsePrompt(
      "/compare @probability-short.pdf with @financial-report.pdf",
      docs,
      groups
    );
    expect(parsed.command?.command).toBe("compare");
    expect(parsed.mentionedFileNames).toContain("probability-short.pdf");
    expect(parsed.mentionedFileNames).toContain("financial-report.pdf");
  });

  it("handles quoted mentions with spaces", () => {
    const parsed = parsePrompt(
      'Review @"AI Research" on methodology',
      docs,
      groups
    );
    expect(parsed.mentionedGroupNames).toEqual(["AI Research"]);
  });

  describe("resolveTargetDocuments", () => {
    it("resolves file mentions to document IDs", () => {
      const resolved = resolveTargetDocuments(
        ["probability-short.pdf"],
        [],
        docs,
        groups
      );
      expect(resolved.targetDocumentIds).toEqual(["d1"]);
      expect(resolved.resolvedFiles.map((d) => d.id)).toEqual(["d1"]);
    });

    it("resolves group mentions to all documents in the group", () => {
      const resolved = resolveTargetDocuments([], ["Finance"], docs, groups);
      expect(resolved.targetDocumentIds).toContain("d2");
      expect(resolved.targetDocumentIds).toContain("d3");
      expect(resolved.resolvedGroups.map((g) => g.id)).toEqual(["grp-2"]);
    });

    it("resolves both files and groups deduplicating IDs", () => {
      const resolved = resolveTargetDocuments(
        ["financial-report.pdf"],
        ["Finance"],
        docs,
        groups
      );
      expect(resolved.targetDocumentIds).toHaveLength(2);
      expect(resolved.targetDocumentIds).toContain("d2");
      expect(resolved.targetDocumentIds).toContain("d3");
    });
  });
});
