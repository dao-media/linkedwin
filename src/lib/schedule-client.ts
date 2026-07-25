export async function patchPostSchedule(
  postId: string,
  date: string,
  time: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!date || !time) {
    return { ok: false, error: "Pick a date and time" };
  }
  try {
    const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
    const res = await fetch(`/api/posts/${postId}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledFor }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error:
          typeof body.error === "string"
            ? body.error
            : "Failed to update schedule",
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export function localDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function localTimeValue(iso: string | null | undefined): string {
  if (!iso) return "09:00";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "09:00";
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join(":");
}
