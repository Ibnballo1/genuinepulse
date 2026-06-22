// src/app/api/review-requests/[id]/route.ts
// GET   /api/review-requests/[id] — get one request with full detail
// PATCH /api/review-requests/[id] — update (e.g. cancel a scheduled request)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBusinessContext, withErrorHandling, apiSuccess } from "@/lib/api";

export const runtime = "nodejs";

export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);

    const request = await db.query.reviewRequests.findFirst({
      where: and(
        eq(reviewRequests.id, params.id),
        eq(reviewRequests.businessId, businessId),
      ),
      with: {
        customer: true,
        feedback: true,
        messageLogs: {
          orderBy: (ml, { desc }) => [desc(ml.createdAt)],
        },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return apiSuccess(request);
  },
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);

    const request = await db.query.reviewRequests.findFirst({
      where: and(
        eq(reviewRequests.id, params.id),
        eq(reviewRequests.businessId, businessId),
      ),
    });

    if (!request) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only allow canceling scheduled (not yet sent) requests
    if (request.status !== "pending" || !request.scheduledAt) {
      return NextResponse.json(
        { error: "Only pending scheduled requests can be canceled" },
        { status: 422 },
      );
    }

    await db.delete(reviewRequests).where(eq(reviewRequests.id, params.id));

    return NextResponse.json({ success: true });
  },
);
