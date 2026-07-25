import { desc } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { db, ensureSchema } from "@/lib/db";
import { radarPosts } from "@/lib/schema";

export default async function RadarPage() {
  await ensureSchema();
  const items = await db
    .select()
    .from(radarPosts)
    .orderBy(desc(radarPosts.engagementScore))
    .all();

  return (
    <AppShell active="/radar" title="Radar">
      <p className="mb-4 text-sm text-[var(--muted)]">
        Top posts in your niches — curated watch accounts and manual imports.
      </p>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <ul className="space-y-3 text-sm">
          {items.length === 0 && (
            <li className="text-[var(--muted)]">
              No radar items yet. Run `npm run db:seed` or import niche posts.
            </li>
          )}
          {items.map((p) => (
            <li
              key={p.id}
              className="border-b border-[var(--line)] pb-3 last:border-0"
            >
              <div className="font-medium">
                @{p.authorHandle} — {(p.engagementScore ?? 0).toLocaleString()} eng
              </div>
              <div className="text-[var(--muted)]">{p.title}</div>
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--accent)] underline"
                >
                  Open on LinkedIn
                  <ExternalLink className="size-3.5" strokeWidth={1.2} aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
