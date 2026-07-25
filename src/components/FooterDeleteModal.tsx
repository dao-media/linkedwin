"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type FooterDeleteModalProps = {
  footerName: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

export function FooterDeleteModal({
  footerName,
  saving,
  error,
  onClose,
  onConfirm,
}: FooterDeleteModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="footer-delete-modal-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <h2
            id="footer-delete-modal-title"
            className="text-base font-semibold text-[var(--ink)]"
          >
            Delete footer
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

        <div className="space-y-1 px-5 py-4">
          <p className="text-sm text-[var(--ink)]">
            Are you sure you want to delete this footer?
          </p>
          <p className="truncate text-sm text-[var(--muted)]">{footerName}</p>
          {error && <p className="pt-2 text-sm text-red-600">{error}</p>}
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
            className="rounded-lg bg-[#c0392b] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
