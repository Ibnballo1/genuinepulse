// src/app/dashboard/page.tsx  (server component)
// FIX: Every Date passed to sql`` or gte() now uses new Date(isoString)
// so Drizzle never receives a raw Date inside sql template tags

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { feedback, reviewRequests } from "@/db/schema";
import { eq, and, gte, sql, count, avg, desc } from "drizzle-orm";
import { subDays } from "date-fns";
// Dashboard client components
import StatCard from "@/components/dashboard/StatCard";
import ReviewTrendChart from "@/components/dashboard/ReviewTrendChart";
import RatingDistributionChart from "@/components/dashboard/RatingDistributionChart";
import RecentRequestsTable from "@/components/dashboard/RecentRequestsTable";
import FunnelSummary from "@/components/dashboard/FunnelSummary";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: headers() });
  if (!session?.user) redirect("/sign-in");

  const user = session.user as any;
  const businessId: string | undefined = user.businessId;

  if (!businessId) redirect("/onboarding");

  // ✅ FIX: produce ISO strings once, reuse everywhere
  const now = new Date();
  const startDate = subDays(now, 30);
  const prevStart = subDays(now, 60);
  const eightWeeksAgo = subDays(now, 56);

  // Use plain Date objects with Drizzle ORM helpers (gte handles Date fine)
  // Only raw sql`` interpolation requires ISO strings
  const startIso = startDate.toISOString();
  const prevStartIso = prevStart.toISOString();
  const eightWeeksIso = eightWeeksAgo.toISOString();

  const [
    currentRequests,
    prevRequests,
    currentReviews,
    prevReviews,
    currentPrivate,
    prevPrivate,
    avgRatingResult,
    ratingDist,
    weeklyTrend,
    recentRequests,
    funnelStats,
  ] = await Promise.all([
    // Current period request count
    db
      .select({ count: count() })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.businessId, businessId),
          gte(reviewRequests.createdAt, startDate),
        ),
      ),

    // Previous period request count (for % change)
    db
      .select({ count: count() })
      .from(reviewRequests)
      .where(
        and(
          eq(reviewRequests.businessId, businessId),
          gte(reviewRequests.createdAt, prevStart),
          sql`created_at < ${startIso}::timestamptz`,
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
          gte(feedback.submittedAt, startDate),
        ),
      ),

    // Previous public reviews
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "public_review"),
          gte(feedback.submittedAt, prevStart),
          sql`submitted_at < ${startIso}::timestamptz`,
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
          gte(feedback.submittedAt, startDate),
        ),
      ),

    // Previous private feedback
    db
      .select({ count: count() })
      .from(feedback)
      .where(
        and(
          eq(feedback.businessId, businessId),
          eq(feedback.type, "private_feedback"),
          gte(feedback.submittedAt, prevStart),
          sql`submitted_at < ${startIso}::timestamptz`,
        ),
      ),

    // Average rating (all time)
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

    // ✅ FIX: ISO string, not Date, inside sql``
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') AS week,
        COUNT(*) FILTER (WHERE type = 'public_review')::int  AS five_star,
        COUNT(*) FILTER (WHERE type = 'private_feedback')::int AS four_star
      FROM feedback
      WHERE business_id = ${businessId}
        AND submitted_at >= ${eightWeeksIso}::timestamptz
      GROUP BY DATE_TRUNC('week', submitted_at)
      ORDER BY DATE_TRUNC('week', submitted_at)
    `),

    // Recent requests with customer data (Drizzle ORM — no raw dates needed)
    db.query.reviewRequests.findMany({
      where: eq(reviewRequests.businessId, businessId),
      with: { customer: true },
      orderBy: [desc(reviewRequests.createdAt)],
      limit: 8,
    }),

    // Funnel overview (no date filters needed)
    db.execute(sql`
      SELECT
        COUNT(*)::int AS sent,
        COUNT(*) FILTER (WHERE status IN ('opened','clicked'))::int AS opened,
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'public_review')::int   AS public_reviews,
        (SELECT COUNT(*) FROM feedback WHERE business_id = ${businessId} AND type = 'private_feedback')::int AS private_feedback
      FROM review_requests
      WHERE business_id = ${businessId}
    `),
  ]);

  // ── Compute stats ──────────────────────────────────────────────────────────

  function pctChange(curr: number, prev: number) {
    if (prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const totalSent = Number(currentRequests[0]?.count ?? 0);
  const prevSent = Number(prevRequests[0]?.count ?? 0);
  const totalReviews = Number(currentReviews[0]?.count ?? 0);
  const prevReviews2 = Number(prevReviews[0]?.count ?? 0);
  const totalPriv = Number(currentPrivate[0]?.count ?? 0);
  const prevPriv = Number(prevPrivate[0]?.count ?? 0);
  const avgRating = parseFloat(Number(avgRatingResult[0]?.avg ?? 0).toFixed(1));

  const totalRatings = ratingDist.reduce((s, r) => s + Number(r.count), 0);
  const ratingDistFormatted = [1, 2, 3, 4, 5].map((star) => {
    const found = ratingDist.find((r) => r.rating === star);
    const cnt = Number(found?.count ?? 0);
    return {
      rating: star,
      count: cnt,
      pct: totalRatings > 0 ? Math.round((cnt / totalRatings) * 100) : 0,
    };
  });

  const funnel = (funnelStats[0] as any) ?? {
    sent: 0,
    opened: 0,
    public_reviews: 0,
    private_feedback: 0,
  };

  const stats = [
    {
      label: "Requests Sent",
      value: totalSent.toLocaleString(),
      change: pctChange(totalSent, prevSent),
      color: "blue" as const,
      icon: "↗",
      iconBg: "bg-blue-100 text-blue-600",
    },
    {
      label: "Reviews Generated",
      value: totalReviews.toLocaleString(),
      change: pctChange(totalReviews, prevReviews2),
      color: "green" as const,
      icon: "★",
      iconBg: "bg-green-100 text-green-600",
    },
    {
      label: "Private Feedback",
      value: totalPriv.toLocaleString(),
      change: pctChange(totalPriv, prevPriv),
      color: "amber" as const,
      invertChange: true,
      icon: "💬",
      iconBg: "bg-amber-100 text-amber-600",
    },
    {
      label: "Avg. Rating",
      value: avgRating > 0 ? avgRating.toFixed(1) : "—",
      change: null,
      color: "blue" as const,
      icon: "☆",
      iconBg: "bg-sky-100 text-sky-600",
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ReviewTrendChart data={weeklyTrend as any[]} />
        </div>
        <RatingDistributionChart data={ratingDistFormatted} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RecentRequestsTable requests={recentRequests as any[]} />
        </div>
        <FunnelSummary
          sent={Number(funnel.sent ?? 0)}
          opened={Number(funnel.opened ?? 0)}
          publicReviews={Number(funnel.public_reviews ?? 0)}
          privateFeedback={Number(funnel.private_feedback ?? 0)}
        />
      </div>
    </div>
  );
}
