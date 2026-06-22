// src/app/api/review-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  reviewRequests,
  customers,
  businesses,
  subscriptions,
  messageTemplates,
} from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import {
  getBusinessContext,
  withErrorHandling,
  validateBody,
  paginatedResponse,
  getPaginationParams,
  apiSuccess,
} from "@/lib/api";
import { sendReviewRequestSchema } from "@/lib/validations";
import { sendSmsWithRetry, personalizeSmsTemplate } from "@/lib/sms";
import {
  sendEmailWithRetry,
  buildReviewRequestEmail,
  personalizeEmailTemplate,
} from "@/lib/email";
import { generateReviewToken, buildReviewLink } from "@/lib/funnel";
import {
  smsLimiter,
  emailLimiter,
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { addDays } from "date-fns";

export const runtime = "nodejs";

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { businessId } = await getBusinessContext(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = getPaginationParams(searchParams);

  const status = searchParams.get("status");
  const channel = searchParams.get("channel");

  const conditions: any[] = [eq(reviewRequests.businessId, businessId)];
  if (status) conditions.push(eq(reviewRequests.status, status as any));
  if (channel) conditions.push(eq(reviewRequests.channel, channel as any));
  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(reviewRequests)
    .where(where);

  const rows = await db.query.reviewRequests.findMany({
    where,
    with: { customer: true },
    orderBy: [desc(reviewRequests.createdAt)],
    limit,
    offset,
  });

  return paginatedResponse(rows, Number(total), page, limit);
});

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user, businessId } = await getBusinessContext(req);
  const body = await validateBody(req, sendReviewRequestSchema);
  const ip = getClientIp(req);

  // Rate limit
  const limiter = body.channel === "sms" ? smsLimiter : emailLimiter;
  const { success, reset } = await checkRateLimit(
    limiter,
    `${businessId}:${ip}`,
  );
  if (!success) return rateLimitResponse(reset);

  // Load business, customer, subscription
  const [business, customer, subscription] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(businesses.id, businessId) }),
    db.query.customers.findFirst({
      where: and(
        eq(customers.id, body.customerId),
        eq(customers.businessId, businessId),
      ),
    }),
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.businessId, businessId),
    }),
  ]);

  if (!business)
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!customer)
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  if (customer.optedOut) {
    return NextResponse.json(
      { error: "Customer has opted out of messages" },
      { status: 422 },
    );
  }

  // Usage limits
  if (subscription) {
    if (
      body.channel === "sms" &&
      subscription.smsSentThisPeriod >= subscription.monthlySmsLimit
    ) {
      return NextResponse.json(
        { error: "Monthly SMS limit reached. Please upgrade your plan." },
        { status: 429 },
      );
    }
    if (
      body.channel === "email" &&
      subscription.emailSentThisPeriod >= subscription.monthlyEmailLimit
    ) {
      return NextResponse.json(
        { error: "Monthly email limit reached. Please upgrade your plan." },
        { status: 429 },
      );
    }
  }

  // Contact info
  const sendTo = body.channel === "sms" ? customer.phone : customer.email;
  if (!sendTo) {
    return NextResponse.json(
      {
        error: `Customer has no ${body.channel === "sms" ? "phone number" : "email address"}`,
      },
      { status: 422 },
    );
  }

  // Token + link
  const token = generateReviewToken();
  const reviewLink = buildReviewLink(token);
  const expiresAt = addDays(new Date(), 7);

  // Insert request record
  const [request] = await db
    .insert(reviewRequests)
    .values({
      id: crypto.randomUUID(),
      businessId,
      customerId: customer.id,
      sentById: user.id,
      channel: body.channel,
      status: "pending",
      token,
      sentTo: sendTo,
      templateId: body.templateId,
      scheduledAt: body.scheduledAt,
      expiresAt,
    })
    .returning();

  // Load template
  const template = body.templateId
    ? await db.query.messageTemplates.findFirst({
        where: and(
          eq(messageTemplates.id, body.templateId),
          eq(messageTemplates.channel, body.channel),
        ),
      })
    : await db.query.messageTemplates.findFirst({
        where: and(
          eq(messageTemplates.businessId, businessId),
          eq(messageTemplates.channel, body.channel),
          eq(messageTemplates.isDefault, true),
        ),
      });

  const vars = {
    first_name: customer.firstName,
    last_name: customer.lastName ?? "",
    business_name: business.name,
    review_link: reviewLink,
  };

  // Send
  if (body.channel === "sms") {
    const defaultBody = `Hi {{first_name}}! {{business_name}} would love your feedback. Rate us: {{review_link}} (Reply STOP to opt out)`;
    await sendSmsWithRetry({
      to: sendTo,
      body: personalizeSmsTemplate(template?.body ?? defaultBody, vars),
      businessId,
      reviewRequestId: request.id,
      fromNumber: business.smsFromNumber ?? undefined,
    });
  } else {
    const { subject, html } = template
      ? {
          subject: personalizeEmailTemplate(template.subject ?? "", vars),
          html: personalizeEmailTemplate(template.body, vars),
        }
      : buildReviewRequestEmail({
          customerName: customer.firstName,
          businessName: business.name,
          reviewLink,
          logoUrl: business.logoUrl ?? undefined,
        });

    await sendEmailWithRetry({
      to: sendTo,
      subject,
      html,
      businessId,
      reviewRequestId: request.id,
      fromEmail: business.emailFromAddress ?? undefined,
      fromName: business.emailFromName ?? undefined,
    });
  }

  // Increment usage
  if (subscription) {
    await db
      .update(subscriptions)
      .set(
        body.channel === "sms"
          ? { smsSentThisPeriod: sql`sms_sent_this_period + 1` }
          : { emailSentThisPeriod: sql`email_sent_this_period + 1` },
      )
      .where(eq(subscriptions.businessId, businessId));
  }

  // Update customer stats
  await db
    .update(customers)
    .set({
      totalRequestsSent: sql`total_requests_sent + 1`,
      lastRequestSentAt: new Date(),
    })
    .where(eq(customers.id, customer.id));

  return apiSuccess({ requestId: request.id, token, reviewLink }, 201);
});
