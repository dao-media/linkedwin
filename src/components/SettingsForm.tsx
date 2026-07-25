"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

type SettingsState = {
  zernioApiKeySet: boolean;
  zernioAccountId: string;
  sessionHealth: string;
  niches: string;
  linkedinFollowers: string;
};

export function SettingsForm() {
  const [state, setState] = useState<SettingsState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [niches, setNiches] = useState("");
  const [sessionHealth, setSessionHealth] = useState("unknown");
  const [linkedinFollowers, setLinkedinFollowers] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setState(data);
        setAccountId(data.zernioAccountId ?? "");
        setNiches(data.niches ?? "");
        setSessionHealth(data.sessionHealth ?? "unknown");
        setLinkedinFollowers(data.linkedinFollowers ?? "");
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zernioApiKey: apiKey || undefined,
        zernioAccountId: accountId,
        niches,
        sessionHealth,
        linkedinFollowers,
      }),
    });
    if (!res.ok) {
      setMsg("Save failed");
      return;
    }
    setMsg("Saved");
    setApiKey("");
    const data = await fetch("/api/settings").then((r) => r.json());
    setState(data);
  }

  return (
    <form
      onSubmit={save}
      className="max-w-xl space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Zernio API key {state?.zernioApiKeySet ? "(set)" : "(missing)"}
        </span>
        <input
          type="password"
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste to update"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          LinkedIn account ID (Zernio)
        </span>
        <input
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Browser session (repost worker)
        </span>
        <select
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={sessionHealth}
          onChange={(e) => setSessionHealth(e.target.value)}
        >
          <option value="healthy">healthy</option>
          <option value="expired">expired — reconnect</option>
          <option value="unknown">unknown</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Current LinkedIn followers
        </span>
        <input
          type="number"
          min={0}
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={linkedinFollowers}
          onChange={(e) => setLinkedinFollowers(e.target.value)}
          placeholder="e.g. 12480"
        />
        <span className="mt-1 block text-xs text-[var(--muted)]">
          Snapshot stamped onto each post when it goes live, and saved to
          follower growth history for Trends. Historical counts for older posts
          usually aren’t available from LinkedIn.
        </span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
          Niches (comma-separated)
        </span>
        <input
          className="w-full rounded-lg border border-[var(--line)] px-3 py-2"
          value={niches}
          onChange={(e) => setNiches(e.target.value)}
          placeholder="AI agents, B2B content, Product ops"
        />
      </label>
      {msg && <p className="text-sm text-[var(--success)]">{msg}</p>}
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white"
      >
        <Save className="size-4" strokeWidth={1.2} aria-hidden />
        Save settings
      </button>
    </form>
  );
}
