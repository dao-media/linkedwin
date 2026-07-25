import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "linkedwin_session";

function secret() {
  const s = process.env.APP_PASSWORD ?? "linkedwin-dev";
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
  const expected = process.env.APP_PASSWORD ?? "linkedwin";
  return input === expected;
}
