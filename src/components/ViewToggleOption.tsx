"use client";

import type { LucideIcon } from "lucide-react";

export function ViewToggleOption({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
          : "inline-flex h-7 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--bg)]"
      }
    >
      <Icon
        className={active ? "size-4 shrink-0" : "size-3.5 shrink-0"}
        strokeWidth={active ? 1.6 : 1.2}
        aria-hidden
      />
      {label}
    </button>
  );
}
