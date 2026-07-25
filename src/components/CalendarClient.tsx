"use client";

import { useState } from "react";
import { CalendarDays, List, MousePointerClick } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  CalendarTable,
  type CalendarRow,
} from "@/components/CalendarTable";
import { CalendarMonth } from "@/components/CalendarMonth";
import type { HashtagPostSummary } from "@/components/HashtagPostsModal";
import { ViewToggleOption } from "@/components/ViewToggleOption";

type ViewMode = "list" | "month";

export function CalendarClient({
  scheduled,
  drafts,
  libraryPosts,
}: {
  scheduled: CalendarRow[];
  drafts: CalendarRow[];
  libraryPosts: HashtagPostSummary[];
}) {
  const [view, setView] = useState<ViewMode>("list");

  return (
    <AppShell
      active="/calendar"
      title="Calendar"
      actions={
        <div className="inline-flex items-center gap-1" role="group" aria-label="Calendar view">
          <ViewToggleOption
            active={view === "list"}
            label="List"
            icon={List}
            onClick={() => setView("list")}
          />
          <ViewToggleOption
            active={view === "month"}
            label="Calendar"
            icon={CalendarDays}
            onClick={() => setView("month")}
          />
        </div>
      }
    >
      {view === "list" ? (
        <>
          <p className="mb-4 flex items-start gap-2 text-sm text-[var(--muted)]">
            <MousePointerClick
              className="mt-0.5 size-4 shrink-0 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Click a row to select, click again to edit date/time. Click a
            hashtag tag to see all posts using it. Complete posts stay listed
            only for the rest of their publish day.
          </p>
          <CalendarTable
            scheduled={scheduled}
            drafts={drafts}
            libraryPosts={libraryPosts}
          />
        </>
      ) : (
        <CalendarMonth scheduled={scheduled} drafts={drafts} />
      )}
    </AppShell>
  );
}
