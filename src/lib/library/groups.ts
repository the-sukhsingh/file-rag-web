import type { DocumentRecord, FileGroup } from "./types";

/**
 * Returns documents that belong to a specific group, or ungrouped documents when groupId is null.
 */
export function getDocumentsInGroup(
  documents: DocumentRecord[],
  groups: FileGroup[],
  groupId: string | null
): DocumentRecord[] {
  if (groupId === null) {
    const validGroupIds = new Set(groups.map((g) => g.id));
    return documents.filter((doc) => !doc.groupId || !validGroupIds.has(doc.groupId));
  }
  return documents.filter((doc) => doc.groupId === groupId);
}

/**
 * Computes the new excludedIds set when toggling selection for an entire group.
 * If all documents in the group are currently selected, it deselects them.
 * Otherwise, it selects all documents in the group.
 */
export function toggleGroupSelection(options: {
  documents: DocumentRecord[];
  groups: FileGroup[];
  excludedIds: Set<string>;
  targetGroupId: string | null;
}): Set<string> {
  const { documents, groups, excludedIds, targetGroupId } = options;
  const groupDocs = getDocumentsInGroup(documents, groups, targetGroupId);
  if (!groupDocs.length) return new Set(excludedIds);

  const allSelected = groupDocs.every((doc) => !excludedIds.has(doc.id));
  const next = new Set(excludedIds);

  if (allSelected) {
    for (const doc of groupDocs) {
      next.add(doc.id);
    }
  } else {
    for (const doc of groupDocs) {
      next.delete(doc.id);
    }
  }

  return next;
}

/**
 * Computes the new excludedIds set to select ONLY the specified group for conversation,
 * deselecting all other files in the library.
 */
export function selectOnlyGroup(options: {
  documents: DocumentRecord[];
  groups: FileGroup[];
  targetGroupId: string | null;
}): Set<string> {
  const { documents, groups, targetGroupId } = options;
  const targetGroupDocs = getDocumentsInGroup(documents, groups, targetGroupId);
  const targetIds = new Set(targetGroupDocs.map((doc) => doc.id));

  // Exclude all documents NOT in target group
  return new Set(
    documents.filter((doc) => !targetIds.has(doc.id)).map((doc) => doc.id)
  );
}

/**
 * Checks if all currently selected documents belong to exactly one user group.
 * If so, returns that group for display in the composer / header.
 */
export function getSingleGroupContext(
  selectedDocuments: DocumentRecord[],
  groups: FileGroup[]
): FileGroup | null {
  if (!selectedDocuments.length || !groups.length) return null;
  const firstGroupId = selectedDocuments[0].groupId;
  if (!firstGroupId) return null;

  const group = groups.find((g) => g.id === firstGroupId);
  if (!group) return null;

  const allMatch = selectedDocuments.every((doc) => doc.groupId === firstGroupId);
  return allMatch ? group : null;
}
