// src/app/api/templates/[id]/route.ts
// PATCH  /api/templates/[id] — update a template
// DELETE /api/templates/[id] — soft-delete a template

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  validateBody,
  apiSuccess,
} from "@/lib/api";
import { createTemplateSchema } from "@/lib/validations";

export const runtime = "nodejs";

export const PATCH = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);
    const body = await validateBody(req, createTemplateSchema.partial());

    const existing = await db.query.messageTemplates.findFirst({
      where: and(
        eq(messageTemplates.id, params.id),
        eq(messageTemplates.businessId, businessId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    const [updated] = await db
      .update(messageTemplates)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(messageTemplates.id, params.id))
      .returning();

    return apiSuccess(updated);
  },
);

export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const { businessId } = await getBusinessContext(req);

    const existing = await db.query.messageTemplates.findFirst({
      where: and(
        eq(messageTemplates.id, params.id),
        eq(messageTemplates.businessId, businessId),
      ),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    if (existing.isDefault) {
      return NextResponse.json(
        {
          error:
            "Cannot delete the default template. Set another as default first.",
        },
        { status: 422 },
      );
    }

    // Soft delete
    await db
      .update(messageTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(messageTemplates.id, params.id));

    return NextResponse.json({ success: true });
  },
);
