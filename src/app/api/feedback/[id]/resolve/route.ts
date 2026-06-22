// src/app/api/feedback/[id]/resolve/route.ts
// POST /api/feedback/[id]/resolve — mark private feedback as resolved

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBusinessContext, withErrorHandling, apiSuccess } from "@/lib/api";

export const runtime = "nodejs";

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user, businessId } = await getBusinessContext(req);
    const body = await req.json().catch(() => ({}));

    const existing = await db.query.feedback.findFirst({
      where: and(
        eq(feedback.id, params.id),
        eq(feedback.businessId, businessId),
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(feedback)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById: user.id,
        internalNote: body.note ?? null,
      })
      .where(eq(feedback.id, params.id))
      .returning();

    return apiSuccess(updated);
  },
);
