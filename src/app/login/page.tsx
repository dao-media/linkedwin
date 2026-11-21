"use client";

import { useState } from "react";
import { Lock, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error || `Login failed (${res.status})`);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
      >
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
            <Lock className="size-5" strokeWidth={1.2} aria-hidden />
          </div>
          <div>
            <h1 className="type-h1">LinkedWin</h1>
            <p className="type-p-m text-[var(--muted)]">Personal Content HQ</p>
          </div>
        </div>
        <label className="mb-4 block type-p-m">
          <span className="mb-1 block type-label-m text-[var(--muted)]">
            Password
          </span>
          <input
            type="password"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="mb-3 type-p-m text-red-600">{error}</p>}
        <button
          type="submit"
          className="type-btn-l inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] py-2.5 text-white"
        >
          <LogIn className="size-4" strokeWidth={1.2} aria-hidden />
          Enter
        </button>
      </form>
    </div>
  );
}
