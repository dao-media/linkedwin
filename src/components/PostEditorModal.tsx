"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { FooterDeleteModal } from "@/components/FooterDeleteModal";
import { FooterEditModal } from "@/components/FooterEditModal";
import { MediaField } from "@/components/MediaField";
import { MentionInsert } from "@/components/MentionInsert";
import {
  commentsFromPost,
  nextPinnedComments,
  PinnedCommentsFields,
} from "@/components/PinnedCommentsFields";
import { VoiceInsertBar } from "@/components/VoiceInsertBar";
import { lowercaseHashtagsInText } from "@/lib/calendar-format";
import type { SavedFooter } from "@/lib/footers";
import type { ComposerMediaType } from "@/lib/media-shared";

export type PostEditorData = {
  id: string;
  title: string | null;
  content: string;
  status?: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  firstComment?: string | null;
  secondComment?: string | null;
  thirdComment?: string | null;
  topics?: string;
};

type FooterModal =
  | { type: "create"; seedBody: string }
  | { type: "edit"; footer: SavedFooter }
  | { type: "delete"; footer: SavedFooter }
  | null;

type PostEditorModalProps = {
  post: PostEditorData;
  onClose: () => void;
  onSaved: () => void;
};

function parseTopics(topicsJson?: string) {
  try {
    const arr = JSON.parse(topicsJson || "[]") as string[];
    return Array.isArray(arr) ? arr.join(", ") : "";
  } catch {
    return "";
  }
}

export function PostEditorModal({ post, onClose, onSaved }: PostEditorModalProps) {
  const [content, setContent] = useState(post.content);
  const [comments, setComments] = useState(() => commentsFromPost(post));
  const [topics, setTopics] = useState(() => parseTopics(post.topics));
  const [mediaUrl, setMediaUrl] = useState(post.mediaUrl ?? "");
  const [mediaType, setMediaType] = useState<ComposerMediaType | "">(
    (post.mediaType as ComposerMediaType) || "",
  );
  const [mediaTitle, setMediaTitle] = useState(post.mediaTitle ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [footers, setFooters] = useState<SavedFooter[]>([]);
  const [footersLoaded, setFootersLoaded] = useState(false);
  const [footerModal, setFooterModal] = useState<FooterModal>(null);
  const [footerSaving, setFooterSaving] = useState(false);
  const [footerError, setFooterError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          isEdit ? { id: footerModal.footer.id, ...payload } : payload,
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

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: lowercaseHashtagsInText(content),
          comments: comments.map((c) => c.trim()).filter(Boolean),
          topics: topics
            .split(",")
            .map((t) => t.replace(/^#/, "").trim().toLowerCase())
            .filter(Boolean),
          mediaType: mediaType || null,
          mediaUrl: mediaUrl || null,
          mediaTitle: mediaTitle || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        data-calendar-interactive
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-editor-title"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(42rem,94vh)] w-full max-w-[34.5rem] flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2
                id="post-editor-title"
                className="type-h4 truncate text-[var(--ink)]"
              >
                Edit post
              </h2>
              <p className="type-p-s truncate text-[var(--muted)]">
                Caption, mentions, footers, pinned comments
              </p>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
              onClick={onClose}
              aria-label="Close editor"
            >
              <X className="size-4" strokeWidth={1.2} aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            <label className="block">
              <span className="type-label-m mb-1 block text-[var(--muted)]">
                Caption
              </span>
              <textarea
                className="type-p-m min-h-40 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 outline-none focus:border-[var(--accent)]"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => setContent((c) => lowercaseHashtagsInText(c))}
              />
            </label>

            <VoiceInsertBar onInsert={insert} />
            <MentionInsert onInsert={insert} />

            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <h3 className="type-label-m shrink-0 text-[var(--muted)]">
                  Saved footers
                </h3>
                <div className="h-px min-w-0 flex-1 bg-[var(--line)]" />
                <button
                  type="button"
                  onClick={() => {
                    setFooterError(null);
                    setFooterModal({ type: "create", seedBody: content.trim() });
                  }}
                  className="type-btn-s shrink-0 rounded-md bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent)]"
                >
                  + Save current
                </button>
              </div>
              {!footersLoaded ? (
                <p className="type-p-m text-[var(--muted)]">Loading…</p>
              ) : footers.length === 0 ? (
                <p className="type-p-m text-[var(--muted)]">No saved footers yet.</p>
              ) : (
                <ul className="space-y-2">
                  {footers.map((footer) => (
                    <li
                      key={footer.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="type-label-l truncate">{footer.name}</p>
                        <p className="type-p-s truncate text-[var(--muted)]">
                          {footer.body}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Edit ${footer.name}`}
                        onClick={() => setFooterModal({ type: "edit", footer })}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)]"
                      >
                        <Pencil className="size-3.5" strokeWidth={1.2} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${footer.name}`}
                        onClick={() => setFooterModal({ type: "delete", footer })}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] text-[var(--muted)]"
                      >
                        <Trash2 className="size-3.5" strokeWidth={1.2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertFooter(footer.body)}
                        className="type-btn-s rounded-md bg-[var(--accent)] px-2.5 py-1 text-white"
                      >
                        Insert
                      </button>
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

            <PinnedCommentsFields
              comments={comments}
              onChange={(index, value) =>
                setComments((prev) => nextPinnedComments(prev, index, value))
              }
            />

            <label className="type-p-m block">
              <span className="type-label-m mb-1 block text-[var(--muted)]">
                Topics (comma-separated)
              </span>
              <input
                className="type-p-m w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
              />
            </label>

            {error ? (
              <p className="type-p-m text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line)] px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="type-label-l rounded-lg border border-[var(--line)] px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !content.trim()}
              onClick={() => void onSave()}
              className="type-btn-m rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </footer>
        </div>
      </div>

      {footerModal?.type === "create" || footerModal?.type === "edit" ? (
        <FooterEditModal
          mode={footerModal.type}
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
          onClose={() => setFooterModal(null)}
          onSave={saveFooter}
        />
      ) : null}
      {footerModal?.type === "delete" ? (
        <FooterDeleteModal
          footerName={footerModal.footer.name}
          saving={footerSaving}
          error={footerError}
          onClose={() => setFooterModal(null)}
          onConfirm={() => void deleteFooter()}
        />
      ) : null}
    </>
  );
}
