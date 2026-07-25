"use client";

type PinnedCommentsFieldsProps = {
  comments: string[];
  onChange: (index: number, value: string) => void;
};

export function nextPinnedComments(prev: string[], index: number, value: string) {
  const next = [...prev];
  next[index] = value;
  while (next.length > 1 && next[next.length - 1] === "") next.pop();
  if (next.length < 3 && next[next.length - 1] !== "") next.push("");
  if (next.every((c) => c === "")) return [""];
  return next;
}

export function commentsFromPost(input: {
  firstComment?: string | null;
  secondComment?: string | null;
  thirdComment?: string | null;
}): string[] {
  const filled = [
    input.firstComment,
    input.secondComment,
    input.thirdComment,
  ]
    .map((c) => (c ?? "").trim())
    .filter(Boolean);
  if (filled.length === 0) return [""];
  if (filled.length < 3) return [...filled, ""];
  return filled.slice(0, 3);
}

export function PinnedCommentsFields({
  comments,
  onChange,
}: PinnedCommentsFieldsProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-xs font-semibold text-[var(--muted)]">
        Pinned comments
      </legend>
      <p className="text-xs text-[var(--muted)]">
        Auto-posted in order after publish · up to 3 · next blank appears as you
        type
      </p>
      {comments.map((comment, index) => (
        <label key={index} className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--ink)]">
            Comment {index + 1}
            {index === 0 ? (
              <span className="font-normal text-[var(--muted)]">
                {" "}
                · via Zernio
              </span>
            ) : (
              <span className="font-normal text-[var(--muted)]">
                {" "}
                · via worker
              </span>
            )}
          </span>
          <textarea
            className="min-h-16 w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm"
            value={comment}
            onChange={(e) => onChange(index, e.target.value)}
            placeholder={
              index === 0
                ? "Put links here to protect reach"
                : `Optional comment ${index + 1}`
            }
          />
        </label>
      ))}
    </fieldset>
  );
}
