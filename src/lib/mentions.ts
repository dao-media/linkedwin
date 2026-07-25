import { getSetting, setSetting } from "@/lib/settings";

export type SavedMention = {
  id: string;
  /** Short label in the picker (usually LinkedIn display name). */
  label: string;
  url: string;
  displayName?: string;
  mentionFormat: string;
  urn?: string;
  type?: string;
};

const SETTINGS_KEY = "saved_mentions";

function parseMentions(raw: string | null): SavedMention[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (item): item is SavedMention =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as SavedMention).id === "string" &&
          typeof (item as SavedMention).label === "string" &&
          typeof (item as SavedMention).url === "string" &&
          typeof (item as SavedMention).mentionFormat === "string",
      )
      .map((item) => ({
        id: item.id,
        label: item.label.trim() || "Untitled",
        url: item.url.trim(),
        displayName: item.displayName?.trim() || undefined,
        mentionFormat: item.mentionFormat,
        urn: item.urn?.trim() || undefined,
        type: item.type?.trim() || undefined,
      }));
  } catch {
    return null;
  }
}

export async function listSavedMentions(): Promise<SavedMention[]> {
  return parseMentions(await getSetting(SETTINGS_KEY)) ?? [];
}

export async function saveSavedMentions(mentions: SavedMention[]) {
  await setSetting(SETTINGS_KEY, JSON.stringify(mentions));
}

export function newMentionId() {
  return `mention-${crypto.randomUUID()}`;
}

/** Upsert by URN or mentionFormat; moves match to front. */
export function upsertSavedMention(
  list: SavedMention[],
  next: Omit<SavedMention, "id"> & { id?: string },
): SavedMention[] {
  const matchIndex = list.findIndex(
    (m) =>
      (next.urn && m.urn && m.urn === next.urn) ||
      m.mentionFormat === next.mentionFormat,
  );
  const id =
    matchIndex >= 0 ? list[matchIndex]!.id : (next.id ?? newMentionId());
  const entry: SavedMention = {
    id,
    label: next.label.trim() || "Untitled",
    url: next.url.trim(),
    displayName: next.displayName?.trim() || undefined,
    mentionFormat: next.mentionFormat,
    urn: next.urn?.trim() || undefined,
    type: next.type?.trim() || undefined,
  };
  if (matchIndex >= 0) {
    const rest = list.filter((_, i) => i !== matchIndex);
    return [entry, ...rest];
  }
  return [entry, ...list];
}
