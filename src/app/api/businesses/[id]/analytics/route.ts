// src/app/api/businesses/[id]/analytics/route.ts
// FIX: All Date objects → .toISOString() before interpolating into sql`` tags

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feedback, reviewRequests } from "@/db/schema";
import { eq, and, gte, sql, count, avg, desc } from "drizzle-orm";
import { getBusinessContext, withErrorHandling } from "@/lib/api";
import { subDays } from "date-fns";

export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user, businessId } = await getBusinessContext(req);
    const targetId = user.role === "super_admin" ? params.id : businessId;

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "30");

    // ✅ FIX: always use .toISOString() for sql`` interpolation
    const startDate = subDays(new Date(), days);
    const prevStart = subDays(new Date(), days * 2);
    const eightWeeksAgo = subDays(new Date(), 56);

    const startIso = startDate.toISOString();
    const prevStartIso = prevStart.toISOString();
    const eightWeeksIso = eightWeeksAgo.toISOString();

    const [
      totalRequests,
      prevRequests,
      totalReviews,
      prevReviews,
      totalPrivateFeedback,
      prevPrivate,
      avgRating,
      ratingDist,
      weeklyData,
      channelStats,
      recentFeedback,
    ] = await Promise.all([
      // Drizzle ORM helpers handle Date objects fine — only sql`` needs strings
      db
        .select({ count: count() })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.businessId, targetId),
            gte(reviewRequests.createdAt, startDate),
          ),
        ),

      db
        .select({ count: count() })
        .from(reviewRequests)
        .where(
          and(
            eq(reviewRequests.businessId, targetId),
            gte(reviewRequests.createdAt, prevStart),
            sql`created_at < ${startIso}::timestamptz`,
          ),
        ),

      db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.businessId, targetId),
            eq(feedback.type, "public_review"),
            gte(feedback.submittedAt, startDate),
          ),
        ),

      db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.businessId, targetId),
            eq(feedback.type, "public_review"),
            gte(feedback.submittedAt, prevStart),
            sql`submitted_at < ${startIso}::timestamptz`,
          ),
        ),

      db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.businessId, targetId),
            eq(feedback.type, "private_feedback"),
            gte(feedback.submittedAt, startDate),
          ),
        ),

      db
        .select({ count: count() })
        .from(feedback)
        .where(
          and(
            eq(feedback.businessId, targetId),
            eq(feedback.type, "private_feedback"),
            gte(feedback.submittedAt, prevStart),
            sql`submitted_at < ${startIso}::timestamptz`,
          ),
        ),

      db
        .select({ avg: avg(feedback.rating) })
        .from(feedback)
        .where(eq(feedback.businessId, targetId)),

      db
        .select({ rating: feedback.rating, count: count() })
        .from(feedback)
        .where(eq(feedback.businessId, targetId))
        .groupBy(feedback.rating)
        .orderBy(feedback.rating),

      // ✅ FIX: ISO string in sql`` template
      db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') AS week,
          COUNT(*) FILTER (WHERE type = 'public_review')::int  AS "publicReviews",
          COUNT(*) FILTER (WHERE type = 'private_feedback')::int AS "privateFeedback",
          COUNT(*) FILTER (WHERE rating >= 4)::int AS positive,
          COUNT(*) FILTER (WHERE rating <= 3)::int AS negative
        FROM feedback
        WHERE business_id = ${targetId}
          AND submitted_at >= ${eightWeeksIso}::timestamptz
        GROUP BY DATE_TRUNC('week', submitted_at)
        ORDER BY DATE_TRUNC('week', submitted_at)
      `),

      // ✅ FIX: ISO string in sql`` template
      db.execute(sql`
        SELECT
          channel,
          COUNT(*)::int AS sent,
          COUNT(*) FILTER (WHERE status IN ('clicked','opened','delivered'))::int AS clicked
        FROM review_requests
        WHERE business_id = ${targetId}
          AND created_at >= ${startIso}::timestamptz
        GROUP BY channel
      `),

      db.query.feedback.findMany({
        where: and(
          eq(feedback.businessId, targetId),
          gte(feedback.submittedAt, startDate),
        ),
        with: { customer: true },
        orderBy: [desc(feedback.submittedAt)],
        limit: 5,
      }),
    ]);

    function pctChange(curr: number, prev: number) {
      if (prev === 0) return null;
      return Math.round(((curr - prev) / prev) * 100);
    }

    const sent = Number(totalRequests[0]?.count ?? 0);
    const reviews = Number(totalReviews[0]?.count ?? 0);

    const totalRatings = ratingDist.reduce((s, r) => s + Number(r.count), 0);
    const ratingDistFormatted = [1, 2, 3, 4, 5].map((star) => {
      const found = ratingDist.find((r) => r.rating === star);
      const cnt = Number(found?.count ?? 0);
      return {
        rating: star,
        count: cnt,
        percentage:
          totalRatings > 0 ? Math.round((cnt / totalRatings) * 100) : 0,
      };
    });

    // Funnel opened count
    const [openedResult] = await db
      .select({ count: count() })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.businessId, targetId),
          sql`status IN ('opened','clicked')`,
          gte(reviewRequests.createdAt, startDate),
        ),
      );

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRequestsSent: sent,
          totalPublicReviews: reviews,
          totalPrivateFeedback: Number(totalPrivateFeedback[0]?.count ?? 0),
          averageRating: parseFloat(Number(avgRating[0]?.avg ?? 0).toFixed(1)),
          conversionRate: sent > 0 ? Math.round((reviews / sent) * 100) : 0,
          requestsChange: pctChange(sent, Number(prevRequests[0]?.count ?? 0)),
          reviewsChange: pctChange(reviews, Number(prevReviews[0]?.count ?? 0)),
          privateFbChange: pctChange(
            Number(totalPrivateFeedback[0]?.count ?? 0),
            Number(prevPrivate[0]?.count ?? 0),
          ),
        },
        funnel: {
          sent,
          opened: Number(openedResult?.count ?? 0),
          reviews,
          privateFeedback: Number(totalPrivateFeedback[0]?.count ?? 0),
        },
        ratingDistribution: ratingDistFormatted,
        weeklyTrend: weeklyData,
        channelStats: (channelStats as any[]).map((c) => ({
          channel: c.channel,
          sent: Number(c.sent),
          clicked: Number(c.clicked),
          conversionRate:
            c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0,
        })),
        recentFeedback,
      },
    });
  },
);
