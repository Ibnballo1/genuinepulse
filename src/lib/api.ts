// src/lib/api.ts
// Shared API utilities — auth context, responses, pagination
// FIXED: requireAuth now works correctly in Node.js runtime API routes

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodSchema, ZodError } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  name?: string | null;
  role: "super_admin" | "business_owner" | "staff";
  businessId?: string | null;
  isSuspended?: boolean;
}

// ─── Core: get session from request ──────────────────────────────────────────
// Runs in Node.js runtime — postgres driver works fine here

export async function getApiUser(req: NextRequest): Promise<ApiUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });
    if (!session?.user) return null;
    return session.user as unknown as ApiUser;
  } catch (err) {
    console.error("[getApiUser] Session error:", err);
    return null;
  }
}

// ─── requireAuth ──────────────────────────────────────────────────────────────

export async function requireAuth(req: NextRequest): Promise<ApiUser> {
  const user = await getApiUser(req);
  if (!user) {
    throw NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  if (user.isSuspended) {
    throw NextResponse.json(
      { success: false, error: "Account suspended" },
      { status: 403 },
    );
  }
  return user;
}

// ─── requireRole ─────────────────────────────────────────────────────────────

export async function requireRole(
  req: NextRequest,
  role: "super_admin" | "business_owner" | "staff",
): Promise<ApiUser> {
  const user = await requireAuth(req);
  if (user.role !== "super_admin" && user.role !== role) {
    throw NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  return user;
}

// ─── requireSuperAdmin ───────────────────────────────────────────────────────

export async function requireSuperAdmin(req: NextRequest): Promise<ApiUser> {
  const user = await requireAuth(req);
  if (user.role !== "super_admin") {
    throw NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 },
    );
  }
  return user;
}

// ─── getBusinessContext ───────────────────────────────────────────────────────

export interface ApiContext {
  user: ApiUser;
  businessId: string;
}

export async function getBusinessContext(
  req: NextRequest,
): Promise<ApiContext> {
  const user = await requireAuth(req);

  // Super admins can target any business via query param or header
  let businessId: string | null | undefined;

  if (user.role === "super_admin") {
    businessId =
      new URL(req.url).searchParams.get("businessId") ??
      req.headers.get("x-target-business-id") ??
      user.businessId;
  } else {
    businessId = user.businessId;
  }

  if (!businessId) {
    throw NextResponse.json(
      {
        success: false,
        error:
          "No business linked to this account. Please complete onboarding.",
      },
      { status: 400 },
    );
  }

  return { user, businessId };
}

// ─── Response helpers ────────────────────────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): NextResponse {
  return NextResponse.json({
    success: true,
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  });
}

// ─── validateBody ────────────────────────────────────────────────────────────

export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw NextResponse.json(
      { success: false, error: "Invalid or missing JSON body" },
      { status: 400 },
    );
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  return result.data;
}

// ─── withErrorHandling ───────────────────────────────────────────────────────
// Wraps route handlers so thrown NextResponse objects (from requireAuth etc.)
// are returned directly, and unexpected errors become clean 500s

export function withErrorHandling(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err: any) {
      // requireAuth / requireSuperAdmin throw NextResponse directly
      if (err instanceof NextResponse) {
        return err;
      }
      // Also handle plain Response (edge cases)
      if (err instanceof Response) {
        return new NextResponse(err.body, {
          status: err.status,
          headers: err.headers,
        });
      }

      console.error(`[API Error] ${req.method} ${req.url}:`, err);

      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          ...(process.env.NODE_ENV === "development" && {
            message: err?.message,
          }),
        },
        { status: 500 },
      );
    }
  };
}

// ─── getPaginationParams ─────────────────────────────────────────────────────

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
