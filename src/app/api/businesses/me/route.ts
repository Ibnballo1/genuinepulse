// src/app/api/businesses/me/route.ts
// GET   /api/businesses/me — current user's business
// PATCH /api/businesses/me — update settings

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  validateBody,
  apiSuccess,
} from "@/lib/api";
import { updateBusinessSchema } from "@/lib/validations";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const biz = await db.query.businesses.findFirst({
    where: eq(businesses.id, businessId),
    with: { subscription: true },
  });
  if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return apiSuccess(biz);
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const body = await validateBody(req, updateBusinessSchema);

  const [updated] = await db
    .update(businesses)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(businesses.id, businessId))
    .returning();

  return apiSuccess(updated);
});
