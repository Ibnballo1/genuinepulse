// src/app/api/customers/[id]/opt-out/route.ts
// POST   /api/customers/[id]/opt-out  — manually opt out a customer
// DELETE /api/customers/[id]/opt-out  — re-subscribe

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBusinessContext, withErrorHandling, apiSuccess } from "@/lib/api";

export const runtime = "nodejs";

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);
    const body = await req.json().catch(() => ({}));

    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, params.id),
        eq(customers.businessId, businessId),
      ),
    });

    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [updated] = await db
      .update(customers)
      .set({
        optedOut: true,
        optedOutAt: new Date(),
        optedOutChannel: body.channel ?? "sms",
      })
      .where(eq(customers.id, params.id))
      .returning();

    return apiSuccess(updated);
  },
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);

    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, params.id),
        eq(customers.businessId, businessId),
      ),
    });

    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [updated] = await db
      .update(customers)
      .set({ optedOut: false, optedOutAt: null, optedOutChannel: null })
      .where(eq(customers.id, params.id))
      .returning();

    return apiSuccess(updated);
  },
);
