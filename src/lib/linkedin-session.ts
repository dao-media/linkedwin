/**
 * LinkedIn Playwright storage-state helpers.
 * Always persist as a JSON *string* — never String(object).
 */

export type LinkedInStorageState = {
  cookies?: unknown[];
  origins?: unknown[];
};

export function isCorruptSessionText(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const t = raw.trim();
  return !t || /^\[object \w+\]$/i.test(t);
}

/** True when value looks like a Playwright storageState payload. */
export function isValidLinkedInSession(
  value: unknown,
): value is LinkedInStorageState {
  if (!value || typeof value !== "object") return false;
  const v = value as LinkedInStorageState;
  return Array.isArray(v.cookies);
}

/**
 * Normalize API/UI input into a canonical JSON string for SQLite.
 * Accepts a JSON string or an already-parsed object (never String(obj)).
 */
export function normalizeLinkedInSessionInput(input: unknown): string {
  if (input == null) {
    throw new Error("LinkedIn session is empty");
  }

  let parsed: unknown;

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed || isCorruptSessionText(trimmed)) {
      throw new Error(
        "LinkedIn session is missing or corrupted ([object Object])",
      );
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("LinkedIn session JSON is invalid");
    }
    // Unwrap accidental double-encoding: "\"{...}\"" → object
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        throw new Error("LinkedIn session JSON is invalid");
      }
    }
  } else if (typeof input === "object") {
    parsed = input;
  } else {
    throw new Error("LinkedIn session must be a JSON object or string");
  }

  if (!isValidLinkedInSession(parsed)) {
    throw new Error(
      "LinkedIn session must be Playwright storageState JSON (needs cookies[])",
    );
  }

  return JSON.stringify(parsed);
}

/** Parse a stored setting value; returns null if missing/corrupt. */
export function parseStoredLinkedInSession(
  raw: string | null | undefined,
): LinkedInStorageState | null {
  if (!raw || isCorruptSessionText(raw)) return null;
  try {
    let parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    return isValidLinkedInSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function linkedInSessionIsSet(raw: string | null | undefined): boolean {
  return parseStoredLinkedInSession(raw) != null;
}
