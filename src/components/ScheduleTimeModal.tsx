"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  formatCalendarDate,
  truncateCaption,
} from "@/lib/calendar-format";

type ScheduleTimeModalProps = {
  postTitle: string;
  date: string; // YYYY-MM-DD
  initialTime: string; // HH:mm
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (time: string) => void;
};

export function ScheduleTimeModal({
  postTitle,
  date,
  initialTime,
  saving,
  error,
  onClose,
  onSave,
}: ScheduleTimeModalProps) {
  const [time, setTime] = useState(initialTime || "09:00");

  useEffect(() => {
    setTime(initialTime || "09:00");
  }, [initialTime, date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const dateLabel = formatCalendarDate(new Date(`${date}T12:00:00`));

  return (
    <div
      data-calendar-interactive
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-modal-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2
              id="time-modal-title"
              className="type-h3 text-[var(--ink)]"
            >
              Set time
            </h2>
            <p className="type-p-m mt-0.5 text-[var(--muted)]">{dateLabel}</p>
            <p className="type-p-s mt-1 truncate text-[var(--ink)]">
              {truncateCaption(postTitle, 48) || "Untitled post"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.2} aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="type-label-l block text-[var(--ink)]">
            Time
            <input
              type="time"
              className="type-p-m mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </label>
          {error && <p className="type-p-m text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button
            type="button"
            className="type-p-m rounded-lg px-3 py-1.5 text-[var(--muted)] hover:bg-[var(--bg)]"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="type-btn-m rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white disabled:opacity-50"
            disabled={saving || !time}
            onClick={() => onSave(time)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
