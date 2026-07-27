"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileEdit, Pencil, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  countFirstComments,
  extractHashtags,
  formatCalendarDate,
  formatCalendarTime,
  formatHashtagLabel,
  mediaLabel,
  postHasHashtag,
  statusLabel,
  truncateCaption,
  type CalendarMediaKind,
} from "@/lib/calendar-format";
import { patchPostSchedule } from "@/lib/schedule-client";
import {
  HashtagPostsModal,
  type HashtagPostSummary,
} from "@/components/HashtagPostsModal";
import { HashtagTag } from "@/components/HashtagTag";
import {
  PostEditorModal,
  type PostEditorData,
} from "@/components/PostEditorModal";
import {
  captureFlipState,
  playFlip,
  useGSAP,
  Flip,
} from "@/lib/gsap-client";

export type CalendarRow = {
  id: string;
  scheduledFor: string | null;
  publishedAt?: string | null;
  title: string | null;
  content: string;
  footer?: string | null;
  status: string;
  topics: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  mediaTitle?: string | null;
  firstComment?: string | null;
  secondComment?: string | null;
  thirdComment?: string | null;
};

function splitDateTime(iso: string | null) {
  if (!iso) return { date: "", time: "", displayDate: "", displayTime: "" };
  const d = new Date(iso);
  const date = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  const time = [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join(":");
  return {
    date,
    time,
    displayDate: formatCalendarDate(d),
    displayTime: formatCalendarTime(d),
  };
}

function displayStatus(row: CalendarRow, editing: boolean, saving: boolean) {
  if (editing) return saving ? "syncing…" : "editing";
  if (row.status.toLowerCase() === "draft") return "Draft";
  return statusLabel(row.status);
}

type EditController = {
  selectedId: string | null;
  editingId: string | null;
  draftDate: string;
  draftTime: string;
  saving: boolean;
  setDraftDate: (v: string) => void;
  setDraftTime: (v: string) => void;
  beginEdit: (rowId: string, date: string, time: string) => Promise<void>;
  selectRow: (rowId: string) => Promise<void>;
  cancelEdit: () => void;
  saveCurrent: () => Promise<void>;
  openHashtag: (tag: string) => void;
  openEditor: (row: CalendarRow) => void;
  moveToDraft: (row: CalendarRow) => Promise<void>;
  deleteRow: (row: CalendarRow) => Promise<void>;
};

function PostTable({
  rows,
  emptyLabel,
  showScheduleAction,
  edit,
}: {
  rows: CalendarRow[];
  emptyLabel: string;
  showScheduleAction?: boolean;
  edit: EditController;
}) {
  const colCount = showScheduleAction ? 10 : 9;
  const {
    selectedId,
    editingId,
    draftDate,
    draftTime,
    saving,
    setDraftDate,
    setDraftTime,
    beginEdit,
    selectRow,
    cancelEdit,
    saveCurrent,
    openHashtag,
    openEditor,
    moveToDraft,
    deleteRow,
  } = edit;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <table className="type-p-m w-full table-fixed text-left">
        <colgroup>
          <col className="w-[10.5rem]" />
          <col className="w-[7.5rem]" />
          <col className="w-[14rem]" />
          <col className="w-[5.5rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[30rem]" />
          <col className="w-[4.5rem]" />
          <col />
          {showScheduleAction ? <col className="w-[6.5rem]" /> : null}
          <col className="w-[14.5rem]" />
        </colgroup>
        <thead className="bg-[var(--bg)] text-[var(--muted)]">
          <tr>
            <th className="type-h5 px-4 py-3 text-left">Date</th>
            <th className="type-h5 px-4 py-3 text-left">Time</th>
            <th className="type-h5 px-4 py-3 text-left">Post caption</th>
            <th className="type-h5 px-4 py-3 text-left">Media</th>
            <th className="type-h5 px-4 py-3 text-left">Status</th>
            <th className="type-h5 px-4 py-3 text-left">Hashtags</th>
            <th className="type-h5 px-4 py-3 text-left">Pinned</th>
            <th aria-hidden className="p-0" />
            {showScheduleAction && (
              <th className="type-h5 px-4 py-3 text-left" />
            )}
            <th className="type-h5 px-3 py-3 text-left">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { date, time, displayDate, displayTime } = splitDateTime(
              row.scheduledFor,
            );
            const selected = selectedId === row.id;
            const editing = editingId === row.id;
            const media: CalendarMediaKind = mediaLabel(
              row.mediaType,
              row.mediaUrl,
            );
            const hashtags = extractHashtags(row.content, row.topics);
            const commentCount = countFirstComments(
              row.firstComment,
              row.secondComment,
              row.thirdComment,
            );
            const caption = truncateCaption(row.title || row.content);

            return (
              <tr
                key={row.id}
                data-calendar-interactive
                data-flip
                className={`group/row border-t border-[var(--line)] ${
                  selected || editing ? "bg-[var(--accent-soft)]" : ""
                }`}
                onClick={() => {
                  if (editing || saving) return;
                  void selectRow(row.id);
                }}
              >
                <td className="relative whitespace-nowrap px-4 py-3 pr-9 text-left">
                  {editing ? (
                    <input
                      type="date"
                      className="box-border w-full min-w-0 rounded-md border border-[var(--accent)] bg-white px-2 py-1 text-left"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className="text-left">
                        {displayDate || "—"}
                      </span>
                      <button
                        type="button"
                        aria-label={`Edit schedule for ${caption || "post"}`}
                        className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md border border-[var(--line)] bg-white text-[var(--muted)] opacity-0 shadow-sm transition group-hover/row:opacity-100 hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          void beginEdit(row.id, date, time);
                        }}
                      >
                        <Pencil
                          className="size-3.5"
                          strokeWidth={1.2}
                          aria-hidden
                        />
                      </button>
                    </>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-left">
                  {editing ? (
                    <input
                      type="time"
                      className="box-border w-full min-w-0 rounded-md border border-[var(--accent)] bg-white px-2 py-1 text-left"
                      value={draftTime}
                      onChange={(e) => setDraftTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-left">
                      {displayTime || "—"}
                    </span>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-left"
                  title={row.title || row.content}
                >
                  <span className="block truncate">{caption || "—"}</span>
                </td>
                <td className="px-4 py-3 text-left text-[var(--muted)]">
                  {media}
                </td>
                <td className="px-4 py-3 text-left text-[var(--muted)]">
                  {displayStatus(row, editing, saving)}
                </td>
                <td className="px-4 py-3 text-left">
                  {hashtags.length === 0 ? (
                    <span className="text-[var(--muted)]">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags.map((tag) => (
                        <HashtagTag
                          key={tag.toLowerCase()}
                          tag={tag}
                          emphasized={selected || editing}
                          onClick={openHashtag}
                        />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-left text-[var(--muted)]">
                  {commentCount}
                </td>
                <td aria-hidden className="p-0" />
                {showScheduleAction && (
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      disabled={saving}
                      className="type-btn-s rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-left text-[var(--accent)] disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        void beginEdit(row.id, date, time);
                      }}
                    >
                      Schedule
                    </button>
                  </td>
                )}
                <td className="px-3 py-3 text-right">
                  {!editing && (
                    <div className="inline-flex items-center justify-end gap-2">
                      {row.status.toLowerCase() !== "draft" &&
                        row.status.toLowerCase() !== "published" && (
                          <button
                            type="button"
                            className="type-btn-s rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                            disabled={saving}
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveToDraft(row);
                            }}
                          >
                            Draft
                          </button>
                        )}
                      <button
                        type="button"
                        className="type-btn-s inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                        disabled={saving}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(row);
                        }}
                      >
                        <FileEdit
                          className="size-3.5 shrink-0"
                          strokeWidth={1.2}
                          aria-hidden
                        />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="type-btn-s inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-red-700 hover:border-red-400 hover:bg-red-50 disabled:opacity-50"
                        disabled={saving}
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteRow(row);
                        }}
                      >
                        <Trash2
                          className="size-3.5 shrink-0"
                          strokeWidth={1.2}
                          aria-hidden
                        />
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="type-p-m px-4 py-10 text-center text-[var(--muted)]"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editingId && rows.some((r) => r.id === editingId) && (
        <div
          data-calendar-interactive
          className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3"
        >
          <p className="type-p-s text-[var(--muted)]">
            Only one row edits at a time — switching rows saves the current
            edit.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="type-btn-m inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[var(--muted)]"
              onClick={cancelEdit}
              disabled={saving}
            >
              <X className="size-3.5" strokeWidth={1.2} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="type-btn-m inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white disabled:opacity-50"
              onClick={() => void saveCurrent()}
            >
              <Save className="size-3.5" strokeWidth={1.2} aria-hidden />
              Save schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CalendarTable({
  scheduled,
  drafts,
  libraryPosts,
}: {
  scheduled: CalendarRow[];
  drafts: CalendarRow[];
  libraryPosts: HashtagPostSummary[];
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [editorPost, setEditorPost] = useState<PostEditorData | null>(null);

  const draftDateRef = useRef(draftDate);
  const draftTimeRef = useRef(draftTime);
  const editingIdRef = useRef(editingId);
  const baselineDateRef = useRef("");
  const baselineTimeRef = useRef("");

  const captureFlip = useCallback(() => {
    flipStateRef.current = captureFlipState(rootRef.current);
  }, []);

  useEffect(() => {
    draftDateRef.current = draftDate;
    draftTimeRef.current = draftTime;
    editingIdRef.current = editingId;
  }, [draftDate, draftTime, editingId]);

  useGSAP(
    () => {
      if (!flipStateRef.current) return;
      playFlip(flipStateRef.current);
      flipStateRef.current = null;
    },
    { dependencies: [selectedId, editingId], scope: rootRef },
  );

  const matchingPosts = useMemo(() => {
    if (!activeHashtag) return [];
    return libraryPosts.filter((p) =>
      postHasHashtag(p.content, p.topics, activeHashtag),
    );
  }, [activeHashtag, libraryPosts]);

  const savePost = useCallback(
    async (postId: string, date: string, time: string) => {
      setSaving(true);
      setError(null);
      const result = await patchPostSchedule(postId, date, time);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      return true;
    },
    [],
  );

  const commitCurrentEdit = useCallback(async () => {
    const id = editingIdRef.current;
    if (!id) return true;
    const ok = await savePost(id, draftDateRef.current, draftTimeRef.current);
    if (!ok) return false;
    baselineDateRef.current = draftDateRef.current;
    baselineTimeRef.current = draftTimeRef.current;
    captureFlip();
    setEditingId(null);
    editingIdRef.current = null;
    router.refresh();
    return true;
  }, [captureFlip, router, savePost]);

  useEffect(() => {
    if (!selectedId && !editingId) return;

    const onPointerDown = (event: PointerEvent) => {
      if (saving) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-calendar-interactive]")) return;

      void (async () => {
        if (editingIdRef.current) {
          const dirty =
            draftDateRef.current !== baselineDateRef.current ||
            draftTimeRef.current !== baselineTimeRef.current;
          if (dirty) {
            const ok = await commitCurrentEdit();
            if (!ok) return;
          } else {
            captureFlip();
            setEditingId(null);
            editingIdRef.current = null;
            setError(null);
          }
        }
        captureFlip();
        setSelectedId(null);
      })();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [captureFlip, commitCurrentEdit, editingId, saving, selectedId]);

  const beginEdit = useCallback(
    async (rowId: string, date: string, time: string) => {
      if (saving) return;
      if (editingIdRef.current === rowId) return;

      if (editingIdRef.current && editingIdRef.current !== rowId) {
        const ok = await commitCurrentEdit();
        if (!ok) return;
      }

      captureFlip();
      setSelectedId(rowId);
      setEditingId(rowId);
      editingIdRef.current = rowId;
      setDraftDate(date);
      setDraftTime(time);
      draftDateRef.current = date;
      draftTimeRef.current = time;
      baselineDateRef.current = date;
      baselineTimeRef.current = time;
      setError(null);
    },
    [captureFlip, commitCurrentEdit, saving],
  );

  const selectRow = useCallback(
    async (rowId: string) => {
      if (saving) return;
      if (editingIdRef.current && editingIdRef.current !== rowId) {
        const ok = await commitCurrentEdit();
        if (!ok) return;
      }
      captureFlip();
      setSelectedId(rowId);
      setEditingId(null);
      editingIdRef.current = null;
    },
    [captureFlip, commitCurrentEdit, saving],
  );

  const cancelEdit = useCallback(() => {
    captureFlip();
    setEditingId(null);
    editingIdRef.current = null;
    setError(null);
  }, [captureFlip]);

  const saveCurrent = useCallback(async () => {
    const id = editingIdRef.current;
    if (!id) return;
    const ok = await savePost(id, draftDateRef.current, draftTimeRef.current);
    if (!ok) return;
    baselineDateRef.current = draftDateRef.current;
    baselineTimeRef.current = draftTimeRef.current;
    captureFlip();
    setEditingId(null);
    editingIdRef.current = null;
    router.refresh();
  }, [captureFlip, router, savePost]);

  const openHashtag = useCallback((tag: string) => {
    setActiveHashtag(formatHashtagLabel(tag));
  }, []);

  const openEditor = useCallback((row: CalendarRow) => {
    setEditorPost({
      id: row.id,
      title: row.title,
      content: row.content,
      status: row.status,
      mediaType: row.mediaType,
      mediaUrl: row.mediaUrl,
      mediaTitle: row.mediaTitle,
      firstComment: row.firstComment,
      secondComment: row.secondComment,
      thirdComment: row.thirdComment,
      topics: row.topics,
    });
  }, []);

  const moveToDraft = useCallback(
    async (row: CalendarRow) => {
      if (saving) return;
      if (row.status.toLowerCase() === "draft") return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/posts/${row.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "moveToDraft" }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || "Could not move to drafts");
          setSaving(false);
          return;
        }
        if (editingIdRef.current === row.id) {
          captureFlip();
          setEditingId(null);
          editingIdRef.current = null;
        }
        if (selectedId === row.id) {
          captureFlip();
          setSelectedId(null);
        }
        setSaving(false);
        router.refresh();
      } catch {
        setError("Could not move to drafts");
        setSaving(false);
      }
    },
    [captureFlip, router, saving, selectedId],
  );

  const deleteRow = useCallback(
    async (row: CalendarRow) => {
      if (saving) return;
      const label = truncateCaption(row.title || row.content) || "this post";
      if (
        !window.confirm(
          `Delete “${label}”? This cannot be undone.`,
        )
      ) {
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/posts/${row.id}`, { method: "DELETE" });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || "Could not delete post");
          setSaving(false);
          return;
        }
        captureFlip();
        if (editingIdRef.current === row.id) {
          setEditingId(null);
          editingIdRef.current = null;
        }
        if (selectedId === row.id) setSelectedId(null);
        if (editorPost?.id === row.id) setEditorPost(null);
        setSaving(false);
        router.refresh();
      } catch {
        setError("Could not delete post");
        setSaving(false);
      }
    },
    [captureFlip, editorPost?.id, router, saving, selectedId],
  );

  const edit: EditController = {
    selectedId,
    editingId,
    draftDate,
    draftTime,
    saving,
    setDraftDate: (v) => {
      draftDateRef.current = v;
      setDraftDate(v);
    },
    setDraftTime: (v) => {
      draftTimeRef.current = v;
      setDraftTime(v);
    },
    beginEdit,
    selectRow,
    cancelEdit,
    saveCurrent,
    openHashtag,
    openEditor,
    moveToDraft,
    deleteRow,
  };

  return (
    <div ref={rootRef} className="space-y-8">
      {error && (
        <div className="type-p-m rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-700">
          {error}
        </div>
      )}
      <section>
        <h2 className="type-h5 mb-3">Scheduled</h2>
        <PostTable
          rows={scheduled}
          emptyLabel="No scheduled posts. Schedule a draft or create one in Composer."
          edit={edit}
        />
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h2 className="type-h5">Drafts</h2>
          <p className="type-p-s text-[var(--muted)]">
            All drafts — dated or undated. Past dates can be rescheduled.
          </p>
        </div>
        <PostTable
          rows={drafts}
          emptyLabel="No drafts yet."
          showScheduleAction
          edit={edit}
        />
      </section>
      {activeHashtag && (
        <HashtagPostsModal
          tag={activeHashtag}
          posts={matchingPosts}
          onClose={() => setActiveHashtag(null)}
        />
      )}
      {editorPost && (
        <PostEditorModal
          post={editorPost}
          onClose={() => setEditorPost(null)}
          onSaved={() => {
            setEditorPost(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
