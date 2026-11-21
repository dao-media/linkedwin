"use client";

type PeriodOption = { id: string; label: string };

export function PeriodChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly PeriodOption[] | PeriodOption[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id as T)}
            className={
              active
                ? "type-label-s rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 text-[var(--accent)]"
                : "type-label-s rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
