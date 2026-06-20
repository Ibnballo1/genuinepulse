// src/middleware.ts
// Next.js edge middleware — auth guard + RBAC enforcement

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

// Routes accessible only to super admins
const ADMIN_ONLY_ROUTES = ["/admin", "/api/admin"];

// Public API routes (funnel links, webhooks)
const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/funnel",
  "/api/webhooks",
  "/r/", // review funnel pages
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Allow public routes ────────────────────────────────────────────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // ─── Get session ────────────────────────────────────────────────────────
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // ─── Redirect unauthenticated users ─────────────────────────────────────
  if (!session) {
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = session.user as any;

  // ─── Block suspended users ───────────────────────────────────────────────
  if (user.isSuspended) {
    const suspendedUrl = new URL("/suspended", request.url);
    return NextResponse.redirect(suspendedUrl);
  }

  // ─── RBAC: admin-only routes ─────────────────────────────────────────────
  if (isAdminRoute(pathname) && user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ─── Inject user headers for downstream use ──────────────────────────────
  const headers = new Headers(request.headers);
  headers.set("x-user-id", user.id);
  headers.set("x-user-role", user.role ?? "business_owner");
  headers.set("x-business-id", user.businessId ?? "");

  return NextResponse.next({ request: { headers } });
}

// ─── Route matching helpers ──────────────────────────────────────────────────

function isPublicRoute(pathname: string): boolean {
  if (
    PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
  ) {
    return true;
  }
  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return true;
  }
  return false;
}

function isAdminRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
