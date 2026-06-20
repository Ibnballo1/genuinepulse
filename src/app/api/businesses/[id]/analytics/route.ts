// src/app/api/businesses/[id]/analytics/route.ts
// GET /api/businesses/[id]/analytics — dashboard metrics + chart data

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feedback, reviewRequests, customers, messageLogs } from "@/db/schema";
import { eq, and, gte, lte, sql, count, avg, desc } from "drizzle-orm";
import { getBusinessContext, withErrorHandling } from "@/lib/api";
import { subDays, startOfDay, format, eachWeekOfInterval } from "date-fns";

export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user, businessId } = await getBusinessContext(req);

    // Only allow access to own business (unless super admin)
    const targetId = user.role === "super_admin" ? params.id : businessId;

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "30");
    const startDate = startOfDay(subDays(new Date(), days));

    // ─── Parallel data fetch ─────────────────────────────────────────────
    const [
      totalRequests,
      totalReviews,
      totalPrivateFeedback,
      avgRating,
      ratingDist,
      weeklyData,
      channelStats,
      recentFeedback,
    ] = await Promise.all([
      // Total requests in period
      db
        .select({ count: count() })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.businessId, targetId),
            gte(reviewRequests.createdAt, startDate)
          )
        ),

      // Public reviews in period
      db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.businessId, targetId),
            eq(feedback.type, "public_review"),
            gte(feedback.submittedAt, startDate)
          )
        ),

      // Private feedback in period
      db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.businessId, targetId),
            eq(feedback.type, "private_feedback"),
            gte(feedback.submittedAt, startDate)
          )
        ),

      // Average rating all time
      db
        .select({ avg: avg(feedback.rating) })
        .from(feedback)
        .where(eq(feedback.businessId, targetId)),

      // Rating distribution
      db
        .select({
          rating: feedback.rating,
          count: count(),
        })
        .from(feedback)
        .where(eq(feedback.businessId, targetId))
        .groupBy(feedback.rating)
        .orderBy(feedback.rating),

      // Weekly review counts (last 8 weeks)
      db.execute(sql`
        SELECT
          DATE_TRUNC('week', submitted_at) AS week,
          COUNT(*) FILTER (WHERE type = 'public_review') AS public_reviews,
          COUNT(*) FILTER (WHERE type = 'private_feedback') AS private_feedback,
          COUNT(*) FILTER (WHERE rating >= 4) AS positive,
          COUNT(*) FILTER (WHERE rating <= 3) AS negative
        FROM feedback
        WHERE
          business_id = ${targetId}
          AND submitted_at >= ${subDays(new Date(), 56)}
        GROUP BY 1
        ORDER BY 1
      `),

      // Channel breakdown
      db
        .select({
          channel: reviewRequests.channel,
          sent: count(),
          clicked: sql<number>`COUNT(*) FILTER (WHERE status IN ('clicked', 'opened'))`,
        })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.businessId, targetId),
            gte(reviewRequests.createdAt, startDate)
          )
        )
        .groupBy(reviewRequests.channel),

      // Recent feedback items
      db.query.feedback.findMany({
        where: and(
          eq(feedback.businessId, targetId),
          gte(feedback.submittedAt, startDate)
        ),
        with: { customer: true },
        orderBy: [desc(feedback.submittedAt)],
        limit: 5,
      }),
    ]);

    // ─── Compute conversion rate ─────────────────────────────────────────
    const sent = Number(totalRequests[0]?.count ?? 0);
    const reviews = Number(totalReviews[0]?.count ?? 0);
    const conversionRate = sent > 0 ? Math.round((reviews / sent) * 100) : 0;

    // ─── Format rating distribution ──────────────────────────────────────
    const ratingDistFormatted = [1, 2, 3, 4, 5].map((star) => {
      const found = ratingDist.find((r) => r.rating === star);
      return { rating: star, count: Number(found?.count ?? 0) };
    });

    const totalRatings = ratingDistFormatted.reduce(
      (s, r) => s + r.count,
      0
    );

    const ratingDistWithPct = ratingDistFormatted.map((r) => ({
      ...r,
      percentage:
        totalRatings > 0 ? Math.round((r.count / totalRatings) * 100) : 0,
    }));

    // ─── Funnel stats ────────────────────────────────────────────────────
    const opened = sent > 0
      ? await db
          .select({ count: count() })
          .from(reviewRequests)
          .where(
            and(
              eq(reviewRequests.businessId, targetId),
              eq(reviewRequests.status, "opened"),
              gte(reviewRequests.createdAt, startDate)
            )
          )
      : [{ count: 0 }];

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRequestsSent: sent,
          totalPublicReviews: reviews,
          totalPrivateFeedback: Number(totalPrivateFeedback[0]?.count ?? 0),
          averageRating: parseFloat(
            Number(avgRating[0]?.avg ?? 0).toFixed(1)
          ),
          conversionRate,
        },
        funnel: {
          sent,
          opened: Number(opened[0]?.count ?? 0),
          reviews,
          privateFeedback: Number(totalPrivateFeedback[0]?.count ?? 0),
        },
        ratingDistribution: ratingDistWithPct,
        weeklyTrend: weeklyData.rows.map((r: any) => ({
          week: format(new Date(r.week), "MMM d"),
          publicReviews: Number(r.public_reviews),
          privateFeedback: Number(r.private_feedback),
          positive: Number(r.positive),
          negative: Number(r.negative),
        })),
        channelStats: channelStats.map((c) => ({
          channel: c.channel,
          sent: Number(c.sent),
          clicked: Number(c.clicked),
          conversionRate:
            Number(c.sent) > 0
              ? Math.round((Number(c.clicked) / Number(c.sent)) * 100)
              : 0,
        })),
        recentFeedback,
      },
    });
  }
);
