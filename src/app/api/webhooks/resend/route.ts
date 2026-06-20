// src/app/api/webhooks/resend/route.ts
// POST /api/webhooks/resend — Resend email event webhook

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviewRequests, messageLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  // ─── Verify Resend webhook signature ──────────────────────────────────
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  const rawBody = await req.text();

  // Only verify in production
  if (process.env.NODE_ENV === "production") {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret || !svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const toSign = `${svix_id}.${svix_timestamp}.${rawBody}`;
    const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64");
    const computed = crypto
      .createHmac("sha256", secretBytes)
      .update(toSign)
      .digest("base64");

    const signatures = svix_signature.split(" ").map((s) => s.replace("v1,", ""));
    const isValid = signatures.some((sig) => sig === computed);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = JSON.parse(rawBody);
  const { type, data } = event;

  const emailId = data?.email_id;
  if (!emailId) return new NextResponse("OK");

  // ─── Map Resend events to our statuses ────────────────────────────────
  switch (type) {
    case "email.sent": {
      await db
        .update(messageLogs)
        .set({ status: "sending", sentAt: new Date() })
        .where(eq(messageLogs.providerId, emailId));
      break;
    }

    case "email.delivered": {
      await db
        .update(messageLogs)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(messageLogs.providerId, emailId));

      await db
        .update(reviewRequests)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(reviewRequests.resendId, emailId));
      break;
    }

    case "email.opened": {
      await db
        .update(reviewRequests)
        .set({ status: "opened", openedAt: new Date() })
        .where(eq(reviewRequests.resendId, emailId));
      break;
    }

    case "email.clicked": {
      await db
        .update(reviewRequests)
        .set({ status: "clicked", clickedAt: new Date() })
        .where(eq(reviewRequests.resendId, emailId));
      break;
    }

    case "email.bounced":
    case "email.complained": {
      await db
        .update(messageLogs)
        .set({
          status: "failed",
          failedAt: new Date(),
          failureCode: type === "email.bounced" ? "BOUNCE" : "SPAM_COMPLAINT",
          failureMessage: data?.bounce?.message ?? type,
        })
        .where(eq(messageLogs.providerId, emailId));

      await db
        .update(reviewRequests)
        .set({
          status: "bounced",
          failureReason: type === "email.bounced" ? "Email bounced" : "Spam complaint",
        })
        .where(eq(reviewRequests.resendId, emailId));
      break;
    }
  }

  return new NextResponse("OK");
}
