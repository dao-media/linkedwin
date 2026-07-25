import { eq } from "drizzle-orm";
import { db, ensureSchema } from "./db";
import { settings } from "./schema";

export async function getSetting(key: string) {
  await ensureSchema();
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await ensureSchema();
  await db
    .insert(settings)
    .values({
      key,
      value,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date().toISOString() },
    });
}

export async function getZernioConfig() {
  const apiKey =
    (await getSetting("zernio_api_key")) ?? process.env.ZERNIO_API_KEY ?? "";
  const accountId =
    (await getSetting("zernio_linkedin_account_id")) ??
    process.env.ZERNIO_LINKEDIN_ACCOUNT_ID ??
    "";
  return { apiKey, accountId };
}
