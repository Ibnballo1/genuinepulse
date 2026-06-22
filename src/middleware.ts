// src/middleware.ts
// FIXED: Do NOT call auth.api.getSession() here — the postgres driver
// uses Node.js 'net' module which is unavailable in the Edge runtime.
// Instead: check for the session cookie presence only. The actual session
// validation happens inside each API route / server component in Node runtime.

import { NextRequest, NextResponse } from "next/server";

// ─── Route classification ─────────────────────────────────────────────────────

// Fully public — no cookie check at all
const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/suspended",
];

// Public by prefix
const PUBLIC_PREFIXES = [
  "/api/auth", // BetterAuth endpoints
  "/api/funnel", // Review funnel (no auth needed)
  "/api/webhooks", // Twilio / Resend webhooks
  "/r/", // Public review funnel pages
  "/_next", // Next.js internals
  "/favicon",
  "/public",
];

// These need Node runtime — skip Edge entirely (handled by Next.js route config)
const API_PREFIXES = ["/api/"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p + "/"))) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes through without any check
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // For all other routes, check that a session cookie exists.
  // BetterAuth sets a cookie prefixed with "gp." (configured in auth.ts).
  // We cannot validate the cookie here (no Node.js), but its absence
  // means the user is definitely not logged in → redirect to sign-in.
  const sessionCookie =
    request.cookies.get("gp.session_token") ?? // BetterAuth default name
    request.cookies.get("better-auth.session_token") ?? // fallback name
    request.cookies.get("__Secure-better-auth.session_token"); // HTTPS variant

  if (!sessionCookie) {
    const loginUrl = new URL("/sign-in", request.url);
    // Preserve the intended destination
    if (!pathname.startsWith("/api/")) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    // For API routes return 401 instead of redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — let the request through.
  // Real session validation + RBAC happens in:
  //   - Server components: auth.api.getSession({ headers: headers() })
  //   - API routes: requireAuth(req) from @/lib/api
  // Both run in Node.js runtime where postgres works fine.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static  (static assets)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
