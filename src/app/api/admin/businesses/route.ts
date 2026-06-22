// src/app/api/admin/businesses/route.ts
// GET  /api/admin/businesses — list all tenants with stats
// super_admin only

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  businesses,
  subscriptions,
  users,
  reviewRequests,
  feedback,
} from "@/db/schema";
import { eq, desc, count, sql, ilike, and } from "drizzle-orm";
import {
  requireSuperAdmin,
  withErrorHandling,
  paginatedResponse,
  getPaginationParams,
} from "@/lib/api";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireSuperAdmin(req);

  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);
  const search = searchParams.get("search");
  const plan = searchParams.get("plan");
  const status = searchParams.get("status");

  const conditions: any[] = [];
  if (search) conditions.push(ilike(businesses.name, `%${search}%`));

  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(businesses)
    .where(where);

  const rows = await db.execute(sql`
    SELECT
      b.*,
      s.plan,
      s.status AS subscription_status,
      s.monthly_sms_limit,
      s.monthly_email_limit,
      s.sms_sent_this_period,
      s.email_sent_this_period,
      COUNT(DISTINCT c.id)::int AS customer_count,
      COUNT(DISTINCT rr.id)::int AS requests_sent,
      COUNT(DISTINCT f.id) FILTER (WHERE f.type = 'public_review')::int AS reviews_generated
    FROM businesses b
    LEFT JOIN subscriptions s ON s.business_id = b.id
    LEFT JOIN customers c ON c.business_id = b.id
    LEFT JOIN review_requests rr ON rr.business_id = b.id
    LEFT JOIN feedback f ON f.business_id = b.id
    WHERE ${search ? sql`b.name ILIKE ${"%" + search + "%"}` : sql`TRUE`}
    ${plan ? sql`AND s.plan = ${plan}` : sql``}
    GROUP BY b.id, s.plan, s.status, s.monthly_sms_limit, s.monthly_email_limit,
             s.sms_sent_this_period, s.email_sent_this_period
    ORDER BY b.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return paginatedResponse(rows, Number(total), page, limit);
});
