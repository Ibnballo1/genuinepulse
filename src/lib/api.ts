// src/lib/api.ts
// Shared API utilities — auth context, responses, pagination

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ZodSchema, ZodError } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string;
  email: string;
  name?: string;
  role: "super_admin" | "business_owner" | "staff";
  businessId?: string;
}

export interface ApiContext {
  user: ApiUser;
  businessId: string;
}

// ─── Get current user from request ───────────────────────────────────────────

export async function getApiUser(req: NextRequest): Promise<ApiUser | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) return null;
    return session.user as ApiUser;
  } catch {
    return null;
  }
}

// ─── Require authenticated user (throws 401 response) ─────────────────────

export async function requireAuth(req: NextRequest): Promise<ApiUser> {
  const user = await getApiUser(req);
  if (!user) {
    throw apiError("Unauthorized", 401);
  }
  if ((user as any).isSuspended) {
    throw apiError("Account suspended", 403);
  }
  return user;
}

// ─── Require specific role ────────────────────────────────────────────────────

export async function requireRole(
  req: NextRequest,
  role: "super_admin" | "business_owner" | "staff"
): Promise<ApiUser> {
  const user = await requireAuth(req);
  if (user.role !== role && user.role !== "super_admin") {
    throw apiError("Forbidden", 403);
  }
  return user;
}

// ─── Require super admin ──────────────────────────────────────────────────────

export async function requireSuperAdmin(req: NextRequest): Promise<ApiUser> {
  return requireRole(req, "super_admin");
}

// ─── Get business context (user + their business) ────────────────────────────

export async function getBusinessContext(
  req: NextRequest
): Promise<ApiContext> {
  const user = await requireAuth(req);

  // Super admin can target any business via header or query param
  const businessId =
    user.role === "super_admin"
      ? (req.headers.get("x-target-business-id") ??
        new URL(req.url).searchParams.get("businessId") ??
        user.businessId)
      : user.businessId;

  if (!businessId) {
    throw apiError("Business not configured for this account", 400);
  }

  return { user, businessId };
}

// ─── Standard error constructor ───────────────────────────────────────────────

export function apiError(message: string, status: number): Response {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  ) as unknown as Response;
}

// ─── Standard success response ────────────────────────────────────────────────

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

// ─── Paginated response ───────────────────────────────────────────────────────

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
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

// ─── Validate request body with Zod ──────────────────────────────────────────

export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw apiError("Invalid JSON body", 400);
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: result.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  return result.data;
}

// ─── API route wrapper with automatic error handling ─────────────────────────

export function withErrorHandling(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx?: any): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (err: any) {
      // If it's already a Response (thrown from requireAuth, etc.), return it
      if (err instanceof Response || err instanceof NextResponse) {
        return err as NextResponse;
      }

      console.error(`[API Error] ${req.method} ${req.url}:`, err);

      return NextResponse.json(
        {
          success: false,
          error: "Internal server error",
          ...(process.env.NODE_ENV === "development" && {
            message: err.message,
            stack: err.stack,
          }),
        },
        { status: 500 }
      );
    }
  };
}

// ─── Pagination helpers ───────────────────────────────────────────────────────

export function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
