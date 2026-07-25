"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Link2, MessageCircle, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CalendarRow } from "@/components/CalendarTable";
import {
  PostEditorModal,
  type PostEditorData,
} from "@/components/PostEditorModal";
import { ScheduleTimeModal } from "@/components/ScheduleTimeModal";
import {
  countFirstComments,
  formatCalendarTime,
  mediaLabel,
  truncateCaption,
  type CalendarMediaKind,
} from "@/lib/calendar-format";
import {
  localDateKey,
  localTimeValue,
  patchPostSchedule,
} from "@/lib/schedule-client";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DRAG_TYPE = "application/x-linkedwin-post-id";

type PendingDrop = {
  post: CalendarRow;
  date: string;
  initialTime: string;
};

function postLabel(row: CalendarRow) {
  return row.title?.trim() || row.content.trim() || "Untitled post";
}

function canDragPost(row: CalendarRow) {
  const s = row.status.toLowerCase();
  return s === "scheduled" || s === "draft" || s === "failed" || s === "error";
}

function MediaTypeIcon({ kind }: { kind: CalendarMediaKind }) {
  const cls = "size-3 shrink-0";
  switch (kind) {
    case "Image":
    case "Gif":
      return <ImageIcon className={cls} strokeWidth={1.2} aria-hidden />;
    case "Video":
      return <Video className={cls} strokeWidth={1.2} aria-hidden />;
    case "Doc":
      return <FileText className={cls} strokeWidth={1.2} aria-hidden />;
    case "Link":
      return <Link2 className={cls} strokeWidth={1.2} aria-hidden />;
    default:
      return null;
  }
}

function ChipMeta({
  media,
  commentCount,
}: {
  media: CalendarMediaKind;
  commentCount: number;
}) {
  const showMedia = media !== "None";
  if (!showMedia && commentCount <= 0) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {showMedia && (
        <span
          className="inline-flex size-4 items-center justify-center rounded-[3px] bg-white/70 text-[var(--accent)]"
          title={media}
          aria-label={media}
        >
          <MediaTypeIcon kind={media} />
        </span>
      )}
      {commentCount > 0 && (
        <span
          className="inline-flex h-4 items-center gap-0.5 rounded-[3px] bg-white/70 px-1 text-[var(--accent)]"
          title={`${commentCount} pinned comment${commentCount === 1 ? "" : "s"}`}
          aria-label={`${commentCount} pinned comment${commentCount === 1 ? "" : "s"}`}
        >
          <MessageCircle className="size-3 shrink-0" strokeWidth={1.2} aria-hidden />
          <span className="text-[9px] font-semibold leading-none tabular-nums">
            {commentCount}
          </span>
        </span>
      )}
    </div>
  );
}

