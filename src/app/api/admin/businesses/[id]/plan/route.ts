// src/app/api/admin/businesses/[id]/plan/route.ts
// PATCH /api/admin/businesses/[id]/plan — change plan and limits

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin, withErrorHandling, apiSuccess } from "@/lib/api";
import { updatePlanSchema } from "@/lib/validations";

export const runtime = "nodejs";

const PLAN_DEFAULTS = {
  starter: { monthlySmsLimit: 500, monthlyEmailLimit: 2_000 },
  pro: { monthlySmsLimit: 2_500, monthlyEmailLimit: 10_000 },
  enterprise: { monthlySmsLimit: 20_000, monthlyEmailLimit: 100_000 },
};

export const PATCH = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const admin = await requireSuperAdmin(req);
    const body = await req.json();
    const parsed = updatePlanSchema.safeParse({
      businessId: params.id,
      ...body,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const defaults = PLAN_DEFAULTS[parsed.data.plan];

    const [updated] = await db
      .update(subscriptions)
      .set({
        plan: parsed.data.plan,
        status: "active",
        monthlySmsLimit:
          parsed.data.monthlySmsLimit ?? defaults.monthlySmsLimit,
        monthlyEmailLimit:
          parsed.data.monthlyEmailLimit ?? defaults.monthlyEmailLimit,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.businessId, params.id))
      .returning();

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: admin.id,
      action: "update",
      resourceType: "subscription",
      resourceId: params.id,
      metadata: { plan: parsed.data.plan, previousPlan: updated?.plan },
    });

    return apiSuccess(updated);
  },
);
