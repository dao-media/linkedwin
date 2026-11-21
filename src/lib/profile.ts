/** Owner profile + voice palette — per-install, stored in settings. */
import { getSetting } from "./settings";
import { parseVoiceInserts, type VoiceInserts } from "./voice";

export type Profile = {
  name: string;
  headline: string;
  voice: VoiceInserts;
};

export async function getProfile(): Promise<Profile> {
  return {
    name: (await getSetting("profile_name")) || "Your Name",
    headline: (await getSetting("profile_headline")) || "",
    voice: parseVoiceInserts(await getSetting("voice_inserts")),
  };
}
