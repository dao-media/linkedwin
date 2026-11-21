"use client";

import { Sparkles } from "lucide-react";
import { useProfile } from "@/lib/use-profile";

type VoiceInsertBarProps = {
  onInsert: (chars: string) => void;
  /** Sign-off chips only — for footer edit modal */
  mini?: boolean;
};

export function VoiceInsertBar({ onInsert, mini = false }: VoiceInsertBarProps) {
  const { voice: VOICE_INSERTS } = useProfile();
  const groups = mini
    ? ([["Sign-off", VOICE_INSERTS.signOff]] as [string, string[]][])
    : ([
        ["Body", VOICE_INSERTS.body],
        ["Structure", VOICE_INSERTS.structure],
        ["Sign-off", VOICE_INSERTS.signOff],
      ] as [string, string[]][]);

  return (
    <div className="rounded-lg bg-[var(--accent-soft)] p-3">
      <div className="type-label-m mb-2 flex items-center gap-1.5 text-[var(--accent)]">
        <Sparkles className="size-3.5" strokeWidth={1.2} aria-hidden />
        Quick inserts
      </div>
      {groups.map(([label, chips]) => (
        <div
          key={label}
          className={`${mini ? "" : "mb-2 last:mb-0 "}flex flex-wrap items-center gap-2`}
        >
          <span className="type-label-s w-16 text-[var(--muted)]">
            {label}
          </span>
          {chips.map((ch) => (
            <button
              key={`${label}-${ch}`}
              type="button"
              onClick={() => onInsert(ch)}
              className="type-p-m rounded-md border border-[var(--line)] bg-white px-2 py-1 hover:border-[var(--accent)]"
            >
              {ch}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
