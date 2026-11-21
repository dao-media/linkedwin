"use client";

import { useEffect, useState } from "react";
import type { Profile } from "./profile";
import { DEFAULT_VOICE_INSERTS } from "./voice";

const FALLBACK: Profile = { name: "Your Name", headline: "", voice: DEFAULT_VOICE_INSERTS };

// One fetch per page load, shared by every component that needs the profile
let pending: Promise<Profile> | null = null;

export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(FALLBACK);
  useEffect(() => {
    pending ??= fetch("/api/profile")
      .then((r) => (r.ok ? (r.json() as Promise<Profile>) : FALLBACK))
      .catch(() => FALLBACK);
    let alive = true;
    void pending.then((p) => alive && setProfile(p));
    return () => {
      alive = false;
    };
  }, []);
  return profile;
}
