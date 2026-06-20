// src/lib/funnel.ts
// Smart Review Funnel — the core business logic of GenuinePulse
//
// Flow:
//   Customer clicks personalized link
//     → Lands on /r/[token] page
//     → Submits a 1–5 star rating
//     → IF rating >= business.positiveThreshold (default: 4)
//         → Insert feedback (type: public_review)
//         → Redirect to Google/Yelp/Facebook URL
//       ELSE
//         → Insert feedback (type: private_feedback)
//         → Show private feedback form
//         → Capture written message
//         → Notify business owner

import { db } from "@/db";
import { feedback, reviewRequests, customers, businesses } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FunnelContext {
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FunnelRatingPayload {
  token: string;
  rating: number; // 1–5
  ipAddress?: string;
  userAgent?: string;
}

export interface FunnelFeedbackPayload {
  token: string;
  message: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FunnelResult {
  action:
    | "redirect_public"
    | "show_feedback_form"
    | "already_submitted"
    | "expired"
    | "invalid";
  redirectUrl?: string;
  reviewRequestId?: string;
  businessName?: string;
  feedbackId?: string;
}

// ─── Validate and resolve a funnel token ─────────────────────────────────────

export async function resolveFunnelToken(token: string) {
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.token, token),
    with: {
      business: true,
      customer: true,
    },
  });

  return request ?? null;
}

// ─── Handle rating submission ─────────────────────────────────────────────────
// Called when customer submits a star rating

export async function handleRating(
  payload: FunnelRatingPayload,
): Promise<FunnelResult> {
  const { token, rating, ipAddress, userAgent } = payload;

  // 1. Resolve the token
  const request = await resolveFunnelToken(token);

  if (!request) {
    return { action: "invalid" };
  }

  // 2. Check expiry
  if (request.expiresAt && request.expiresAt < new Date()) {
    return { action: "expired", businessName: request.business.name };
  }

  // 3. Idempotency — check if already submitted
  const existing = await db.query.feedback.findFirst({
    where: eq(feedback.reviewRequestId, request.id),
  });

  if (existing) {
    return {
      action: "already_submitted",
      businessName: request.business.name,
    };
  }

  // 4. Mark link as clicked
  await db
    .update(reviewRequests)
    .set({ status: "clicked", clickedAt: new Date() })
    .where(eq(reviewRequests.id, request.id));

  const threshold = request.business.positiveThreshold ?? 4;

  // ─── 5. CORE FUNNEL DECISION ──────────────────────────────────────────
  if (rating >= threshold) {
    // ✅ Happy customer → insert public review record → redirect to platform

    const redirectUrl = pickReviewPlatformUrl(request.business);

    await db.insert(feedback).values({
      id: crypto.randomUUID(),
      businessId: request.businessId,
      customerId: request.customerId,
      reviewRequestId: request.id,
      rating,
      type: "public_review",
      reviewPlatform: detectPlatform(redirectUrl),
      reviewPlatformUrl: redirectUrl,
      ipAddress,
      userAgent,
      submittedAt: new Date(),
    });

    // Update customer stats
    await db
      .update(customers)
      .set({
        totalReviewsLeft: sql`total_reviews_left + 1`,
        lastRating: rating,
      })
      .where(eq(customers.id, request.customerId));

    return {
      action: "redirect_public",
      redirectUrl,
      reviewRequestId: request.id,
      businessName: request.business.name,
    };
  } else {
    // ⚠️  Unhappy customer → store rating, show private feedback form

    // Insert a pending private feedback record (message filled in next step)
    const [inserted] = await db
      .insert(feedback)
      .values({
        id: crypto.randomUUID(),
        businessId: request.businessId,
        customerId: request.customerId,
        reviewRequestId: request.id,
        rating,
        type: "private_feedback",
        ipAddress,
        userAgent,
        submittedAt: new Date(),
      })
      .returning({ id: feedback.id });

    // Update customer's last rating
    await db
      .update(customers)
      .set({ lastRating: rating })
      .where(eq(customers.id, request.customerId));

    return {
      action: "show_feedback_form",
      feedbackId: inserted.id,
      reviewRequestId: request.id,
      businessName: request.business.name,
    };
  }
}

// ─── Handle private feedback message ─────────────────────────────────────────
// Called when customer submits written feedback after a low rating

export async function handlePrivateFeedback(
  feedbackId: string,
  message: string,
): Promise<{ success: boolean }> {
  if (!message?.trim()) {
    return { success: false };
  }

  await db
    .update(feedback)
    .set({ message: message.trim() })
    .where(eq(feedback.id, feedbackId));

  // Optionally: send email notification to business owner
  // await notifyBusinessOwner(feedbackId);

  return { success: true };
}

// ─── Generate a short unique token ───────────────────────────────────────────

export function generateReviewToken(): string {
  return nanoid(16); // 16-char URL-safe token → enough entropy
}

// ─── Build the review link ────────────────────────────────────────────────────

export function buildReviewLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/r/${token}`;
}

// ─── Pick best review platform URL ───────────────────────────────────────────

export function pickReviewPlatformUrl(business: {
  googleReviewUrl?: string | null;
  yelpReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
  customReviewUrl?: string | null;
}): string {
  // Priority: Google → Yelp → Facebook → custom → fallback
  return (
    business.googleReviewUrl ??
    business.yelpReviewUrl ??
    business.facebookReviewUrl ??
    business.customReviewUrl ??
    "https://google.com"
  );
}

export function detectPlatform(url: string): string {
  if (url.includes("google.com")) return "google";
  if (url.includes("yelp.com")) return "yelp";
  if (url.includes("facebook.com")) return "facebook";
  return "other";
}
