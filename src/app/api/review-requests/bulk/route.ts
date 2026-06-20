// src/app/api/review-requests/bulk/route.ts
// POST /api/review-requests/bulk — send to multiple customers at once

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  reviewRequests, customers, businesses,
  subscriptions, messageTemplates,
} from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  getBusinessContext, withErrorHandling, validateBody,
} from "@/lib/api";
import { bulkSendRequestSchema } from "@/lib/validations";
import { sendSmsWithRetry, personalizeSmsTemplate } from "@/lib/sms";
import { sendEmailWithRetry, buildReviewRequestEmail, personalizeEmailTemplate } from "@/lib/email";
import { generateReviewToken, buildReviewLink } from "@/lib/funnel";
import {
  smsLimiter, emailLimiter, getClientIp, checkRateLimit, rateLimitResponse,
} from "@/lib/rate-limit";
import { addDays } from "date-fns";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user, businessId } = await getBusinessContext(req);
  const body = await validateBody(req, bulkSendRequestSchema);
  const ip = getClientIp(req);

  // Rate limit check (use same per-business limiter)
  const limiter = body.channel === "sms" ? smsLimiter : emailLimiter;
  const { success, reset } = await checkRateLimit(limiter, `${businessId}:${ip}`);
  if (!success) return rateLimitResponse(reset);

  // Load business + subscription
  const [business, subscription] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(businesses.id, businessId) }),
    db.query.subscriptions.findFirst({ where: eq(subscriptions.businessId, businessId) }),
  ]);

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Load customers (must belong to this business)
  const customerList = await db.query.customers.findMany({
    where: and(
      inArray(customers.id, body.customerIds),
      eq(customers.businessId, businessId),
      eq(customers.optedOut, false)
    ),
  });

  if (customerList.length === 0) {
    return NextResponse.json({ error: "No eligible customers found" }, { status: 422 });
  }

  // Check usage limits
  const remaining = body.channel === "sms"
    ? (subscription?.monthlySmsLimit ?? 0) - (subscription?.smsSentThisPeriod ?? 0)
    : (subscription?.monthlyEmailLimit ?? 99999) - (subscription?.emailSentThisPeriod ?? 0);

  const eligible = customerList.slice(0, Math.max(0, remaining));

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: `Monthly ${body.channel.toUpperCase()} limit reached` },
      { status: 429 }
    );
  }

  // Load template once
  const template = body.templateId
    ? await db.query.messageTemplates.findFirst({
        where: eq(messageTemplates.id, body.templateId),
      })
    : null;

  // Results tracking
  const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

  // Send to each customer
  for (const customer of eligible) {
    const sendTo = body.channel === "sms" ? customer.phone : customer.email;
    if (!sendTo) { results.skipped++; continue; }

    const token = generateReviewToken();
    const reviewLink = buildReviewLink(token);
    const expiresAt = addDays(new Date(), 7);

    // Insert request record
    const [request] = await db
      .insert(reviewRequests)
      .values({
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

    const templateVars = {
      first_name: customer.firstName,
      last_name: customer.lastName ?? "",
      business_name: business.name,
      review_link: reviewLink,
    };

    let sendResult;
    if (body.channel === "sms") {
      const defaultSms = `Hi {{first_name}}! {{business_name}} thanks you for your visit. Rate us here: {{review_link}} (Reply STOP to opt out)`;
      sendResult = await sendSmsWithRetry({
        to: sendTo,
        body: personalizeSmsTemplate(template?.body ?? defaultSms, templateVars),
        businessId,
        reviewRequestId: request.id,
      });
    } else {
      const { subject, html } = template
        ? {
            subject: personalizeEmailTemplate(template.subject ?? "", templateVars),
            html: personalizeEmailTemplate(template.body, templateVars),
          }
        : buildReviewRequestEmail({
            customerName: customer.firstName,
            businessName: business.name,
            reviewLink,
          });
      sendResult = await sendEmailWithRetry({
        to: sendTo, subject, html, businessId, reviewRequestId: request.id,
      });
    }

    if (sendResult.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push(`${customer.firstName}: ${sendResult.error}`);
    }

    // Update customer stats
    await db
      .update(customers)
      .set({
        totalRequestsSent: sql`total_requests_sent + 1`,
        lastRequestSentAt: new Date(),
      })
      .where(eq(customers.id, customer.id));
  }

  // Increment bulk usage count
  if (subscription && results.sent > 0) {
    await db
      .update(subscriptions)
      .set(
        body.channel === "sms"
          ? { smsSentThisPeriod: sql`sms_sent_this_period + ${results.sent}` }
          : { emailSentThisPeriod: sql`email_sent_this_period + ${results.sent}` }
      )
      .where(eq(subscriptions.businessId, businessId));
  }

  return NextResponse.json({
    success: true,
    data: {
      ...results,
      totalEligible: eligible.length,
      skippedDueToLimit: customerList.length - eligible.length,
    },
  });
});
