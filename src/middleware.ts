// src/middleware.ts
// FIXED: Does NOT call auth.api.getSession() — that requires Node.js 'net'
// module which is unavailable in Edge runtime.
//
// Strategy:
//   1. Public routes → pass through with no check
//   2. API routes    → pass through (Node.js runtime validates session inside route)
//   3. Page routes   → check cookie presence only; redirect if absent
//
// Full session validation happens inside:
//   - API routes:         requireAuth(req) in src/lib/api.ts  [Node.js runtime]
//   - Server components:  auth.api.getSession(...)            [Node.js runtime]

import { NextRequest, NextResponse } from "next/server";

// ─── Exact public page paths ──────────────────────────────────────────────────

const PUBLIC_PAGES = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/suspended",
]);

// ─── Path prefixes that are always public ─────────────────────────────────────

const PUBLIC_PREFIXES = [
  "/api/auth", // BetterAuth — handles its own auth
  "/api/funnel", // Public funnel — no login needed
  "/api/webhooks", // Twilio / Resend delivery webhooks
  "/r/", // Customer-facing review pages
  "/_next/",
  "/favicon",
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function isPublic(pathname: string): boolean {
  const p =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;
  if (PUBLIC_PAGES.has(p)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow public routes
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 2. Always let ALL /api/* routes reach their Node.js handlers.
  //    requireAuth() inside each handler does the real validation.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 3. For page routes, verify a BetterAuth session cookie is present.
  //    cookiePrefix = "gp"  →  cookie name = "gp.session_token"
  //    On HTTPS Next.js may prefix with "__Secure-".
  const cookieNames = [
    "gp.session_token",
    "__Secure-gp.session_token",
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
  ];

  const hasSession = cookieNames.some(
    (name) => request.cookies.get(name) !== undefined,
  );

  if (!hasSession) {
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
