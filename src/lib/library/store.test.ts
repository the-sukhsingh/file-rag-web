import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentRecord, FileGroup } from "./types";

let store: typeof import("./store");

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
  store = await import("./store");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("library store groups", () => {
  it("lists empty groups by default", async () => {
    const groups = await store.listGroups();
    expect(groups).toEqual([]);
  });

  it("puts and lists file groups", async () => {
    const group1: FileGroup = {
      id: "grp-1",
      name: "Research",
      createdAt: 1000,
      updatedAt: 1000,
      accent: "indigo",
    };
    const group2: FileGroup = {
      id: "grp-2",
      name: "Finance",
      createdAt: 2000,
      updatedAt: 2000,
      accent: "teal",
    };

    await store.putGroup(group1);
    await store.putGroup(group2);

    const groups = await store.listGroups();
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === "grp-1")?.name).toBe("Research");
    expect(groups.find((g) => g.id === "grp-2")?.name).toBe("Finance");
  });

  it("assigns and removes documents to/from groups", async () => {
    const doc: DocumentRecord = {
      id: "doc-1",
      folderId: "folder-1",
      name: "Paper",
      fileName: "paper.pdf",
      pageCount: 5,
      chunkCount: 10,
      usedOutline: false,
      createdAt: 100,
      updatedAt: 100,
    };
    await store.putDocument(doc);

    await store.updateDocumentGroup("doc-1", "grp-1");
    let docs = await store.listDocuments();
    expect(docs[0]?.groupId).toBe("grp-1");

    await store.updateDocumentGroup("doc-1", null);
    docs = await store.listDocuments();
    expect(docs[0]?.groupId).toBeNull();
  });

  it("updates multiple documents at once", async () => {
    const doc1: DocumentRecord = {
      id: "doc-1",
      folderId: "f-1",
      name: "D1",
      fileName: "d1.pdf",
      pageCount: 1,
      chunkCount: 1,
      usedOutline: false,
      createdAt: 100,
      updatedAt: 100,
    };
    const doc2: DocumentRecord = {
      id: "doc-2",
      folderId: "f-2",
      name: "D2",
      fileName: "d2.pdf",
      pageCount: 1,
      chunkCount: 1,
      usedOutline: false,
      createdAt: 100,
      updatedAt: 100,
    };
    await store.putDocument(doc1);
    await store.putDocument(doc2);

    await store.updateDocumentsGroup(["doc-1", "doc-2"], "grp-batch");
    const docs = await store.listDocuments();
    expect(docs.every((d) => d.groupId === "grp-batch")).toBe(true);
  });

  it("deleting a group unassigns documents without deleting them", async () => {
    const group: FileGroup = {
      id: "grp-x",
      name: "To be deleted",
      createdAt: 500,
      updatedAt: 500,
    };
    await store.putGroup(group);

    const doc: DocumentRecord = {
      id: "doc-keep",
      folderId: "f-1",
      name: "Safe File",
      fileName: "safe.pdf",
      pageCount: 2,
      chunkCount: 4,
      usedOutline: false,
      createdAt: 100,
      updatedAt: 100,
      groupId: "grp-x",
    };
    await store.putDocument(doc);

    await store.deleteGroup("grp-x");

    const groups = await store.listGroups();
    expect(groups.find((g) => g.id === "grp-x")).toBeUndefined();

    const docs = await store.listDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe("doc-keep");
    expect(docs[0]?.groupId).toBeNull();
  });
});
