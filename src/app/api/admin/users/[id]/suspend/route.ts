// src/app/api/admin/users/[id]/suspend/route.ts
// POST   /api/admin/users/[id]/suspend
// DELETE /api/admin/users/[id]/suspend  — unsuspend

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSuperAdmin, withErrorHandling, apiSuccess } from "@/lib/api";
import { suspendUserSchema } from "@/lib/validations";

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const admin = await requireSuperAdmin(req);
    const body = await req.json();
    const parsed = suspendUserSchema.safeParse({ userId: params.id, ...body });

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
    }

    const target = await db.query.users.findFirst({ where: eq(users.id, params.id) });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (target.role === "super_admin") return NextResponse.json({ error: "Cannot suspend another super admin" }, { status: 403 });

    const [updated] = await db
      .update(users)
      .set({ isSuspended: true, suspendedAt: new Date(), suspendedReason: parsed.data.reason })
      .where(eq(users.id, params.id))
      .returning();

    await db.insert(auditLogs).values({
      userId: admin.id,
      action: "suspend_account",
      resourceType: "user",
      resourceId: params.id,
      metadata: { reason: parsed.data.reason, targetEmail: target.email },
    });

    return apiSuccess(updated);
  }
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const admin = await requireSuperAdmin(req);

    const [updated] = await db
      .update(users)
      .set({ isSuspended: false, suspendedAt: null, suspendedReason: null })
      .where(eq(users.id, params.id))
      .returning();

    await db.insert(auditLogs).values({
      userId: admin.id,
      action: "update",
      resourceType: "user",
      resourceId: params.id,
      metadata: { action: "unsuspend" },
    });

    return apiSuccess(updated);
  }
);
