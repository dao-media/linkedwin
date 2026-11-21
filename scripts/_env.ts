/**
 * Import first in every script: loads .env.local so the DB client points at the
 * same database as the app (Turso in production). In CI the file is absent and
 * secrets arrive as real env vars, which take precedence anyway.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}
