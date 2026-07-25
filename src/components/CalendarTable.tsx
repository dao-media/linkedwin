"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Expand, Save, X } from "lucide-react";
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
  PostPreviewModal,
  type PostPreviewData,
} from "@/components/PostPreviewModal";

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
  error: string | null;
  setDraftDate: (v: string) => void;
  setDraftTime: (v: string) => void;
  beginEdit: (rowId: string, date: string, time: string) => Promise<void>;
  selectRow: (rowId: string) => Promise<void>;
  cancelEdit: () => void;
  saveCurrent: () => Promise<void>;
  openHashtag: (tag: string) => void;
  openPreview: (row: CalendarRow) => void;
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
  const colCount = showScheduleAction ? 8 : 7;
  const {
    selectedId,
    editingId,
    draftDate,
    draftTime,
    saving,
    error,
    setDraftDate,
    setDraftTime,
    beginEdit,
    selectRow,
    cancelEdit,
    saveCurrent,
    openHashtag,
    openPreview,
  } = edit;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      {error && editingId && rows.some((r) => r.id === editingId) && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--bg)] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Date</th>
            <th className="px-4 py-3 text-left font-semibold">Time</th>
            <th className="w-[8.75rem] max-w-[8.75rem] px-4 py-3 text-left font-semibold">
              Post caption
            </th>
            <th className="px-4 py-3 text-left font-semibold">Media</th>
            <th className="px-4 py-3 text-left font-semibold">Status</th>
            <th className="px-4 py-3 text-left font-semibold">Hashtags</th>
            <th className="px-4 py-3 text-left font-semibold">First comments</th>
            {showScheduleAction && (
              <th className="px-4 py-3 text-left font-semibold" />
            )}
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
            );
            const caption = truncateCaption(row.title || row.content);

            return (
              <tr
                key={row.id}
                className={`border-t border-[var(--line)] ${
                  selected || editing ? "bg-[var(--accent-soft)]" : ""
                }`}
                onClick={() => {
                  if (editing || saving) return;
                  if (selectedId === row.id) {
                    void beginEdit(row.id, date, time);
                  } else {
                    void selectRow(row.id);
                  }
                }}
              >
                <td className="whitespace-nowrap px-4 py-3 text-left">
                  {editing ? (
                    <input
                      type="date"
                      className="rounded-md border border-[var(--accent)] bg-white px-2 py-1 text-left"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={
                        selected
                          ? "inline-block rounded-md border border-[var(--accent)] bg-[var(--selected)] px-2 py-1 text-left"
                          : "text-left"
                      }
                    >
                      {displayDate || "—"}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-left">
                  {editing ? (
                    <input
                      type="time"
                      className="rounded-md border border-[var(--accent)] bg-white px-2 py-1 text-left"
                      value={draftTime}
                      onChange={(e) => setDraftTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={
                        selected
                          ? "inline-block rounded-md border border-[var(--accent)] bg-[var(--selected)] px-2 py-1 text-left"
                          : "text-left"
                      }
                    >
                      {displayTime || "—"}
                    </span>
                  )}
                </td>
                <td
                  className="group relative w-[8.75rem] max-w-[8.75rem] px-4 py-3 text-left"
                  title={row.title || row.content}
                >
                  <span className="block truncate pr-1">{caption || "—"}</span>
                  {(row.title || row.content) && (
                    <button
                      type="button"
                      className="absolute inset-y-1 right-1 inline-flex items-center gap-1 rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)] opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(row);
                      }}
                    >
                      <Expand className="size-3.5 shrink-0" strokeWidth={1.2} aria-hidden />
                      Preview
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-left text-[var(--muted)]">
                  {media}
                </td>
                <td className="px-4 py-3 text-left text-[var(--muted)]">
                  {displayStatus(row, editing, saving)}
                </td>
                <td className="max-w-[12rem] px-4 py-3 text-left">
                  {hashtags.length === 0 ? (
                    <span className="text-[var(--muted)]">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {hashtags.map((tag) => (
                        <HashtagTag
                          key={tag.toLowerCase()}
                          tag={tag}
                          onClick={openHashtag}
                        />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-left text-[var(--muted)]">
                  {commentCount}
                </td>
                {showScheduleAction && (
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      disabled={saving}
                      className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-left text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        void beginEdit(row.id, date, time);
                      }}
                    >
                      Schedule
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-10 text-center text-[var(--muted)]"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {editingId && rows.some((r) => r.id === editingId) && (
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            Only one row edits at a time — switching rows saves the current
            edit.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--muted)]"
              onClick={cancelEdit}
              disabled={saving}
            >
              <X className="size-3.5" strokeWidth={1.2} aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<PostPreviewData | null>(null);

  const draftDateRef = useRef(draftDate);
  const draftTimeRef = useRef(draftTime);
  const editingIdRef = useRef(editingId);
  draftDateRef.current = draftDate;
  draftTimeRef.current = draftTime;
  editingIdRef.current = editingId;

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
    setEditingId(null);
    editingIdRef.current = null;
    router.refresh();
    return true;
  }, [router, savePost]);

  const beginEdit = useCallback(
    async (rowId: string, date: string, time: string) => {
      if (saving) return;
      if (editingIdRef.current === rowId) return;

      if (editingIdRef.current && editingIdRef.current !== rowId) {
        const ok = await commitCurrentEdit();
        if (!ok) return;
      }

      setSelectedId(rowId);
      setEditingId(rowId);
      editingIdRef.current = rowId;
      setDraftDate(date);
      setDraftTime(time);
      draftDateRef.current = date;
      draftTimeRef.current = time;
      setError(null);
    },
    [commitCurrentEdit, saving],
  );

  const selectRow = useCallback(
    async (rowId: string) => {
      if (saving) return;
      if (editingIdRef.current && editingIdRef.current !== rowId) {
        const ok = await commitCurrentEdit();
        if (!ok) return;
      }
      setSelectedId(rowId);
      setEditingId(null);
      editingIdRef.current = null;
    },
    [commitCurrentEdit, saving],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    editingIdRef.current = null;
    setError(null);
  }, []);

  const saveCurrent = useCallback(async () => {
    const id = editingIdRef.current;
    if (!id) return;
    const ok = await savePost(id, draftDateRef.current, draftTimeRef.current);
    if (!ok) return;
    setEditingId(null);
    editingIdRef.current = null;
    router.refresh();
  }, [router, savePost]);

  const openHashtag = useCallback((tag: string) => {
    setActiveHashtag(formatHashtagLabel(tag));
  }, []);

  const openPreview = useCallback((row: CalendarRow) => {
    setPreviewPost({
      id: row.id,
      title: row.title,
      content: row.content,
      footer: row.footer,
      mediaType: row.mediaType,
      mediaUrl: row.mediaUrl,
      mediaTitle: row.mediaTitle,
      firstComment: row.firstComment,
      secondComment: row.secondComment,
      topics: row.topics,
    });
  }, []);

  const edit: EditController = {
    selectedId,
    editingId,
    draftDate,
    draftTime,
    saving,
    error,
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
    openPreview,
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold">Scheduled</h2>
        <PostTable
          rows={scheduled}
          emptyLabel="No scheduled posts. Schedule a draft or create one in Composer."
          edit={edit}
        />
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h2 className="text-sm font-semibold">Drafts</h2>
          <p className="text-xs text-[var(--muted)]">
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
      {previewPost && (
        <PostPreviewModal
          post={previewPost}
          onClose={() => setPreviewPost(null)}
        />
      )}
    </div>
  );
}
