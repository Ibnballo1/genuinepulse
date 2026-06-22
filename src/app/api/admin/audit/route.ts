// src/app/api/admin/audit/route.ts
// GET /api/admin/audit — audit log entries (super_admin only)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users, businesses } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import {
  requireSuperAdmin,
  withErrorHandling,
  getPaginationParams,
  paginatedResponse,
} from "@/lib/api";
import { count } from "drizzle-orm";
import { subDays } from "date-fns";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireSuperAdmin(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);
  const action = searchParams.get("action");
  const days = parseInt(searchParams.get("days") ?? "30");

  const conditions: any[] = [
    gte(auditLogs.createdAt, subDays(new Date(), days)),
  ];
  if (action) conditions.push(eq(auditLogs.action, action as any));

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLogs)
    .where(where);

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
      businessName: businesses.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(businesses, eq(auditLogs.businessId, businesses.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, Number(total), page, limit);
});
