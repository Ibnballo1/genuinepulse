// src/app/api/analytics/route.ts
// GET /api/analytics — current user's business analytics (proxies to /businesses/[id]/analytics)

import { NextRequest, NextResponse } from "next/server";
import { getBusinessContext, withErrorHandling } from "@/lib/api";
import { db } from "@/db";
import { feedback, reviewRequests } from "@/db/schema";
import { eq, and, gte, sql, count, avg, desc } from "drizzle-orm";
import { subDays, format } from "date-fns";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30");
  const startDate = subDays(new Date(), days);

  const [
    totalRequests, totalReviews, totalPrivate, avgRating,
    ratingDist, weeklyTrend, channelStats, funnelStats,
  ] = await Promise.all([
    db.select({ count: count() }).from(reviewRequests)
      .where(and(eq(reviewRequests.businessId, businessId), gte(reviewRequests.createdAt, startDate))),

    db.select({ count: count() }).from(feedback)
      .where(and(eq(feedback.businessId, businessId), eq(feedback.type, "public_review"), gte(feedback.submittedAt, startDate))),

    db.select({ count: count() }).from(feedback)
      .where(and(eq(feedback.businessId, businessId), eq(feedback.type, "private_feedback"), gte(feedback.submittedAt, startDate))),

    db.select({ avg: avg(feedback.rating) }).from(feedback).where(eq(feedback.businessId, businessId)),

    db.select({ rating: feedback.rating, count: count() }).from(feedback)
      .where(eq(feedback.businessId, businessId))
      .groupBy(feedback.rating).orderBy(feedback.rating),

    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') AS week,
        COUNT(*) FILTER (WHERE type = 'public_review')::int AS "publicReviews",
        COUNT(*) FILTER (WHERE type = 'private_feedback')::int AS "privateFeedback"
      FROM feedback
      WHERE business_id = ${businessId} AND submitted_at >= ${subDays(new Date(), 56)}
      GROUP BY DATE_TRUNC('week', submitted_at)
      ORDER BY DATE_TRUNC('week', submitted_at)
    `),

    db.execute(sql`
      SELECT
        channel,
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE status IN ('clicked','opened','delivered'))::int AS clicked
      FROM review_requests
      WHERE business_id = ${businessId} AND created_at >= ${startDate}
      GROUP BY channel
    `),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE status IN ('opened','clicked'))::int AS opened,
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'public_review')::int AS "publicReviews",
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'private_feedback')::int AS "privateFeedback"
      FROM review_requests WHERE business_id = ${businessId}
    `),
  ]);

  const sent = Number(totalRequests[0]?.count ?? 0);
  const reviews = Number(totalReviews[0]?.count ?? 0);
  const totalRatings = ratingDist.reduce((s, r) => s + Number(r.count), 0);

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalRequestsSent: sent,
        totalPublicReviews: reviews,
        totalPrivateFeedback: Number(totalPrivate[0]?.count ?? 0),
        averageRating: parseFloat(Number(avgRating[0]?.avg ?? 0).toFixed(1)),
        conversionRate: sent > 0 ? Math.round((reviews / sent) * 100) : 0,
      },
      ratingDistribution: [1,2,3,4,5].map((star) => {
        const found = ratingDist.find((r) => r.rating === star);
        const cnt = Number(found?.count ?? 0);
        return { rating: star, count: cnt, percentage: totalRatings > 0 ? Math.round((cnt / totalRatings) * 100) : 0 };
      }),
      weeklyTrend: weeklyTrend.rows,
      channelStats: (channelStats.rows as any[]).map((c) => ({
        channel: c.channel,
        sent: Number(c.sent),
        clicked: Number(c.clicked),
        conversionRate: c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0,
      })),
      funnel: funnelStats.rows[0] ?? { sent: 0, opened: 0, publicReviews: 0, privateFeedback: 0 },
    },
  });
});
