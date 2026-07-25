"use client";

import { CalendarRange } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DATE_RANGES, type DateRangeId } from "@/lib/voice";

export function DateRangeSelect({ value }: { value: DateRangeId }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <label className="relative inline-flex items-center">
      <CalendarRange
        className="pointer-events-none absolute left-3 size-3.5 text-[var(--accent)]"
        strokeWidth={1.2}
        aria-hidden
      />
      <select
        className="h-9 appearance-none rounded-lg border border-[var(--accent)] bg-[var(--surface)] py-0 pl-9 pr-8 text-sm font-medium text-[var(--ink)] outline-none"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("range", e.target.value);
          router.push(`?${next.toString()}`);
        }}
        aria-label="Date range"
      >
        {DATE_RANGES.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
