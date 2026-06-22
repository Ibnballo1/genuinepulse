// src/app/api/webhooks/twilio/route.ts
// POST /api/webhooks/twilio — Twilio status callback

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, messageLogs, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isOptOutMessage } from "@/lib/sms";
import twilio from "twilio";

export const runtime = "nodejs";

const MessagingResponse = twilio.twiml.MessagingResponse;

export async function POST(req: NextRequest) {
  // Twilio sends form-encoded data
  const body = await req.formData();

  const messageSid = body.get("MessageSid") as string;
  const messageStatus = body.get("MessageStatus") as string;
  const to = body.get("To") as string;
  const from = body.get("From") as string;
  const messageBody = body.get("Body") as string;
  const errorCode = body.get("ErrorCode") as string | null;

  // ─── Handle inbound messages (opt-outs) ───────────────────────────────
  if (messageBody && isOptOutMessage(messageBody)) {
    // Mark customer as opted out
    const customer = await db.query.customers.findFirst({
      where: eq(customers.phone, to),
    });

    if (customer) {
      await db
        .update(customers)
        .set({
          optedOut: true,
          optedOutAt: new Date(),
          optedOutChannel: "sms",
        })
        .where(eq(customers.id, customer.id));
    }

    // Twilio expects a TwiML response for inbound
    const twiml = new MessagingResponse();
    twiml.message("You have been unsubscribed. Reply START to re-subscribe.");
    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // ─── Handle delivery status updates ──────────────────────────────────
  if (messageSid && messageStatus) {
    // Map Twilio status to our status
    const statusMap: Record<string, "sending" | "delivered" | "failed"> = {
      queued: "sending",
      sent: "sending",
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
    };

    const mappedStatus = statusMap[messageStatus] ?? "sending";

    // Update message log
    await db
      .update(messageLogs)
      .set({
        providerStatus: messageStatus,
        status: mappedStatus,
        ...(mappedStatus === "delivered" && { deliveredAt: new Date() }),
        ...(mappedStatus === "failed" && {
          failedAt: new Date(),
          failureCode: errorCode ?? undefined,
        }),
      })
      .where(eq(messageLogs.providerId, messageSid));

    // Update review request status
    if (mappedStatus === "delivered") {
      await db
        .update(reviewRequests)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(reviewRequests.twilioSid, messageSid));
    }
  }

  return new NextResponse("OK", { status: 200 });
}
