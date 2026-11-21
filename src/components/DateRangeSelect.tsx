"use client";

import { useEffect } from "react";
import { CalendarRange } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DATE_RANGES, type DateRangeId } from "@/lib/voice";

const STORAGE_KEY = "linkedwin.overview.range";

function isDateRangeId(value: string | null | undefined): value is DateRangeId {
  return Boolean(value && DATE_RANGES.some((r) => r.id === value));
}

export function DateRangeSelect({ value }: { value: DateRangeId }) {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const fromUrl = params.get("range");
    if (isDateRangeId(fromUrl)) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return;
    }

    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!isDateRangeId(saved) || saved === value) return;

    const next = new URLSearchParams(params.toString());
    next.set("range", saved);
    router.replace(`?${next.toString()}`);
  }, [params, router, value]);

  return (
    <label className="relative inline-flex items-center">
      <CalendarRange
        className="pointer-events-none absolute left-3 size-3.5 text-[var(--accent)]"
        strokeWidth={1.2}
        aria-hidden
      />
      <select
        className="type-menu h-9 appearance-none rounded-lg border border-[var(--accent)] bg-[var(--surface)] py-0 pl-9 pr-8 text-[var(--ink)] outline-none"
        value={value}
        onChange={(e) => {
          const nextRange = e.target.value;
          if (isDateRangeId(nextRange)) {
            sessionStorage.setItem(STORAGE_KEY, nextRange);
          }
          const next = new URLSearchParams(params.toString());
          next.set("range", nextRange);
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
