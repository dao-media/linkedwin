"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  KeyRound,
  RefreshCw,
  Save,
  Shield,
  Tags,
  UserRound,
} from "lucide-react";

type SessionHealth = "healthy" | "expired" | "unknown";

type ActivitySyncResult = {
  at: string;
  ok: boolean;
  inserted?: number;
  upgraded?: number;
  seen?: number;
  error?: string;
};

type SettingsState = {
  profileName: string;
  profileHeadline: string;
  voiceInserts: { body: string[]; structure: string[]; signOff: string[] };
  activitySync: ActivitySyncResult | null;
  zernioApiKeySet: boolean;
  zernioAccountId: string;
  zernioAccountLabel?: string;
  sessionHealth: SessionHealth | string;
  linkedinSessionSet: boolean;
  sessionCorrupt?: boolean;
  niches: string;
  linkedinFollowers: string;
  lastSyncedAt?: string | null;
};

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "danger" | "muted" | "accent";
  children: React.ReactNode;
}) {
  const styles =
    tone === "success"
      ? "border-[#b7e0cb] bg-[#eaf7f0] text-[var(--success)]"
      : tone === "danger"
        ? "border-[#f0c2bc] bg-[#fdf0ee] text-[#c0392b]"
        : tone === "accent"
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]";

  return (
    <span
      className={`type-btn-s inline-flex items-center rounded-md border px-2 py-0.5 ${styles}`}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="type-p-m block">
      <span className="type-label-m mb-1.5 block text-[var(--muted)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="type-p-s mt-1.5 block text-[var(--muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

const inputClass =
  "type-p-m w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none focus:border-[var(--accent)]";

const SECRET_MASK = "••••••••••••••••••••••••••••••••";
const SESSION_MASK =
  "••••••••••••••••••••••••••••••••••••••••••••••••••••\n••••••••••••••••••••••••••••••••••••••••••••••••••••\n••••••••••••••••  session JSON saved  ••••••••••••••••";

export function SettingsForm() {
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<SettingsState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [niches, setNiches] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileHeadline, setProfileHeadline] = useState("");
  const [voiceBody, setVoiceBody] = useState("");
  const [voiceStructure, setVoiceStructure] = useState("");
  const [voiceSignOff, setVoiceSignOff] = useState("");
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>("unknown");
  const [linkedinSession, setLinkedinSession] = useState("");
  const [sessionDirty, setSessionDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: SettingsState) => {
        if (cancelled) return;
        setState(data);
        setAccountId(data.zernioAccountId ?? "");
        setNiches(data.niches ?? "");
        setProfileName(data.profileName ?? "");
        setProfileHeadline(data.profileHeadline ?? "");
        setVoiceBody((data.voiceInserts?.body ?? []).join(" "));
        setVoiceStructure((data.voiceInserts?.structure ?? []).join(" "));
        setVoiceSignOff((data.voiceInserts?.signOff ?? []).join(" "));
        setSessionHealth(
          (data.sessionHealth as SessionHealth) || "unknown",
        );
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load settings");
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshSettings() {
    const data = (await fetch("/api/settings").then((r) =>
      r.json(),
    )) as SettingsState;
    setState(data);
    setAccountId(data.zernioAccountId ?? "");
    setNiches(data.niches ?? "");
        setProfileName(data.profileName ?? "");
        setProfileHeadline(data.profileHeadline ?? "");
        setVoiceBody((data.voiceInserts?.body ?? []).join(" "));
        setVoiceStructure((data.voiceInserts?.structure ?? []).join(" "));
        setVoiceSignOff((data.voiceInserts?.signOff ?? []).join(" "));
    setSessionHealth((data.sessionHealth as SessionHealth) || "unknown");
    return data;
  }

  const sessionTone = useMemo(() => {
    if (sessionHealth === "healthy") return "success" as const;
    if (sessionHealth === "expired") return "danger" as const;
    return "muted" as const;
  }, [sessionHealth]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);

    const sessionJson = linkedinSession.trim();
    if (sessionDirty && sessionJson) {
      try {
        const parsed: unknown = JSON.parse(sessionJson);
        if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { cookies?: unknown }).cookies)) {
          setError(
            "LinkedIn session must be Playwright storageState JSON (with cookies)",
          );
          setSaving(false);
          return;
        }
      } catch {
        setError("LinkedIn session JSON is invalid");
        setSaving(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zernioApiKey:
            apiKeyDirty && apiKey.trim() ? apiKey.trim() : undefined,
          zernioAccountId: accountId,
          niches,
          profileName,
          profileHeadline,
          voiceInserts: {
            body: voiceBody.split(/\s+/).filter(Boolean),
            structure: voiceStructure.split(/\s+/).filter(Boolean),
            signOff: voiceSignOff.split(/\s+/).filter(Boolean),
          },
          sessionHealth,
          // Always send the raw string — never a parsed object
          linkedinSession:
            sessionDirty && sessionJson ? sessionJson : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Save failed",
        );
        return;
      }
      setMsg("Settings saved");
      setApiKey("");
      setApiKeyDirty(false);
      setLinkedinSession("");
      setSessionDirty(false);
      await refreshSettings();
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runSync() {
    setSyncing(true);
    setSyncSummary(null);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Sync failed");
      }
      await refreshSettings();
      const parts = [
        data.followers != null
          ? `${Number(data.followers).toLocaleString()} followers`
          : null,
        data.postsImported
          ? `${data.postsImported} posts imported`
          : null,
        data.metricsSynced
          ? `${data.metricsSynced} metrics refreshed`
          : null,
        data.demoPostsRemoved
          ? `${data.demoPostsRemoved} demo posts removed`
          : null,
      ].filter(Boolean);
      const warn =
        Array.isArray(data.warnings) && data.warnings.length
          ? ` Note: ${data.warnings.join(" ")}`
          : "";
      setSyncSummary(
        parts.length
          ? `Synced — ${parts.join(" · ")}.${warn}`
          : `Sync finished.${warn}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!loaded) {
    return (
      <p className="type-p-m text-[var(--muted)]">Loading settings…</p>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {state?.sessionCorrupt || sessionHealth === "expired" ? (
        <div className="type-p-m flex items-start gap-3 rounded-xl border border-[#f0c2bc] bg-[#fdf0ee] px-4 py-3 text-[#8a2a20]">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={1.2}
            aria-hidden
          />
          <div>
            <p className="type-label-m">
              {state?.sessionCorrupt
                ? "Browser session JSON is corrupted"
                : "Browser session expired"}
            </p>
            <p className="mt-0.5 text-[#8a2a20]/90">
              {state?.sessionCorrupt
                ? "The saved value was not valid Playwright storageState (often from String(object) → “[object Object]”). Run npm run session:capture or restore from linkedin-session.json, then Save."
                : "Activity sync is paused until you capture a fresh session (npm run session:capture) or paste one below and mark it healthy."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="type-p-s flex items-center gap-2 text-[var(--muted)]">
            <RefreshCw className="size-3.5" strokeWidth={1.2} aria-hidden />
            Activity sync
          </div>
          <div className="mt-3">
            <StatusPill
              tone={
                !state?.activitySync
                  ? "muted"
                  : state.activitySync.ok
                    ? "success"
                    : "danger"
              }
            >
              {!state?.activitySync
                ? "Never run"
                : state.activitySync.ok
                  ? "Last run OK"
                  : "Last run failed"}
            </StatusPill>
          </div>
          <p className="type-p-s mt-2 text-[var(--muted)]">
            {state?.activitySync
              ? `${new Date(state.activitySync.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · ${
                  state.activitySync.ok
                    ? `${state.activitySync.inserted ?? 0} new, ${state.activitySync.upgraded ?? 0} updated`
                    : state.activitySync.error
                }`
              : "Runs from the GitHub Action (every 6h) or npm run activity:sync."}
            {state?.linkedinFollowers
              ? ` · ${Number(state.linkedinFollowers).toLocaleString()} followers`
              : ""}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="type-p-s flex items-center gap-2 text-[var(--muted)]">
            <Shield className="size-3.5" strokeWidth={1.2} aria-hidden />
            Browser session
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={sessionTone}>
              {sessionHealth === "healthy"
                ? "Healthy"
                : sessionHealth === "expired"
                  ? "Expired"
                  : "Unknown"}
            </StatusPill>
            <StatusPill tone={state?.linkedinSessionSet ? "muted" : "danger"}>
              {state?.linkedinSessionSet ? "JSON stored" : "No session JSON"}
            </StatusPill>
          </div>
          <p className="type-p-s mt-2 text-[var(--muted)]">
            Read-only: LinkedWin uses it to read your own activity page. It
            never posts, comments or reposts.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="type-h5 flex items-center gap-2">
              <RefreshCw
                className="size-4 text-[var(--accent)]"
                strokeWidth={1.2}
                aria-hidden
              />
              Zernio analytics (optional)
            </h2>
            <p className="type-p-m mt-1 max-w-2xl text-[var(--muted)]">
              Only needed if you already use Zernio: pulls follower stats and
              analytics for posts Zernio knows about. Activity sync covers
              followers and impressions without it.
            </p>
            {state?.lastSyncedAt ? (
              <p className="type-p-s mt-2 text-[var(--muted)]">
                Last sync{" "}
                {new Date(state.lastSyncedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {state.linkedinFollowers
                  ? ` · ${Number(state.linkedinFollowers).toLocaleString()} followers`
                  : ""}
              </p>
            ) : (
              <p className="type-p-s mt-2 text-[var(--muted)]">
                Not connected — add a Zernio key below to enable.
              </p>
            )}
            {syncSummary ? (
              <p className="type-p-m mt-2 text-[var(--success)]">{syncSummary}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncing || !state?.zernioApiKeySet}
            className="type-btn-l inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`size-4 ${syncing ? "animate-spin" : ""}`}
              strokeWidth={1.2}
              aria-hidden
            />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4">
          <h2 className="type-h5 flex items-center gap-2">
            <KeyRound
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Zernio connection (optional)
          </h2>
          <p className="type-p-m mt-1 text-[var(--muted)]">
            LinkedWin never publishes through Zernio; the key is used for read-only analytics.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={`API key ${state?.zernioApiKeySet ? "(saved)" : "(missing)"}`}
            hint={
              state?.zernioApiKeySet
                ? "Asterisks mean a key is saved. Focus the field and paste a new key only if you want to replace it."
                : "Paste your Zernio API key, then save."
            }
          >
            <input
              type="password"
              className={inputClass}
              value={
                apiKeyDirty
                  ? apiKey
                  : state?.zernioApiKeySet
                    ? SECRET_MASK
                    : ""
              }
              onFocus={() => {
                if (!apiKeyDirty && state?.zernioApiKeySet) {
                  setApiKeyDirty(true);
                  setApiKey("");
                }
              }}
              onChange={(e) => {
                setApiKeyDirty(true);
                setApiKey(e.target.value);
              }}
              placeholder={
                state?.zernioApiKeySet ? "Paste new key to replace" : "Paste API key"
              }
              autoComplete="off"
            />
          </Field>
          <Field
            label="LinkedIn account ID"
            hint="From Zernio → list accounts (GET /v1/accounts) after you connect LinkedIn. Paste the LinkedIn account’s _id here."
          >
            <input
              className={inputClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="e.g. 66b2e19d8c3f5a7e9d0b1c2e"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="type-h5 flex items-center gap-2">
              <Shield
                className="size-4 text-[var(--accent)]"
                strokeWidth={1.2}
                aria-hidden
              />
              LinkedIn session (activity sync)
            </h2>
            <p className="type-p-m mt-1 max-w-2xl text-[var(--muted)]">
              Lets activity sync read your posts, metrics and follower count.{" "}
              <code className="type-label-s">npm run session:capture</code>{" "}
              saves it straight to your database; pasting here also works.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSessionHealth("healthy")}
            className="type-btn-s inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline"
          >
            <CheckCircle2 className="size-3.5" strokeWidth={1.2} aria-hidden />
            Mark healthy
          </button>
        </div>

        <div className="type-p-m mb-4 rounded-lg bg-[var(--accent-soft)] px-4 py-3 text-[var(--ink)]">
          <p className="type-label-m mb-1.5 flex items-center gap-1.5 text-[var(--accent)]">
            <CircleHelp className="size-3.5" strokeWidth={1.2} aria-hidden />
            Capture a fresh session
          </p>
            <ol className="type-p-s list-decimal space-y-1 pl-4 text-[var(--muted)]">
              <li>
                Run{" "}
                <code className="rounded bg-white/80 px-1 py-0.5 text-[var(--ink)]">
                  npm run session:capture
                </code>{" "}
                and log in with email + password (not Google)
              </li>
              <li>
                Open{" "}
                <code className="rounded bg-white/80 px-1 py-0.5 text-[var(--ink)]">
                  linkedin-session.json
                </code>{" "}
                and paste its contents below
              </li>
              <li>Save settings and mark session healthy</li>
            </ol>
        </div>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <Field label="Session health">
            <select
              className={inputClass}
              value={sessionHealth}
              onChange={(e) =>
                setSessionHealth(e.target.value as SessionHealth)
              }
            >
              <option value="healthy">Healthy</option>
              <option value="expired">Expired — reconnect</option>
              <option value="unknown">Unknown</option>
            </select>
          </Field>
          <Field
            label="Playwright storage state"
            hint={
              state?.linkedinSessionSet
                ? "Asterisks mean a session JSON is saved. Focus and paste only to replace it."
                : "No session stored yet. Run npm run session:capture, or paste storage-state JSON here."
            }
          >
            <textarea
              className={`${inputClass} type-p-s min-h-32 font-mono`}
              value={
                sessionDirty
                  ? linkedinSession
                  : state?.linkedinSessionSet
                    ? SESSION_MASK
                    : ""
              }
              onFocus={() => {
                if (!sessionDirty && state?.linkedinSessionSet) {
                  setSessionDirty(true);
                  setLinkedinSession("");
                }
              }}
              onChange={(e) => {
                setSessionDirty(true);
                setLinkedinSession(e.target.value);
              }}
              placeholder='{"cookies":[...],"origins":[...]}'
              spellCheck={false}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4">
          <h2 className="type-h5 flex items-center gap-2">
            <UserRound
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Profile &amp; voice
          </h2>
          <p className="type-p-m mt-1 text-[var(--muted)]">
            Shown in post previews. Activity sync fills your name on first run
            if it’s blank.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Display name">
            <input
              className={inputClass}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your Name"
            />
          </Field>
          <Field label="Headline">
            <input
              className={inputClass}
              value={profileHeadline}
              onChange={(e) => setProfileHeadline(e.target.value)}
              placeholder="What you do, in one line"
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Body inserts" hint="Space-separated emoji/characters">
            <input className={inputClass} value={voiceBody} onChange={(e) => setVoiceBody(e.target.value)} />
          </Field>
          <Field label="Structure inserts" hint="Arrows, bullets, dividers">
            <input className={inputClass} value={voiceStructure} onChange={(e) => setVoiceStructure(e.target.value)} />
          </Field>
          <Field label="Sign-off inserts" hint="Used by footers too">
            <input className={inputClass} value={voiceSignOff} onChange={(e) => setVoiceSignOff(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="mb-4">
          <h2 className="type-h5 flex items-center gap-2">
            <Tags
              className="size-4 text-[var(--accent)]"
              strokeWidth={1.2}
              aria-hidden
            />
            Niches
          </h2>
          <p className="type-p-m mt-1 text-[var(--muted)]">
            Topics that guide Radar and Engage scoring context.
          </p>
        </div>
        <Field
          label="Niches"
          hint="Comma-separated topics you publish around."
        >
          <input
            className={inputClass}
            value={niches}
            onChange={(e) => setNiches(e.target.value)}
            placeholder="AI agents, B2B content, Product ops"
          />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="type-btn-l inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-white disabled:opacity-50"
        >
          <Save className="size-4" strokeWidth={1.2} aria-hidden />
          {saving ? "Saving…" : "Save settings"}
        </button>
        {msg ? (
          <p className="type-label-l text-[var(--success)]">{msg}</p>
        ) : null}
        {error ? <p className="type-p-m text-red-600">{error}</p> : null}
      </div>
    </form>
  );
}
