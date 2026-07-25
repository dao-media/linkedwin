import { desc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { db, ensureSchema } from "@/lib/db";
import { engageRecs } from "@/lib/schema";

export default async function EngagePage() {
  await ensureSchema();
  const items = await db
    .select()
    .from(engageRecs)
    .where(eq(engageRecs.status, "open"))
    .orderBy(desc(engageRecs.score))
    .all();

  return (
    <AppShell active="/engage" title="Engage">
      <p className="mb-4 text-sm text-[var(--muted)]">
        Ranked accounts/posts to engage with. Opens LinkedIn — no auto-comment
        in v1.
      </p>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <ol className="list-decimal space-y-3 pl-5 text-sm">
          {items.length === 0 && (
            <li className="text-[var(--muted)]">
              No recommendations yet. Seed data or POST /api/engage with scored
              suggestions from Claude/Gemini.
            </li>
          )}
          {items.map((r) => (
            <li key={r.id}>
              <span className="font-medium">@{r.handle}</span>
              <span className="text-[var(--muted)]"> — {r.reason}</span>
              {r.postUrl && (
                <>
                  {" "}
                  <a
                    href={r.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--accent)] underline"
                  >
                    Engage
                    <ExternalLink className="size-3.5" strokeWidth={1.2} aria-hidden />
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      </div>
    </AppShell>
  );
}
