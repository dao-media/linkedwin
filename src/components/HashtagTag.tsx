"use client";

type HashtagTagProps = {
  tag: string;
  onClick?: (tag: string) => void;
  /** Subtle accent outline when the parent row is selected/highlighted */
  emphasized?: boolean;
};

export function HashtagTag({ tag, onClick, emphasized = false }: HashtagTagProps) {
  return (
    <button
      type="button"
      className={`inline-flex max-w-full shrink-0 items-center truncate rounded-md border px-2 py-0.5 text-xs font-medium text-[var(--accent)] transition ${
        emphasized
          ? "border-[var(--accent)] bg-[var(--selected)]"
          : "border-transparent bg-[var(--accent-soft)] hover:bg-[var(--selected)]"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(tag);
      }}
    >
      {tag}
    </button>
  );
}
