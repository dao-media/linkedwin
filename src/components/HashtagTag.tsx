"use client";

type HashtagTagProps = {
  tag: string;
  onClick?: (tag: string) => void;
};

export function HashtagTag({ tag, onClick }: HashtagTagProps) {
  return (
    <button
      type="button"
      className="inline-flex max-w-full shrink-0 items-center truncate rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--selected)]"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(tag);
      }}
    >
      {tag}
    </button>
  );
}
