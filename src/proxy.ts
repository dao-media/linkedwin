import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = [
  "/login",
  "/api/login",
  "/api/health",
  "/api/cron",
  "/api/worker",
  "/api/media/file",
];

function secret() {
  const s = process.env.APP_PASSWORD ?? "linkedwin-dev";
  return new TextEncoder().encode(s.padEnd(32, "0").slice(0, 32));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Cron/worker use bearer secret
  if (pathname.startsWith("/api/cron") || pathname.startsWith("/api/worker")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("linkedwin_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
};
