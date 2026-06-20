// src/app/api/customers/route.ts
// GET  /api/customers    — list business customers
// POST /api/customers    — create single customer

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
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
import { auditLogs } from "@/db/schema";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { user, businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);

  const search = searchParams.get("search");
  const tag = searchParams.get("tag");
  const hasReviewed = searchParams.get("hasReviewed");
  const optedOut = searchParams.get("optedOut");

  // Build dynamic WHERE conditions
  const conditions = [eq(customers.businessId, businessId)];

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

  if (optedOut !== null) {
    conditions.push(eq(customers.optedOut, optedOut === "true"));
  }

  if (hasReviewed === "true") {
    conditions.push(sql`${customers.totalReviewsLeft} > 0`);
  } else if (hasReviewed === "false") {
    conditions.push(eq(customers.totalReviewsLeft, 0));
  }

  const whereClause = and(...conditions);

  // Total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(customers)
    .where(whereClause);

  // Paginated results
  const rows = await db
    .select()
    .from(customers)
    .where(whereClause)
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, Number(total), page, limit);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user, businessId } = await getBusinessContext(req);
  const body = await validateBody(req, createCustomerSchema);

  const [created] = await db
    .insert(customers)
    .values({
      id: crypto.randomUUID(),
      businessId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email?.toLowerCase(),
      phone: body.phone,
      notes: body.notes,
      tags: body.tags,
    })
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    userId: user.id,
    businessId,
    action: "create",
    resourceType: "customer",
    resourceId: created.id,
    metadata: { firstName: created.firstName, email: created.email },
  });

  return apiSuccess(created, 201);
});
