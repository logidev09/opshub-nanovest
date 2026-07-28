export interface JournalRevisionItem {
  revisionNumber: number;
  editedAt: string;
  editedBy: string;
  oldDescription: string;
  newDescription: string;
  oldDate?: string;
  newDate?: string;
}

export function parseJournalRevisions(fullDesc: string): {
  cleanDescription: string;
  revisions: JournalRevisionItem[];
} {
  if (!fullDesc) return { cleanDescription: "", revisions: [] };
  const marker = "---REVISIONS_START---";
  if (!fullDesc.includes(marker)) {
    return { cleanDescription: fullDesc, revisions: [] };
  }
  const parts = fullDesc.split(marker);
  const cleanDescription = parts[0].trim();
  const rest = parts[1] || "";
  const jsonStr = rest.split("---REVISIONS_END---")[0]?.trim() || "";
  try {
    const revs = JSON.parse(jsonStr);
    if (Array.isArray(revs)) {
      return { cleanDescription, revisions: revs };
    }
  } catch (e) {
    console.error("Error parsing journal revisions:", e);
  }
  return { cleanDescription, revisions: [] };
}

export function formatDescriptionWithRevisions(
  desc: string,
  revisions: JournalRevisionItem[]
): string {
  const clean = desc.split("---REVISIONS_START---")[0].trim();
  if (!revisions || revisions.length === 0) return clean;
  // Keep max 10 latest revisions
  const cappedRevisions = revisions.slice(-10);
  return `${clean}\n\n---REVISIONS_START---\n${JSON.stringify(cappedRevisions)}\n---REVISIONS_END---`;
}
