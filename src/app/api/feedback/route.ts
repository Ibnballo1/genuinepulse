// src/app/api/feedback/route.ts
// GET /api/feedback — list all feedback for a business (filtered)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  paginatedResponse,
  getPaginationParams,
} from "@/lib/api";
import { feedbackQuerySchema } from "@/lib/validations";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);

  const query = feedbackQuerySchema.safeParse({
    type: searchParams.get("type") ?? undefined,
    minRating: searchParams.get("minRating") ?? undefined,
    maxRating: searchParams.get("maxRating") ?? undefined,
    isResolved: searchParams.get("isResolved") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    page,
    limit,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query params" },
      { status: 422 },
    );
  }

  const q = query.data;
  const conditions: any[] = [eq(feedback.businessId, businessId)];

  if (q.type && q.type !== "all") conditions.push(eq(feedback.type, q.type));
  if (q.minRating !== undefined)
    conditions.push(gte(feedback.rating, q.minRating));
  if (q.maxRating !== undefined)
    conditions.push(lte(feedback.rating, q.maxRating));
  if (q.isResolved !== undefined)
    conditions.push(eq(feedback.isResolved, q.isResolved));
  if (q.startDate) conditions.push(gte(feedback.submittedAt, q.startDate));
  if (q.endDate) conditions.push(lte(feedback.submittedAt, q.endDate));

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(feedback)
    .where(where);

  const rows = await db.query.feedback.findMany({
    where,
    with: { customer: true, reviewRequest: true },
    orderBy: [desc(feedback.submittedAt)],
    limit: q.limit,
    offset: (q.page - 1) * q.limit,
  });

  return paginatedResponse(rows, Number(total), q.page, q.limit);
});