export function CalendarMonth({
  scheduled,
  drafts,
}: {
  scheduled: CalendarRow[];
  drafts: CalendarRow[];
}) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDrop | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorPost, setEditorPost] = useState<PostEditorData | null>(null);
  const [didDrag, setDidDrag] = useState(false);

  const postsByDate = useMemo(() => {
    const map = new Map<string, CalendarRow[]>();
    for (const row of scheduled) {
      const key = localDateKey(row.scheduledFor);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) =>
        (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""),
      );
    }
    return map;
  }, [scheduled]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const allDraggable = useMemo(() => {
    const byId = new Map<string, CalendarRow>();
    for (const row of [...scheduled, ...drafts]) {
      if (canDragPost(row)) byId.set(row.id, row);
    }
    return byId;
  }, [scheduled, drafts]);

  function beginDrop(postId: string, date: string) {
    const post = allDraggable.get(postId);
    if (!post) return;
    setError(null);
    setPending({
      post,
      date,
      initialTime: localTimeValue(post.scheduledFor),
    });
  }

  async function saveTime(time: string) {
    if (!pending) return;
    setSaving(true);
    setError(null);
    const result = await patchPostSchedule(pending.post.id, pending.date, time);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{format(cursor, "MMMM yyyy")}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)]"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" strokeWidth={1.2} aria-hidden />
          </button>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)]"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" strokeWidth={1.2} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-sm"
            onClick={() => setCursor(startOfMonth(new Date()))}
          >
            Today
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Drag a post onto a date to reschedule. Top-right badges show media type
        and pinned comment count.
      </p>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--bg)]">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-xs font-semibold text-[var(--muted)]"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, new Date());
            const posts = postsByDate.get(key) ?? [];
            const isTarget = dropTarget === key;

            return (
              <div
                key={key}
                className={`min-h-24 border-b border-r border-[var(--line)] p-1.5 last:border-r-0 ${
                  inMonth ? "bg-[var(--surface)]" : "bg-[var(--bg)]/60"
                } ${
                  isTarget
                    ? "bg-[var(--accent-soft)] outline outline-2 outline-dashed outline-[var(--accent)] -outline-offset-2"
                    : ""
                }`}
                onDragOver={(e) => {
                  if (![...e.dataTransfer.types].includes(DRAG_TYPE)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(key);
                }}
                onDragLeave={() => {
                  setDropTarget((cur) => (cur === key ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  setDraggingId(null);
                  const postId = e.dataTransfer.getData(DRAG_TYPE);
                  if (postId) beginDrop(postId, key);
                }}
              >
                <div
                  className={`mb-1 text-xs font-medium ${
                    isToday
                      ? "inline-flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-white"
                      : inMonth
                        ? "text-[var(--ink)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {format(day, "d")}
                </div>
                <div className="flex flex-col gap-1">
                  {posts.map((row) => {
                    const time = row.scheduledFor
                      ? formatCalendarTime(new Date(row.scheduledFor))
                      : "";
                    const dragging = draggingId === row.id;
                    const media = mediaLabel(row.mediaType, row.mediaUrl);
                    const commentCount = countFirstComments(
                      row.firstComment,
                      row.secondComment,
                      row.thirdComment,
                    );
                    return (
                      <div
                        key={row.id}
                        draggable={canDragPost(row)}
                        onDragStart={(e) => {
                          if (!canDragPost(row)) {
                            e.preventDefault();
                            return;
                          }
                          setDidDrag(false);
                          e.dataTransfer.setData(DRAG_TYPE, row.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(row.id);
                        }}
                        onDrag={() => setDidDrag(true)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }}
                        onClick={() => {
                          if (didDrag) return;
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
                        }}
                        className={`cursor-grab rounded-md bg-[var(--accent-soft)] px-1.5 py-1 text-left active:cursor-grabbing ${
                          dragging ? "opacity-40" : ""
                        }`}
                        title={`${postLabel(row)} — click to edit`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="min-w-0 truncate text-[10px] font-semibold text-[var(--accent)]">
                            {time}
                          </div>
                          <ChipMeta media={media} commentCount={commentCount} />
                        </div>
                        <div className="mt-0.5 truncate text-[11px] leading-tight text-[var(--ink)]">
                          {truncateCaption(postLabel(row), 18)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline gap-3">
          <h2 className="text-sm font-semibold">Drafts</h2>
          <p className="text-xs text-[var(--muted)]">
            Drag a draft onto a date to schedule it.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          {drafts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
              No drafts yet.
            </p>
          ) : (
            <ul>
              {drafts.map((row) => {
                const dragging = draggingId === row.id;
                return (
                  <li
                    key={row.id}
                    draggable
                    onDragStart={(e) => {
                      setDidDrag(false);
                      e.dataTransfer.setData(DRAG_TYPE, row.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(row.id);
                    }}
                    onDrag={() => setDidDrag(true)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                    onClick={() => {
                      if (didDrag) return;
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
                    }}
                    className={`flex cursor-grab items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 first:border-t-0 active:cursor-grabbing ${
                      dragging ? "opacity-40" : ""
                    }`}
                    title="Click to edit · drag onto a date to schedule"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {postLabel(row)}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {row.scheduledFor
                        ? format(new Date(row.scheduledFor), "MMM d")
                        : "No date"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {pending && (
        <ScheduleTimeModal
          postTitle={postLabel(pending.post)}
          date={pending.date}
          initialTime={pending.initialTime}
          saving={saving}
          error={error}
          onClose={() => {
            if (saving) return;
            setPending(null);
            setError(null);
          }}
          onSave={(time) => void saveTime(time)}
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
