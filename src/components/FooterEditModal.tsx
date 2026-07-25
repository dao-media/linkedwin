"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { VoiceInsertBar } from "@/components/VoiceInsertBar";

type FooterEditModalProps = {
  mode: "create" | "edit";
  initialName?: string;
  initialBody?: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (payload: { name: string; body: string }) => void;
};

export function FooterEditModal({
  mode,
  initialName = "",
  initialBody = "",
  saving,
  error,
  onClose,
  onSave,
}: FooterEditModalProps) {
  const [name, setName] = useState(initialName);
  const [body, setBody] = useState(initialBody);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const canSave = name.trim().length > 0 && body.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="footer-edit-modal-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <h2
            id="footer-edit-modal-title"
            className="text-base font-semibold text-[var(--ink)]"
          >
            {mode === "create" ? "Save footer" : "Edit footer"}
          </h2>
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
          <label className="block text-sm font-medium text-[var(--ink)]">
            Name
            <input
              type="text"
              className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              placeholder="e.g. Newsletter CTA"
              autoFocus
            />
          </label>

          <label className="block text-sm font-medium text-[var(--ink)]">
            Footer
            <textarea
              className="mt-1.5 min-h-[88px] w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={saving}
              placeholder="Write your sign-off footer…"
            />
          </label>

          <VoiceInsertBar
            mini
            onInsert={(chars) => setBody((current) => `${current}${chars}`)}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--bg)]"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={saving || !canSave}
            onClick={() =>
              onSave({ name: name.trim(), body: body.trim() })
            }
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
