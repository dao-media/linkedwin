import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "linkedwin_session";

function isProductionHost() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.FLY_APP_NAME)
  );
}

/** Password used for login + JWT signing. Null when unset in production. */
export function resolveAppPassword(): string | null {
  const configured = process.env.APP_PASSWORD?.trim();
  if (configured) return configured;
  if (isProductionHost()) return null;
  return "linkedwin";
}

function secret() {
  const s = resolveAppPassword();
  if (!s) {
    throw new Error("APP_PASSWORD must be set in production");
  }
  return new TextEncoder().encode(s.padEnd(32, "0").slice(0, 32));
}

export async function createSession() {
  const token = await new SignJWT({ role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAuthenticated() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export function checkPassword(input: string) {
  const expected = resolveAppPassword();
  if (!expected) return false;
  return input === expected;
}
