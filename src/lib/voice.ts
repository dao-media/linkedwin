/** Characters from dane-voice skill for Composer insert bar */
export const VOICE_INSERTS = {
  body: ["🤔", "😏", "😈", "🙃", "🔥", "😱", "👇", "👉", "💬"] as const,
  structure: ["→", "☑", "✓", "🟢", "🟡", "🔴", "⸻", "—", "…"] as const,
  signOff: ["👋🏼", "💾", "❤️", "👍🏼", "➕", "🙃"] as const,
};

export const DATE_RANGES = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "60d", label: "Last 60 days", days: 60 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "6mo", label: "Last 6 months", days: 183 },
  { id: "1yr", label: "Last 1 year", days: 365 },
  { id: "all", label: "All data collected", days: null },
] as const;

export type DateRangeId = (typeof DATE_RANGES)[number]["id"];
