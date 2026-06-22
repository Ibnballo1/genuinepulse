// src/app/api/funnel/[token]/route.ts
// GET /api/funnel/[token] — public endpoint; returns info needed to render the funnel page

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.token, params.token),
    with: {
      business: {
        columns: {
          id: true,
          name: true,
          logoUrl: true,
          positiveThreshold: true,
          googleReviewUrl: true,
        },
      },
      customer: {
        columns: { firstName: true },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isExpired = request.expiresAt ? request.expiresAt < new Date() : false;

  return NextResponse.json({
    success: true,
    data: {
      businessName: request.business.name,
      logoUrl: request.business.logoUrl ?? null,
      customerFirstName: request.customer.firstName,
      positiveThreshold: request.business.positiveThreshold,
      isExpired,
    },
  });
}
