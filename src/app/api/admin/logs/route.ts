// src/app/api/admin/logs/route.ts
// GET /api/admin/logs — recent message logs across all tenants (super_admin only)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messageLogs } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import {
  requireSuperAdmin,
  withErrorHandling,
  getPaginationParams,
  paginatedResponse,
} from "@/lib/api";
import { count } from "drizzle-orm";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireSuperAdmin(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");

  const conditions: any[] = [];
  if (status) conditions.push(eq(messageLogs.status, status as any));
  if (channel) conditions.push(eq(messageLogs.channel, channel as any));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(messageLogs);

  const rows = await db.query.messageLogs.findMany({
    where,
    orderBy: [desc(messageLogs.createdAt)],
    limit,
    offset,
  });

  return paginatedResponse(rows, Number(total), page, limit);
});
