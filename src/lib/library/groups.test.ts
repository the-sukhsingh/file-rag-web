import { describe, expect, it } from "vitest";

import {
  getDocumentsInGroup,
  getSingleGroupContext,
  selectOnlyGroup,
  toggleGroupSelection,
} from "./groups";
import type { DocumentRecord, FileGroup } from "./types";

function createDoc(id: string, groupId?: string | null): DocumentRecord {
  return {
    id,
    folderId: `f-${id}`,
    name: `Name ${id}`,
    fileName: `${id}.pdf`,
    pageCount: 1,
    chunkCount: 2,
    usedOutline: false,
    createdAt: 100,
    updatedAt: 100,
    groupId: groupId ?? null,
  };
}

const mockGroups: FileGroup[] = [
  { id: "grp-1", name: "Invoices", createdAt: 1, updatedAt: 1 },
  { id: "grp-2", name: "Contracts", createdAt: 2, updatedAt: 2 },
];

describe("group helper functions", () => {
  it("filters documents belonging to a group", () => {
    const docs = [
      createDoc("d1", "grp-1"),
      createDoc("d2", "grp-1"),
      createDoc("d3", "grp-2"),
      createDoc("d4", null),
    ];

    const grp1Docs = getDocumentsInGroup(docs, mockGroups, "grp-1");
    expect(grp1Docs.map((d) => d.id)).toEqual(["d1", "d2"]);

    const ungrouped = getDocumentsInGroup(docs, mockGroups, null);
    expect(ungrouped.map((d) => d.id)).toEqual(["d4"]);
  });

  it("handles ungrouped documents when groupId is unknown or deleted", () => {
    const docs = [createDoc("d1", "deleted-group"), createDoc("d2", "grp-1")];
    const ungrouped = getDocumentsInGroup(docs, mockGroups, null);
    expect(ungrouped.map((d) => d.id)).toEqual(["d1"]);
  });

  describe("toggleGroupSelection", () => {
    it("selects all documents in group when none were selected", () => {
      const docs = [createDoc("d1", "grp-1"), createDoc("d2", "grp-1"), createDoc("d3", "grp-2")];
      const excludedIds = new Set(["d1", "d2", "d3"]);

      const next = toggleGroupSelection({
        documents: docs,
        groups: mockGroups,
        excludedIds,
        targetGroupId: "grp-1",
      });

      expect(next.has("d1")).toBe(false);
      expect(next.has("d2")).toBe(false);
      expect(next.has("d3")).toBe(true);
    });

    it("selects all documents in group when some were selected", () => {
      const docs = [createDoc("d1", "grp-1"), createDoc("d2", "grp-1")];
      // d1 is selected (not in excludedIds), d2 is excluded
      const excludedIds = new Set(["d2"]);

      const next = toggleGroupSelection({
        documents: docs,
        groups: mockGroups,
        excludedIds,
        targetGroupId: "grp-1",
      });

      expect(next.has("d1")).toBe(false);
      expect(next.has("d2")).toBe(false);
    });

    it("deselects all documents in group when all were selected", () => {
      const docs = [createDoc("d1", "grp-1"), createDoc("d2", "grp-1")];
      const excludedIds = new Set<string>();

      const next = toggleGroupSelection({
        documents: docs,
        groups: mockGroups,
        excludedIds,
        targetGroupId: "grp-1",
      });

      expect(next.has("d1")).toBe(true);
      expect(next.has("d2")).toBe(true);
    });

    it("toggles ungrouped files when targetGroupId is null", () => {
      const docs = [createDoc("d1", null), createDoc("d2", "grp-1")];
      const excludedIds = new Set(["d1"]);

      const next = toggleGroupSelection({
        documents: docs,
        groups: mockGroups,
        excludedIds,
        targetGroupId: null,
      });

      expect(next.has("d1")).toBe(false);
    });
  });

  describe("selectOnlyGroup", () => {
    it("selects only target group and excludes all other documents", () => {
      const docs = [
        createDoc("d1", "grp-1"),
        createDoc("d2", "grp-1"),
        createDoc("d3", "grp-2"),
        createDoc("d4", null),
      ];

      const next = selectOnlyGroup({
        documents: docs,
        groups: mockGroups,
        targetGroupId: "grp-1",
      });

      // Target group should NOT be excluded
      expect(next.has("d1")).toBe(false);
      expect(next.has("d2")).toBe(false);
      // Other docs should be excluded
      expect(next.has("d3")).toBe(true);
      expect(next.has("d4")).toBe(true);
    });
  });

  describe("getSingleGroupContext", () => {
    it("returns null when no documents are selected", () => {
      expect(getSingleGroupContext([], mockGroups)).toBeNull();
    });

    it("returns the group when all documents belong to it", () => {
      const docs = [createDoc("d1", "grp-1"), createDoc("d2", "grp-1")];
      const result = getSingleGroupContext(docs, mockGroups);
      expect(result?.id).toBe("grp-1");
      expect(result?.name).toBe("Invoices");
    });

    it("returns null when documents belong to mixed groups", () => {
      const docs = [createDoc("d1", "grp-1"), createDoc("d2", "grp-2")];
      expect(getSingleGroupContext(docs, mockGroups)).toBeNull();
    });

    it("returns null when documents are ungrouped", () => {
      const docs = [createDoc("d1", null)];
      expect(getSingleGroupContext(docs, mockGroups)).toBeNull();
    });
  });
});
