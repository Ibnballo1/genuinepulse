// src/app/api/customers/route.ts
// ADDED: export const runtime = "nodejs" — ensures postgres driver works
// GET  /api/customers — list customers (paginated, filtered)
// POST /api/customers — create a single customer

export const runtime = "nodejs";

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, auditLogs } from "@/db/schema";
import { eq, and, or, ilike, sql, desc, count } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  validateBody,
  paginatedResponse,
  getPaginationParams,
  apiSuccess,
} from "@/lib/api";
import { createCustomerSchema } from "@/lib/validations";

// ─── GET — list customers ─────────────────────────────────────────────────────

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);

  const search = searchParams.get("search");
  const optedOut = searchParams.get("optedOut");
  const hasReviewed = searchParams.get("hasReviewed");

  // Build conditions
  const conditions: any[] = [eq(customers.businessId, businessId)];

  if (search) {
    conditions.push(
      or(
        ilike(customers.firstName, `%${search}%`),
        ilike(customers.lastName, `%${search}%`),
        ilike(customers.email, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
      )!,
    );
  }

  if (optedOut !== null && optedOut !== "") {
    conditions.push(eq(customers.optedOut, optedOut === "true"));
  }

  if (hasReviewed === "true") {
    conditions.push(sql`${customers.totalReviewsLeft} > 0`);
  } else if (hasReviewed === "false") {
    conditions.push(eq(customers.totalReviewsLeft, 0));
  }

  const whereClause = and(...conditions);

  // Count total
  const [{ total }] = await db
    .select({ total: count() })
    .from(customers)
    .where(whereClause);

  // Fetch page
  const rows = await db
    .select()
    .from(customers)
    .where(whereClause)
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, Number(total), page, limit);
});

// ─── POST — create customer ───────────────────────────────────────────────────

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user, businessId } = await getBusinessContext(req);
  const body = await validateBody(req, createCustomerSchema);

  const [created] = await db
    .insert(customers)
    .values({
      id: randomUUID(),
      businessId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email?.toLowerCase().trim(),
      phone: body.phone,
      notes: body.notes,
      tags: body.tags,
    })
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: user.id,
    businessId,
    action: "create",
    resourceType: "customer",
    resourceId: created.id,
    metadata: { firstName: created.firstName, email: created.email },
  });

  return apiSuccess(created, 201);
});
