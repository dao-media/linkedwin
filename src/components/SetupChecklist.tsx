import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { linkedInSessionIsSet } from "@/lib/linkedin-session";
import { getSetting } from "@/lib/settings";

/** First-run guide on the Overview page; disappears once every step is done. */
export async function SetupChecklist() {
  const remoteDb = Boolean(process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL);
  const session = linkedInSessionIsSet(await getSetting("linkedin_session"));
  const synced = Boolean(await getSetting("last_activity_sync_at"));
  const named = Boolean(await getSetting("profile_name"));

  const steps = [
    {
      done: remoteDb,
      label: "Connect a Turso database",
      hint: "Set LIBSQL_URL + LIBSQL_AUTH_TOKEN (local dev works without it).",
    },
    {
      done: session,
      label: "Capture your LinkedIn session",
      hint: "Run npm run session:capture and log in with email + password.",
    },
    {
      done: synced,
      label: "Run your first activity sync",
      hint: "npm run activity:sync -- --scrolls 30, or run the GitHub Action manually.",
    },
    {
      done: named,
      label: "Set your profile & voice",
      hint: "Settings → Profile & voice (the first sync fills your name).",
      href: "/settings",
    },
  ];

  if (steps.every((s) => s.done)) return null;

  return (
    <section className="mb-6 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] p-5">
      <h2 className="type-h5">Finish setting up LinkedWin</h2>
      <ol className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2">
            {s.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" strokeWidth={1.4} aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" strokeWidth={1.4} aria-hidden />
            )}
            <div>
              <p className={`type-label-m ${s.done ? "text-[var(--muted)] line-through" : ""}`}>
                {s.href && !s.done ? <Link href={s.href} className="text-[var(--accent)] hover:underline">{s.label}</Link> : s.label}
              </p>
              {!s.done && <p className="type-p-s text-[var(--muted)]">{s.hint}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
