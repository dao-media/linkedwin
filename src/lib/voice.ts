/** Composer insert-chip palette. Users override it in Settings → Profile & voice. */
export type VoiceInserts = {
  body: string[];
  structure: string[];
  signOff: string[];
};

export const DEFAULT_VOICE_INSERTS: VoiceInserts = {
  body: ["🤔", "🔥", "👇", "👉", "💬", "✨", "🚀", "💡"],
  structure: ["→", "✓", "•", "—", "…", "1️⃣", "2️⃣", "3️⃣"],
  signOff: ["👋", "♻️", "🔔", "💾", "➕"],
};

export function parseVoiceInserts(raw: string | null | undefined): VoiceInserts {
  if (!raw) return DEFAULT_VOICE_INSERTS;
  try {
    const v = JSON.parse(raw) as Partial<VoiceInserts>;
    const pick = (k: keyof VoiceInserts) =>
      Array.isArray(v[k]) && v[k]!.length ? v[k]!.map(String) : DEFAULT_VOICE_INSERTS[k];
    return { body: pick("body"), structure: pick("structure"), signOff: pick("signOff") };
  } catch {
    return DEFAULT_VOICE_INSERTS;
  }
}

export const DATE_RANGES = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "60d", label: "Last 60 days", days: 60 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "6mo", label: "Last 6 months", days: 183 },
  { id: "1yr", label: "Last 1 year", days: 365 },
  { id: "all", label: "All data collected", days: null },
] as const;

export type DateRangeId = (typeof DATE_RANGES)[number]["id"];
