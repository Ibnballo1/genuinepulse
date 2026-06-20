// src/lib/sms.ts
// Twilio SMS — send, retry, and log

import twilio from "twilio";
import { db } from "@/db";
import { messageLogs, reviewRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── Client ──────────────────────────────────────────────────────────────────

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error("Twilio credentials not configured");
  }

  return twilio(sid, token);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendSmsParams {
  to: string;           // E.164 format: +15551234567
  body: string;
  businessId: string;
  reviewRequestId?: string;
  fromNumber?: string;  // override default
  attemptNumber?: number;
}

export interface SmsResult {
  success: boolean;
  sid?: string;
  error?: string;
  errorCode?: string;
}

// ─── Phone normalization ─────────────────────────────────────────────────────

export function normalizePhone(phone: string): string | null {
  // Strip all non-numeric characters
  const digits = phone.replace(/\D/g, "");

  // US numbers: 10 digits → +1XXXXXXXXXX
  if (digits.length === 10) return `+1${digits}`;

  // Already has country code
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  // International — pass through if looks valid
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;

  return null; // invalid
}

// ─── Validate US phone opt-out keywords ──────────────────────────────────────

export const SMS_OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "end"];

export function isOptOutMessage(body: string): boolean {
  return SMS_OPT_OUT_KEYWORDS.includes(body.trim().toLowerCase());
}

// ─── Send SMS ─────────────────────────────────────────────────────────────────

export async function sendSms(params: SendSmsParams): Promise<SmsResult> {
  const {
    to,
    body,
    businessId,
    reviewRequestId,
    fromNumber,
    attemptNumber = 1,
  } = params;

  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    const log = await logMessage({
      businessId,
      reviewRequestId,
      channel: "sms",
      status: "failed",
      provider: "twilio",
      toAddress: to,
      bodyPreview: body.substring(0, 200),
      failureCode: "INVALID_PHONE",
      failureMessage: "Phone number could not be normalized to E.164 format",
      attemptNumber,
      isRetry: attemptNumber > 1,
    });
    return { success: false, error: "Invalid phone number format", errorCode: "INVALID_PHONE" };
  }

  const fromNum = fromNumber ?? process.env.TWILIO_FROM_NUMBER;
  if (!fromNum) {
    throw new Error("No SMS from-number configured");
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      to: normalizedTo,
      from: fromNum,
      body,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`,
    });

    // Log success
    await logMessage({
      businessId,
      reviewRequestId,
      channel: "sms",
      status: "sending",
      provider: "twilio",
      providerId: message.sid,
      providerStatus: message.status,
      providerResponse: {
        sid: message.sid,
        status: message.status,
        direction: message.direction,
        price: message.price,
      },
      toAddress: normalizedTo,
      bodyPreview: body.substring(0, 200),
      sentAt: new Date(),
      attemptNumber,
      isRetry: attemptNumber > 1,
    });

    // Update review request with provider SID
    if (reviewRequestId) {
      await db
        .update(reviewRequests)
        .set({
          twilioSid: message.sid,
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(reviewRequests.id, reviewRequestId));
    }

    return { success: true, sid: message.sid };
  } catch (err: any) {
    const errorCode = String(err.code ?? "UNKNOWN");
    const errorMessage = err.message ?? "Unknown Twilio error";

    // Log failure
    await logMessage({
      businessId,
      reviewRequestId,
      channel: "sms",
      status: "failed",
      provider: "twilio",
      toAddress: normalizedTo,
      bodyPreview: body.substring(0, 200),
      failureCode: errorCode,
      failureMessage: errorMessage,
      failedAt: new Date(),
      attemptNumber,
      isRetry: attemptNumber > 1,
    });

    // Mark request as failed
    if (reviewRequestId) {
      await db
        .update(reviewRequests)
        .set({
          status: "failed",
          failureReason: `${errorCode}: ${errorMessage}`,
        })
        .where(eq(reviewRequests.id, reviewRequestId));
    }

    console.error(`[SMS] Failed to send to ${normalizedTo}:`, err);
    return { success: false, error: errorMessage, errorCode };
  }
}

// ─── Retry with exponential backoff ──────────────────────────────────────────

export async function sendSmsWithRetry(
  params: SendSmsParams,
  maxAttempts = 3
): Promise<SmsResult> {
  const delays = [0, 30_000, 120_000]; // 0s, 30s, 2min

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, delays[attempt - 1] ?? 120_000));
    }

    const result = await sendSms({ ...params, attemptNumber: attempt });

    if (result.success) return result;

    // Don't retry on permanent errors (invalid number, opted out)
    const permanentErrors = ["21211", "21614", "21610", "INVALID_PHONE"];
    if (result.errorCode && permanentErrors.includes(result.errorCode)) {
      return result;
    }

    if (attempt < maxAttempts) {
      // Update retry count on request
      if (params.reviewRequestId) {
        await db
          .update(reviewRequests)
          .set({
            retryCount: attempt,
            lastRetryAt: new Date(),
            status: "failed",
          })
          .where(eq(reviewRequests.id, params.reviewRequestId));
      }
      console.warn(`[SMS] Attempt ${attempt} failed, retrying...`);
    }
  }

  return { success: false, error: "Max retry attempts exceeded" };
}

// ─── Personalize template ─────────────────────────────────────────────────────

export function personalizeSmsTemplate(
  template: string,
  vars: {
    first_name?: string;
    business_name?: string;
    review_link?: string;
    [key: string]: string | undefined;
  }
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

// ─── Message log helper ───────────────────────────────────────────────────────

async function logMessage(data: {
  businessId: string;
  reviewRequestId?: string;
  channel: "sms" | "email";
  status: "queued" | "sending" | "delivered" | "failed" | "retrying";
  provider: string;
  providerId?: string;
  providerStatus?: string;
  providerResponse?: object;
  toAddress: string;
  subject?: string;
  bodyPreview?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureCode?: string;
  failureMessage?: string;
  attemptNumber?: number;
  isRetry?: boolean;
}) {
  return db.insert(messageLogs).values({
    businessId: data.businessId,
    reviewRequestId: data.reviewRequestId,
    channel: data.channel,
    status: data.status,
    provider: data.provider,
    providerId: data.providerId,
    providerStatus: data.providerStatus,
    providerResponse: data.providerResponse,
    toAddress: data.toAddress,
    subject: data.subject,
    bodyPreview: data.bodyPreview,
    sentAt: data.sentAt,
    deliveredAt: data.deliveredAt,
    failedAt: data.failedAt,
    failureCode: data.failureCode,
    failureMessage: data.failureMessage,
    attemptNumber: data.attemptNumber ?? 1,
    isRetry: data.isRetry ?? false,
  });
}
