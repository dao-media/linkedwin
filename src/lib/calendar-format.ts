export type CalendarMediaKind =
  | "Image"
  | "Gif"
  | "Video"
  | "Doc"
  | "Link"
  | "None";

export type CalendarStatusLabel = "Scheduled" | "Error" | "Complete";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "June",
  "July",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** e.g. Jul 27, 2026 — May/June/July spelled out; others abbreviated */
export function formatCalendarDate(d: Date): string {
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** e.g. 07/24/2026 */
export function formatLibraryDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatLibraryDateTime(iso: string | null | undefined): {
  date: string;
  time: string;
} | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: formatLibraryDate(d),
    time: formatCalendarTime(d),
  };
}

/** Month bucket key YYYY-MM from preferred post dates. */
export function postMonthKey(p: {
  publishedAt?: string | null;
  scheduledFor?: string | null;
  createdAt?: string | null;
}): string | null {
  const iso = p.publishedAt || p.scheduledFor || p.createdAt;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function formatCompactNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function formatCalendarTime(d: Date): string {
  const hour12 = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const meridiem = d.getHours() >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes} ${meridiem}`;
}

export function truncateCaption(text: string, max = 22): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function mediaLabel(
  mediaType: string | null | undefined,
  mediaUrl?: string | null,
): CalendarMediaKind {
  const t = (mediaType ?? "").toLowerCase();
  if (t === "image" || t === "gif") {
    if (t === "gif" || mediaUrl?.toLowerCase().endsWith(".gif")) return "Gif";
    return "Image";
  }
  if (t === "video") return "Video";
  if (t === "document" || t === "doc" || t === "pdf") return "Doc";
  if (t === "link") return "Link";
  if (mediaUrl) return "Link";
  return "None";
}

export function statusLabel(
  status: string,
): CalendarStatusLabel | string {
  const s = status.toLowerCase();
  if (s === "scheduled") return "Scheduled";
  if (s === "failed" || s === "error") return "Error";
  if (s === "published" || s === "complete") return "Complete";
  return status;
}

/** Complete posts drop off after the local calendar day they were published. */
export function isCompleteStillVisible(
  publishedAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt);
  return (
    published.getFullYear() === now.getFullYear() &&
    published.getMonth() === now.getMonth() &&
    published.getDate() === now.getDate()
  );
}

/** Normalize a hashtag for comparison: strip leading #, collapse spaces, lowercase. */
export function normalizeHashtagKey(tag: string): string {
  return tag.trim().replace(/^#/, "").replace(/\s+/g, "").toLowerCase();
}

/** Always `#lowercase` (spaces collapsed when no leading #). */
export function formatHashtagLabel(tag: string): string {
  const raw = tag.trim();
  if (!raw) return "";
  const body = raw.startsWith("#") ? raw.slice(1) : raw.replace(/\s+/g, "");
  return `#${body.toLowerCase()}`;
}

/** Lowercase every `#Tag` token in caption text (rest of text unchanged). */
export function lowercaseHashtagsInText(text: string): string {
  return text.replace(/#([\w]+)/g, (_, body: string) => `#${body.toLowerCase()}`);
}

export function extractHashtags(
  content: string,
  topicsJson: string,
): string[] {
  const fromContent = [...content.matchAll(/#([\w]+)/g)].map((m) =>
    formatHashtagLabel(m[0]),
  );
  let topics: string[] = [];
  try {
    topics = JSON.parse(topicsJson) as string[];
  } catch {
    topics = [];
  }
  const fromTopics = topics
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => formatHashtagLabel(t));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...fromContent, ...fromTopics]) {
    const key = normalizeHashtagKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(formatHashtagLabel(tag));
  }
  return out;
}

export function postHasHashtag(
  content: string,
  topicsJson: string,
  tag: string,
): boolean {
  const key = normalizeHashtagKey(tag);
  if (!key) return false;
  return extractHashtags(content, topicsJson).some(
    (h) => normalizeHashtagKey(h) === key,
  );
}

export function countFirstComments(
  firstComment?: string | null,
  secondComment?: string | null,
  thirdComment?: string | null,
): number {
  return [firstComment, secondComment, thirdComment].filter((c) =>
    Boolean(c?.trim()),
  ).length;
}

/** Up to 3 non-empty pinned comments, in order. */
export function normalizePinnedComments(
  input?: Array<string | null | undefined> | null,
) {
  const filled = (input ?? [])
    .map((c) => (c ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return {
    firstComment: filled[0],
    secondComment: filled[1],
    thirdComment: filled[2],
  };
}
