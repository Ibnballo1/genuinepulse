// src/app/api/onboarding/route.ts
// POST /api/onboarding — complete first-run setup for a new business owner

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses, subscriptions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, withErrorHandling, validateBody } from "@/lib/api";
import { z } from "zod";
import { addDays } from "date-fns";

const onboardingSchema = z.object({
  name: z.string().min(2).max(255),
  industry: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  googleReviewUrl: z.string().url().optional().nullable(),
  yelpReviewUrl: z.string().url().optional().nullable(),
  positiveThreshold: z.number().int().min(1).max(5).default(4),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await validateBody(req, onboardingSchema);

  // Guard: don't let user onboard twice
  if (user.businessId) {
    return NextResponse.json(
      { error: "Business already configured for this account" },
      { status: 409 },
    );
  }

  // Generate a URL-safe slug from the business name
  const baseSlug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  // Ensure uniqueness
  const existing = await db.query.businesses.findFirst({
    where: eq(businesses.slug, baseSlug),
  });
  const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  // Create business
  const [business] = await db
    .insert(businesses)
    .values({
      id: crypto.randomUUID(),
      ownerId: user.id,
      name: body.name,
      slug,
      industry: body.industry,
      city: body.city,
      state: body.state,
      googleReviewUrl: body.googleReviewUrl,
      yelpReviewUrl: body.yelpReviewUrl,
      positiveThreshold: body.positiveThreshold ?? 4,
    })
    .returning();

  // Create starter subscription with 14-day trial
  await db.insert(subscriptions).values({
    id: crypto.randomUUID(),
    businessId: business.id,
    plan: "starter",
    status: "trialing",
    monthlySmsLimit: 500,
    monthlyEmailLimit: 2000,
    trialEndsAt: addDays(new Date(), 14),
    currentPeriodStart: new Date(),
    currentPeriodEnd: addDays(new Date(), 30),
  });

  // Link business to user
  await db
    .update(users)
    .set({ businessId: business.id, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json(
    { success: true, data: { businessId: business.id, slug: business.slug } },
    { status: 201 },
  );
});
