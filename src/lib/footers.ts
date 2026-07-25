import { getSetting, setSetting } from "@/lib/settings";

export type SavedFooter = {
  id: string;
  name: string;
  body: string;
};

const SETTINGS_KEY = "saved_footers";

const DEFAULT_FOOTERS: SavedFooter[] = [
  {
    id: "default-newsletter",
    name: "Newsletter CTA",
    body: "Want the playbook? Link in first comment.",
  },
  {
    id: "default-follow-save",
    name: "Follow + save",
    body: "Follow for more. Save this for later.",
  },
];

function parseFooters(raw: string | null): SavedFooter[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(
        (item): item is SavedFooter =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as SavedFooter).id === "string" &&
          typeof (item as SavedFooter).name === "string" &&
          typeof (item as SavedFooter).body === "string",
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim() || "Untitled footer",
        body: item.body,
      }));
  } catch {
    return null;
  }
}

export async function listSavedFooters(): Promise<SavedFooter[]> {
  const existing = parseFooters(await getSetting(SETTINGS_KEY));
  if (existing) return existing;
  await setSetting(SETTINGS_KEY, JSON.stringify(DEFAULT_FOOTERS));
  return DEFAULT_FOOTERS;
}

export async function saveSavedFooters(footers: SavedFooter[]) {
  await setSetting(SETTINGS_KEY, JSON.stringify(footers));
}

export function newFooterId() {
  return `footer-${crypto.randomUUID()}`;
}
