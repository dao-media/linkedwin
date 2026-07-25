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
      setError("Invalid password");
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
            <h1 className="text-2xl font-bold">LinkedWin</h1>
            <p className="text-sm text-[var(--muted)]">Personal Content HQ</p>
          </div>
        </div>
        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
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
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-bold text-white"
        >
          <LogIn className="size-4" strokeWidth={1.2} aria-hidden />
          Enter
        </button>
      </form>
    </div>
  );
}
