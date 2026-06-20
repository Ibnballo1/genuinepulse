// src/app/api/customers/[id]/route.ts
// GET   /api/customers/[id] — get one customer with request history
// PATCH /api/customers/[id] — update customer
// DELETE /api/customers/[id] — delete customer

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  validateBody,
  apiSuccess,
} from "@/lib/api";
import { updateCustomerSchema } from "@/lib/validations";

export const GET = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);

    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, params.id),
        eq(customers.businessId, businessId),
      ),
      with: {
        reviewRequests: {
          orderBy: (rr, { desc }) => [desc(rr.createdAt)],
          limit: 20,
        },
        feedback: {
          orderBy: (f, { desc }) => [desc(f.submittedAt)],
          limit: 10,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    return apiSuccess(customer);
  },
);

export const PATCH = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user, businessId } = await getBusinessContext(req);
    const body = await validateBody(req, updateCustomerSchema);

    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, params.id),
        eq(customers.businessId, businessId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    const [updated] = await db
      .update(customers)
      .set({
        ...body,
        email: body.email?.toLowerCase(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, params.id))
      .returning();

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: user.id,
      businessId,
      action: "update",
      resourceType: "customer",
      resourceId: params.id,
      metadata: { fields: Object.keys(body) },
    });

    return apiSuccess(updated);
  },
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { user, businessId } = await getBusinessContext(req);

    const existing = await db.query.customers.findFirst({
      where: and(
        eq(customers.id, params.id),
        eq(customers.businessId, businessId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    await db.delete(customers).where(eq(customers.id, params.id));

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId: user.id,
      businessId,
      action: "delete",
      resourceType: "customer",
      resourceId: params.id,
      metadata: {
        name: `${existing.firstName} ${existing.lastName ?? ""}`.trim(),
      },
    });

    return NextResponse.json({ success: true });
  },
);
