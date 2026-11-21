"use client";

import { useEffect, useState } from "react";
import { AtSign, Loader2, Trash2 } from "lucide-react";
import type { SavedMention } from "@/lib/mentions";

type MentionInsertProps = {
  onInsert: (mentionFormat: string) => void;
};

function labelFromFormat(format: string, fallback?: string) {
  const m = format.match(/^@\[([^\]]+)\]/);
  return m?.[1]?.trim() || fallback?.trim() || format;
}

export function MentionInsert({ onInsert }: MentionInsertProps) {
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedMention[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/mentions")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSaved(Array.isArray(data.mentions) ? data.mentions : []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(mention: {
    url: string;
    displayName?: string;
    mentionFormat: string;
    urn?: string;
    type?: string;
  }) {
    const res = await fetch("/api/mentions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: mention.url,
        displayName: mention.displayName,
        label: labelFromFormat(mention.mentionFormat, mention.displayName),
        mentionFormat: mention.mentionFormat,
        urn: mention.urn,
        type: mention.type,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.mentions)) {
      setSaved(data.mentions);
    }
  }

  async function resolve() {
    setBusy(true);
    setError(null);
    setLast(null);
    try {
      const trimmedUrl = url.trim();
      const trimmedName = displayName.trim();
      const params = new URLSearchParams({ url: trimmedUrl });
      if (trimmedName) params.set("displayName", trimmedName);
      const res = await fetch(`/api/linkedin-mentions?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not resolve mention");
      const mention = data.mention as
        | {
            mentionFormat?: string;
            urn?: string;
            type?: string;
            displayName?: string;
          }
        | undefined;
      const format = mention?.mentionFormat;
      if (!format) throw new Error("No mention format returned");
      onInsert(format);
      setLast(format);
      await persist({
        url: trimmedUrl,
        displayName: trimmedName || mention?.displayName,
        mentionFormat: format,
        urn: mention?.urn,
        type: mention?.type,
      });
      setUrl("");
      setDisplayName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch("/api/mentions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to remove");
      return;
    }
    setSaved(Array.isArray(data.mentions) ? data.mentions : []);
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-3">
      <div className="type-label-m mb-2 flex items-center gap-1.5 text-[var(--accent)]">
        <AtSign className="size-3.5" strokeWidth={1.2} aria-hidden />
        Tag LinkedIn account
      </div>
      <p className="type-label-s mb-2 text-[var(--muted)]">
        Paste a profile or company URL. Display name must match LinkedIn exactly
        for person tags to be clickable. New tags are saved for reuse.
      </p>

      {loaded && saved.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {saved.map((m) => (
            <li
              key={m.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--bg)] pl-2"
            >
              <button
                type="button"
                onClick={() => {
                  onInsert(m.mentionFormat);
                  setLast(m.mentionFormat);
                  setError(null);
                }}
                className="type-btn-s max-w-[12rem] truncate py-1 text-left text-[var(--accent)] hover:underline"
                title={m.mentionFormat}
              >
                @{m.label}
              </button>
              <button
                type="button"
                aria-label={`Remove saved tag ${m.label}`}
                onClick={() => void remove(m.id)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-white hover:text-[#c0392b]"
              >
                <Trash2 className="size-3.5" strokeWidth={1.2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="url"
          className="type-p-m w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5"
          placeholder="linkedin.com/in/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          type="text"
          className="type-p-m w-full rounded-md border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5"
          placeholder="Display name (people)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !url.trim()}
          onClick={() => void resolve()}
          className="type-btn-s inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 py-1.5 text-white disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.2} />
          ) : null}
          Insert @
        </button>
      </div>
      {error ? (
        <p className="type-p-s mt-2 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {last ? (
        <p className="type-label-s mt-2 truncate text-[var(--muted)]">
          Inserted {last}
        </p>
      ) : null}
    </div>
  );
}
