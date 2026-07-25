"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { VOICE_INSERTS } from "@/lib/voice";

export function ComposerForm() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [secondComment, setSecondComment] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [topics, setTopics] = useState("AI agents");
  const [repostEnabled, setRepostEnabled] = useState(true);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "document" | "">("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const defaultSchedule = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  function insert(chars: string) {
    setContent((c) => `${c}${chars}`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const when = scheduledFor || defaultSchedule;
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          firstComment: firstComment || undefined,
          secondComment: secondComment || undefined,
          scheduledFor: new Date(when).toISOString(),
          topics: topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          repostEnabled,
          mediaType: mediaType || null,
          mediaUrl: mediaUrl || null,
          mediaTitle: mediaTitle || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to schedule");
      setOk("Scheduled. Redirecting to Calendar…");
      setTimeout(() => router.push("/calendar"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Caption
        </span>
        <textarea
          className="min-h-48 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-sm outline-none focus:border-[var(--accent)]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your LinkedIn post here..."
          required
        />
      </label>

      <div className="rounded-lg bg-[var(--accent-soft)] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
          <Sparkles className="size-3.5" strokeWidth={1.2} aria-hidden />
          Insert from dane-voice
        </div>
        {(
          [
            ["Body", VOICE_INSERTS.body],
            ["Structure", VOICE_INSERTS.structure],
            ["Sign-off", VOICE_INSERTS.signOff],
          ] as const
        ).map(([label, chips]) => (
          <div key={label} className="mb-2 flex flex-wrap items-center gap-2">
            <span className="w-16 text-[11px] font-medium text-[var(--muted)]">
              {label}
            </span>
            {chips.map((ch) => (
              <button
                key={`${label}-${ch}`}
                type="button"
                onClick={() => insert(ch)}
                className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm hover:border-[var(--accent)]"
              >
                {ch}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Media type
          </span>
          <select
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={mediaType}
            onChange={(e) =>
              setMediaType(e.target.value as "image" | "document" | "")
            }
          >
            <option value="">None</option>
            <option value="image">Image</option>
            <option value="document">Document (PDF)</option>
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Media URL
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>

      {mediaType === "document" && (
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Document title
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={mediaTitle}
            onChange={(e) => setMediaTitle(e.target.value)}
          />
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          First comment (auto after publish)
        </span>
        <textarea
          className="min-h-20 w-full rounded-lg border border-[var(--line)] bg-white p-3"
          value={firstComment}
          onChange={(e) => setFirstComment(e.target.value)}
          placeholder="Put links here to protect reach"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Second comment (queued for worker)
        </span>
        <textarea
          className="min-h-16 w-full rounded-lg border border-[var(--line)] bg-white p-3"
          value={secondComment}
          onChange={(e) => setSecondComment(e.target.value)}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Publish at
          </span>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={scheduledFor || defaultSchedule}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </label>
        <label className="block text-sm md:col-span-1">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            Topics (comma-separated)
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={repostEnabled}
            onChange={(e) => setRepostEnabled(e.target.checked)}
          />
          Repost after 12 hours
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-[var(--success)]">{ok}</p>}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        <CalendarClock className="size-4" strokeWidth={1.2} aria-hidden />
        {saving ? "Scheduling…" : "Schedule post"}
      </button>
    </form>
  );
}
