// src/app/api/analytics/route.ts
// GET /api/analytics — current user's business analytics
// FIX: All Date objects passed to sql`` must be .toISOString() strings

import { NextRequest, NextResponse } from "next/server";
import { getBusinessContext, withErrorHandling } from "@/lib/api";
import { db } from "@/db";
import { feedback, reviewRequests } from "@/db/schema";
import { eq, and, gte, sql, count, avg, desc } from "drizzle-orm";
import { subDays } from "date-fns";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") ?? "30");

  // ✅ FIX: convert Date → ISO string before interpolating into sql``
  const startDate = subDays(new Date(), days).toISOString();
  const prevStart = subDays(new Date(), days * 2).toISOString();
  const eightWeeksAgo = subDays(new Date(), 56).toISOString();

  const [
    totalRequests,
    totalReviews,
    totalPrivate,
    avgRating,
    ratingDist,
    weeklyTrend,
    channelStats,
    funnelStats,
  ] = await Promise.all([
    // Total requests in period — use Drizzle ORM (no raw sql needed)
    db
      .select({ count: count() })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.businessId, businessId),
          gte(reviewRequests.createdAt, new Date(startDate)),
        ),
      ),

    // Public reviews in period
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "public_review"),
          gte(feedback.submittedAt, new Date(startDate)),
        ),
      ),

    // Private feedback in period
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "private_feedback"),
          gte(feedback.submittedAt, new Date(startDate)),
        ),
      ),

    // Average rating all-time
    db
      .select({ avg: avg(feedback.rating) })
      .from(feedback)
      .where(eq(feedback.businessId, businessId)),

    // Rating distribution
    db
      .select({ rating: feedback.rating, count: count() })
      .from(feedback)
      .where(eq(feedback.businessId, businessId))
      .groupBy(feedback.rating)
      .orderBy(feedback.rating),

    // ✅ FIX: use string interpolation of ISO date, not Date object
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') AS week,
        COUNT(*) FILTER (WHERE type = 'public_review')::int AS "publicReviews",
        COUNT(*) FILTER (WHERE type = 'private_feedback')::int AS "privateFeedback"
      FROM feedback
      WHERE business_id = ${businessId}
        AND submitted_at >= ${eightWeeksAgo}::timestamptz
      GROUP BY DATE_TRUNC('week', submitted_at)
      ORDER BY DATE_TRUNC('week', submitted_at)
    `),

    // ✅ FIX: use string interpolation of ISO date, not Date object
    db.execute(sql`
      SELECT
        channel,
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE status IN ('clicked','opened','delivered'))::int AS clicked
      FROM review_requests
      WHERE business_id = ${businessId}
        AND created_at >= ${startDate}::timestamptz
      GROUP BY channel
    `),

    // Funnel stats (no dates — fine as-is)
    db.execute(sql`
      SELECT
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE status IN ('opened','clicked'))::int AS opened,
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'public_review')::int AS "publicReviews",
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'private_feedback')::int AS "privateFeedback"
      FROM review_requests
      WHERE business_id = ${businessId}
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
      ratingDistribution: [1, 2, 3, 4, 5].map((star) => {
        const found = ratingDist.find((r) => r.rating === star);
        const cnt = Number(found?.count ?? 0);
        return {
          rating: star,
          count: cnt,
          percentage:
            totalRatings > 0 ? Math.round((cnt / totalRatings) * 100) : 0,
        };
      }),
      weeklyTrend: weeklyTrend,
      channelStats: (channelStats as any[]).map((c) => ({
        channel: c.channel,
        sent: Number(c.sent),
        clicked: Number(c.clicked),
        conversionRate: c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0,
      })),
      funnel: funnelStats[0] ?? {
        sent: 0,
        opened: 0,
        publicReviews: 0,
        privateFeedback: 0,
      },
    },
  });
});
