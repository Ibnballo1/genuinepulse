// src/app/dashboard/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { feedback, reviewRequests } from "@/db/schema";
import { eq, and, gte, desc, count, avg, sql } from "drizzle-orm";
import { subDays } from "date-fns";
import StatCard from "@/components/dashboard/StatCard";
import ReviewTrendChart from "@/components/dashboard/ReviewTrendChart";
import RatingDistributionChart from "@/components/dashboard/RatingDistributionChart";
import RecentRequestsTable from "@/components/dashboard/RecentRequestsTable";
import FunnelSummary from "@/components/dashboard/FunnelSummary";
import { TrendingUp, Star, MessageSquare, Send } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session) redirect("/sign-in");

  const user = session.user as any;
  const businessId = user.businessId;

  if (!businessId) redirect("/onboarding");

  // Use Date objects for Drizzle timestamp comparisons
  const thirtyDaysAgo = subDays(new Date(), 30);
  const prevPeriodStart = subDays(new Date(), 60);

  // ─── Fetch all dashboard data in parallel ─────────────────────────────
  const [
    currentRequests,
    prevRequests,
    currentReviews,
    prevReviews,
    currentPrivate,
    prevPrivate,
    avgRatingResult,
    ratingDist,
    weeklyTrendResult,
    recentRequests,
    funnelStatsResult,
  ] = await Promise.all([
    // Current period requests
    db
      .select({ count: count() })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.businessId, businessId),
          gte(reviewRequests.createdAt, thirtyDaysAgo),
        ),
      ),

    // Prev period requests
    db
      .select({ count: count() })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.businessId, businessId),
          gte(reviewRequests.createdAt, prevPeriodStart),
          sql`created_at < ${thirtyDaysAgo}`,
        ),
      ),

    // Current public reviews
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "public_review"),
          gte(feedback.submittedAt, thirtyDaysAgo),
        ),
      ),

    // Prev public reviews
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "public_review"),
          gte(feedback.submittedAt, prevPeriodStart),
          sql`submitted_at < ${thirtyDaysAgo}`,
        ),
      ),

    // Current private feedback
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "private_feedback"),
          gte(feedback.submittedAt, thirtyDaysAgo),
        ),
      ),

    // Prev private feedback
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "private_feedback"),
          gte(feedback.submittedAt, prevPeriodStart),
          sql`submitted_at < ${thirtyDaysAgo}`,
        ),
      ),

    // Average rating
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

    // Weekly trend (8 weeks)
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') AS week,
        COUNT(*) FILTER (WHERE type = 'public_review')::int AS five_star,
        COUNT(*) FILTER (WHERE type = 'private_feedback')::int AS four_star
      FROM feedback
      WHERE business_id = ${businessId}
        AND submitted_at >= NOW() - INTERVAL '56 days'
      GROUP BY DATE_TRUNC('week', submitted_at)
      ORDER BY DATE_TRUNC('week', submitted_at)
    `),

    // Recent review requests
    db.query.reviewRequests.findMany({
      where: eq(reviewRequests.businessId, businessId),
      with: { customer: true },
      orderBy: [desc(reviewRequests.createdAt)],
      limit: 8,
    }),

    // Funnel stats
    db.execute(sql`
      SELECT
        COUNT(*) AS sent,
        COUNT(*) FILTER (WHERE status IN ('opened','clicked','delivered'))::int AS opened,
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'public_review')::int AS public_reviews,
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'private_feedback')::int AS private_feedback
      FROM review_requests
      WHERE business_id = ${businessId}
    `),
  ]);

  // ─── Compute change percentages ────────────────────────────────────────
  function pctChange(current: number, prev: number): number | null {
    if (prev === 0) return null;
    return Math.round(((current - prev) / prev) * 100);
  }

  const reqCount = Number(currentRequests[0]?.count ?? 0);
  const revCount = Number(currentReviews[0]?.count ?? 0);
  const privCount = Number(currentPrivate[0]?.count ?? 0);
  const avgRating = parseFloat(Number(avgRatingResult[0]?.avg ?? 0).toFixed(1));

  // Extract raw rows from db.execute result sets (drizzle may return arrays directly)
  const weeklyTrend = (weeklyTrendResult ?? []) as any[];
  const funnel = ((Array.isArray(funnelStatsResult)
    ? funnelStatsResult[0]
    : funnelStatsResult) ?? {}) as any;

  // Rating distribution for pie chart
  const totalRatings = ratingDist.reduce((s, r) => s + Number(r.count), 0);
  const ratingData = [1, 2, 3, 4, 5].map((star) => {
    const found = ratingDist.find((r) => r.rating === star);
    const cnt = Number(found?.count ?? 0);
    return {
      rating: star,
      count: cnt,
      pct: totalRatings > 0 ? Math.round((cnt / totalRatings) * 100) : 0,
    };
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* ─── Stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests Sent"
          value={reqCount.toLocaleString()}
          change={pctChange(reqCount, Number(prevRequests[0]?.count ?? 0))}
          icon={<Send size={16} className="text-blue-600" />}
          iconBg="bg-blue-50"
          period="vs last 30 days"
        />
        <StatCard
          label="Reviews Generated"
          value={revCount.toLocaleString()}
          change={pctChange(revCount, Number(prevReviews[0]?.count ?? 0))}
          icon={<Star size={16} className="text-emerald-600" />}
          iconBg="bg-emerald-50"
          period="vs last 30 days"
        />
        <StatCard
          label="Private Feedback"
          value={privCount.toLocaleString()}
          change={pctChange(privCount, Number(prevPrivate[0]?.count ?? 0))}
          changeInvert
          icon={<MessageSquare size={16} className="text-amber-600" />}
          iconBg="bg-amber-50"
          period="vs last 30 days"
        />
        <StatCard
          label="Average Rating"
          value={avgRating.toFixed(1)}
          suffix="/ 5.0"
          icon={<TrendingUp size={16} className="text-violet-600" />}
          iconBg="bg-violet-50"
        />
      </div>

      {/* ─── Charts row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ReviewTrendChart data={weeklyTrend} />
        </div>
        <div>
          <RatingDistributionChart data={ratingData} />
        </div>
      </div>

      {/* ─── Table + funnel ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RecentRequestsTable requests={recentRequests as any[]} />
        </div>
        <div>
          <FunnelSummary
            sent={Number(funnel?.sent ?? 0)}
            opened={Number(funnel?.opened ?? 0)}
            publicReviews={Number(funnel?.public_reviews ?? 0)}
            privateFeedback={Number(funnel?.private_feedback ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}
