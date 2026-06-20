// src/app/api/admin/overview/route.ts
// GET /api/admin/overview — super admin system metrics (super_admin only)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  users,
  businesses,
  reviewRequests,
  feedback,
  subscriptions,
  messageLogs,
} from "@/db/schema";
import { eq, sql, count, gte, desc } from "drizzle-orm";
import { requireSuperAdmin, withErrorHandling } from "@/lib/api";
import { subDays } from "date-fns";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireSuperAdmin(req);

  const thirtyDaysAgo = subDays(new Date(), 30);

  const [
    totalUsers,
    totalBusinesses,
    activeBusinesses,
    totalRequests,
    totalReviews,
    planBreakdown,
    recentFailedMessages,
    topBusinesses,
    systemRevenue,
  ] = await Promise.all([
    // Total users
    db.select({ count: count() }).from(users),

    // Total businesses
    db.select({ count: count() }).from(businesses),

    // Active businesses
    db
      .select({ count: count() })
      .from(businesses)
      .where(eq(businesses.isActive, true)),

    // Total messages sent (30 days)
    db
      .select({ count: count() })
      .from(reviewRequests)
      .where(gte(reviewRequests.createdAt, thirtyDaysAgo)),

    // Total public reviews (30 days)
    db
      .select({ count: count() })
      .from(feedback)
      .where(sql`type = 'public_review' AND submitted_at >= ${thirtyDaysAgo}`),

    // Plan breakdown
    db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        count: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status),

    // Recent failed messages
    db.query.messageLogs.findMany({
      where: eq(messageLogs.status, "failed"),
      orderBy: [desc(messageLogs.createdAt)],
      limit: 20,
    }),

    // Top performing businesses
    db.execute(sql`
      SELECT
        b.id,
        b.name,
        b.industry,
        COUNT(DISTINCT rr.id) AS requests_sent,
        COUNT(DISTINCT f.id) FILTER (WHERE f.type = 'public_review') AS reviews,
        ROUND(AVG(f.rating)::numeric, 1) AS avg_rating
      FROM businesses b
      LEFT JOIN review_requests rr ON rr.business_id = b.id
        AND rr.created_at >= ${thirtyDaysAgo}
      LEFT JOIN feedback f ON f.business_id = b.id
      GROUP BY b.id, b.name, b.industry
      ORDER BY reviews DESC NULLS LAST
      LIMIT 10
    `),

    // Revenue estimate (MRR)
    db.execute(sql`
      SELECT
        SUM(CASE
          WHEN plan = 'enterprise' THEN 299
          WHEN plan = 'pro' THEN 149
          ELSE 49
        END) AS mrr,
        COUNT(*) AS active_count
      FROM subscriptions
      WHERE status IN ('active', 'trialing')
    `),
  ]);

  // ─── MRR breakdown ────────────────────────────────────────────────────
  const planRevenue = planBreakdown
    .filter((p) => ["active", "trialing"].includes(p.status))
    .reduce(
      (acc, row) => {
        const price =
          row.plan === "enterprise" ? 299 : row.plan === "pro" ? 149 : 49;
        acc[row.plan] = (acc[row.plan] ?? 0) + Number(row.count) * price;
        return acc;
      },
      {} as Record<string, number>,
    );

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalUsers: Number(totalUsers[0]?.count ?? 0),
        totalBusinesses: Number(totalBusinesses[0]?.count ?? 0),
        activeBusinesses: Number(activeBusinesses[0]?.count ?? 0),
        totalRequestsSent30d: Number(totalRequests[0]?.count ?? 0),
        totalReviews30d: Number(totalReviews[0]?.count ?? 0),
        mrr: Number((systemRevenue.rows[0] as any)?.mrr ?? 0),
      },
      planBreakdown,
      planRevenue,
      recentFailedMessages,
      topBusinesses: topBusinesses.rows,
    },
  });
});
