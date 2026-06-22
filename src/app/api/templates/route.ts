// src/app/api/templates/route.ts
// GET  /api/templates — list templates for current business
// POST /api/templates — create a new template

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  validateBody,
  apiSuccess,
} from "@/lib/api";
import { createTemplateSchema } from "@/lib/validations";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");

  const conditions: any[] = [
    or(
      eq(messageTemplates.businessId, businessId),
      isNull(messageTemplates.businessId), // global defaults
    )!,
    eq(messageTemplates.isActive, true),
  ];

  if (channel) {
    conditions.push(eq(messageTemplates.channel, channel as "sms" | "email"));
  }

  const templates = await db.query.messageTemplates.findMany({
    where: and(...conditions),
    orderBy: (t, { desc }) => [desc(t.isDefault), desc(t.createdAt)],
  });

  return apiSuccess(templates);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const body = await validateBody(req, createTemplateSchema);

  // If setting as default, unset existing defaults for this channel
  if (body.isDefault) {
    await db
      .update(messageTemplates)
      .set({ isDefault: false })
      .where(
        and(
          eq(messageTemplates.businessId, businessId),
          eq(messageTemplates.channel, body.channel),
          eq(messageTemplates.isDefault, true),
        ),
      );
  }

  const [created] = await db
    .insert(messageTemplates)
    .values({
      id: crypto.randomUUID(),
      businessId,
      name: body.name,
      channel: body.channel,
      subject: body.subject,
      body: body.body,
      isDefault: body.isDefault ?? false,
      isActive: true,
    })
    .returning();

  return apiSuccess(created, 201);
});
