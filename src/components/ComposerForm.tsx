"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, FileText, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FooterDeleteModal } from "@/components/FooterDeleteModal";
import { FooterEditModal } from "@/components/FooterEditModal";
import { MediaField } from "@/components/MediaField";
import { MentionInsert } from "@/components/MentionInsert";
import {
  nextPinnedComments,
  PinnedCommentsFields,
} from "@/components/PinnedCommentsFields";
import { VoiceInsertBar } from "@/components/VoiceInsertBar";
import type { SavedFooter } from "@/lib/footers";
import { lowercaseHashtagsInText } from "@/lib/calendar-format";
import type { ComposerMediaType } from "@/lib/media-shared";

type FooterModal =
  | { type: "create"; seedBody: string }
  | { type: "edit"; footer: SavedFooter }
  | { type: "delete"; footer: SavedFooter }
  | null;

export function ComposerForm() {
  const router = useRouter();
  const [content, setContent] = useState("");
  /** Progressive fields: always one blank trail until 3 total. */
  const [comments, setComments] = useState<string[]>([""]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [topics, setTopics] = useState("AI agents");
  const [repostEnabled, setRepostEnabled] = useState(true);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<ComposerMediaType | "">("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [saving, setSaving] = useState<"draft" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [footers, setFooters] = useState<SavedFooter[]>([]);
  const [footersLoaded, setFootersLoaded] = useState(false);
  const [footerModal, setFooterModal] = useState<FooterModal>(null);
  const [footerSaving, setFooterSaving] = useState(false);
  const [footerError, setFooterError] = useState<string | null>(null);

  const defaultSchedule = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/footers")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setFooters(Array.isArray(data.footers) ? data.footers : []);
        setFootersLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setFootersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function insert(chars: string) {
    setContent((c) => lowercaseHashtagsInText(`${c}${chars}`));
  }

  function insertFooter(body: string) {
    setContent((c) => {
      let next: string;
      if (!c) next = body;
      else if (c.endsWith("\n\n")) next = `${c}${body}`;
      else if (c.endsWith("\n")) next = `${c}\n${body}`;
      else next = `${c}\n\n${body}`;
      return lowercaseHashtagsInText(next);
    });
  }

  function updateComment(index: number, value: string) {
    setComments((prev) => nextPinnedComments(prev, index, value));
  }

  async function saveFooter(payload: { name: string; body: string }) {
    if (!footerModal || footerModal.type === "delete") return;
    setFooterSaving(true);
    setFooterError(null);
    try {
      const isEdit = footerModal.type === "edit";
      const res = await fetch("/api/footers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { id: footerModal.footer.id, ...payload }
            : payload,
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save footer");
      setFooters(Array.isArray(data.footers) ? data.footers : []);
      setFooterModal(null);
    } catch (err) {
      setFooterError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setFooterSaving(false);
    }
  }

  async function deleteFooter() {
    if (!footerModal || footerModal.type !== "delete") return;
    setFooterSaving(true);
    setFooterError(null);
    try {
      const res = await fetch("/api/footers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: footerModal.footer.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete footer");
      setFooters(Array.isArray(data.footers) ? data.footers : []);
      setFooterModal(null);
    } catch (err) {
      setFooterError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setFooterSaving(false);
    }
  }

  async function save(mode: "draft" | "schedule") {
    setSaving(mode);
    setError(null);
    setOk(null);
    try {
      const when = scheduledFor || defaultSchedule;
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          comments: comments.map((c) => c.trim()).filter(Boolean),
          scheduledFor:
            mode === "schedule"
              ? new Date(when).toISOString()
              : scheduledFor
                ? new Date(scheduledFor).toISOString()
                : undefined,
          topics: topics
            .split(",")
            .map((t) => t.replace(/^#/, "").trim().toLowerCase())
            .filter(Boolean),
          repostEnabled,
          mediaType: mediaType || null,
          mediaUrl: mediaUrl || null,
          mediaTitle: mediaTitle || null,
          asDraft: mode === "draft",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body.error ??
            (mode === "draft" ? "Failed to save draft" : "Failed to schedule"),
        );
      }
      if (mode === "draft") {
        setOk("Draft saved. Redirecting to Calendar…");
      } else {
        const armed = Boolean(body.post?.zernioPostId);
        const n = comments.map((c) => c.trim()).filter(Boolean).length;
        setOk(
          armed
            ? `Scheduled with Zernio. ${n ? `${n} pinned comment${n === 1 ? "" : "s"} + ` : ""}12h repost armed. Redirecting…`
            : "Saved locally, but Zernio did not accept the schedule — check Settings. Redirecting…",
        );
      }
      setTimeout(() => router.push("/calendar"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save("schedule");
  }

  return (
    <>
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
            onBlur={() => setContent((c) => lowercaseHashtagsInText(c))}
            placeholder="Write your LinkedIn post here..."
            required
          />
        </label>

        <VoiceInsertBar onInsert={insert} />
        <MentionInsert onInsert={insert} />

        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h3 className="shrink-0 text-xs font-semibold text-[var(--muted)]">
              Saved footers
            </h3>
            <div className="h-px min-w-0 flex-1 bg-[var(--line)]" />
            <button
              type="button"
              onClick={() => {
                setFooterError(null);
                setFooterModal({ type: "create", seedBody: content.trim() });
              }}
              className="shrink-0 rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--selected)]"
            >
              + Save current as footer
            </button>
          </div>

          {!footersLoaded ? (
            <p className="text-sm text-[var(--muted)]">Loading footers…</p>
          ) : footers.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No saved footers yet. Save a sign-off to reuse it.
            </p>
          ) : (
            <ul className="space-y-2">
              {footers.map((footer) => (
                <li
                  key={footer.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ink)]">
                      {footer.name}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {footer.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Edit ${footer.name}`}
                      onClick={() => {
                        setFooterError(null);
                        setFooterModal({ type: "edit", footer });
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Pencil className="size-3.5" strokeWidth={1.2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${footer.name}`}
                      onClick={() => {
                        setFooterError(null);
                        setFooterModal({ type: "delete", footer });
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)] hover:border-[#c0392b] hover:text-[#c0392b]"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertFooter(footer.body)}
                      className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Insert
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <MediaField
          mediaType={mediaType}
          mediaUrl={mediaUrl}
          mediaTitle={mediaTitle}
          onChange={({ mediaType: t, mediaUrl: u, mediaTitle: title }) => {
            setMediaType(t);
            setMediaUrl(u);
            setMediaTitle(title);
          }}
        />

        <PinnedCommentsFields comments={comments} onChange={updateComment} />

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={Boolean(saving) || !content.trim()}
            onClick={() => void save("draft")}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--bg)] disabled:opacity-50"
          >
            <FileText className="size-4" strokeWidth={1.2} aria-hidden />
            {saving === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            disabled={Boolean(saving) || !content.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <CalendarClock className="size-4" strokeWidth={1.2} aria-hidden />
            {saving === "schedule" ? "Scheduling…" : "Schedule post"}
          </button>
        </div>
      </form>

      {(footerModal?.type === "create" || footerModal?.type === "edit") && (
        <FooterEditModal
          key={
            footerModal.type === "edit"
              ? `edit-${footerModal.footer.id}`
              : "create"
          }
          mode={footerModal.type === "create" ? "create" : "edit"}
          initialName={
            footerModal.type === "edit" ? footerModal.footer.name : ""
          }
          initialBody={
            footerModal.type === "edit"
              ? footerModal.footer.body
              : footerModal.seedBody
          }
          saving={footerSaving}
          error={footerError}
          onClose={() => {
            if (!footerSaving) setFooterModal(null);
          }}
          onSave={saveFooter}
        />
      )}

      {footerModal?.type === "delete" && (
        <FooterDeleteModal
          footerName={footerModal.footer.name}
          saving={footerSaving}
          error={footerError}
          onClose={() => {
            if (!footerSaving) setFooterModal(null);
          }}
          onConfirm={deleteFooter}
        />
      )}
    </>
  );
}
