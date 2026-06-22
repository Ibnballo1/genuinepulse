// src/lib/email.ts
// Resend email service — send, retry, and log

import { Resend } from "resend";
import { db } from "@/db";
import { messageLogs, reviewRequests } from "@/db/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  businessId?: string;
  reviewRequestId?: string;
  fromEmail?: string;
  fromName?: string;
  attemptNumber?: number;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ─── Send Email ───────────────────────────────────────────────────────────────

export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const {
    to,
    subject,
    html,
    text,
    businessId,
    reviewRequestId,
    fromEmail = process.env.RESEND_FROM_EMAIL!,
    fromName = process.env.RESEND_FROM_NAME ?? "GenuinePulse",
    attemptNumber = 1,
  } = params;

  // const from = `${fromName} <${fromEmail}>`;
  // 🛠️ Ensure the format matches: "Name <email@domain.com>" or "email@domain.com"
  const computedFromName = fromName?.trim() || "GenuinePulse Feedback";

  // Clean fallback if the custom business domain profile email isn't set up yet
  const computedFromAddress = fromEmail?.includes("@")
    ? fromEmail.trim()
    : process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"; // Resend testing sandbox fallback

  const formattedFromField = `${computedFromName} <${computedFromAddress}>`;

  try {
    const result = await resend.emails.send({
      from: formattedFromField,
      to: "webtekhy@gmail.com",
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, ""), // strip tags for plain-text fallback
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    const emailId = result.data?.id;

    // Log success
    if (businessId) {
      await logEmail({
        businessId,
        reviewRequestId,
        status: "sending",
        provider: "resend",
        providerId: emailId,
        toAddress: to,
        subject,
        bodyPreview: html.replace(/<[^>]+>/g, "").substring(0, 200),
        sentAt: new Date(),
        attemptNumber,
        isRetry: attemptNumber > 1,
      });
    }

    // Update review request
    if (reviewRequestId) {
      await db
        .update(reviewRequests)
        .set({
          resendId: emailId,
          status: "sent",
          sentAt: new Date(),
        })
        .where(eq(reviewRequests.id, reviewRequestId));
    }

    return { success: true, id: emailId };
  } catch (err: any) {
    const errorMessage = err.message ?? "Unknown email error";

    if (businessId) {
      await logEmail({
        businessId,
        reviewRequestId,
        status: "failed",
        provider: "resend",
        toAddress: to,
        subject,
        bodyPreview: html.replace(/<[^>]+>/g, "").substring(0, 200),
        failedAt: new Date(),
        failureMessage: errorMessage,
        attemptNumber,
        isRetry: attemptNumber > 1,
      });
    }

    if (reviewRequestId) {
      await db
        .update(reviewRequests)
        .set({ status: "failed", failureReason: errorMessage })
        .where(eq(reviewRequests.id, reviewRequestId));
    }

    console.error(`[Email] Failed to send to ${to}:`, err);
    return { success: false, error: errorMessage };
  }
}

// ─── Retry ────────────────────────────────────────────────────────────────────

export async function sendEmailWithRetry(
  params: SendEmailParams,
  maxAttempts = 3,
): Promise<EmailResult> {
  const delays = [0, 15_000, 60_000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await new Promise((r) => setTimeout(r, delays[attempt - 1] ?? 60_000));
    }

    const result = await sendEmail({ ...params, attemptNumber: attempt });
    if (result.success) return result;

    if (attempt < maxAttempts) {
      console.warn(`[Email] Attempt ${attempt} failed, retrying...`);
    }
  }

  return { success: false, error: "Max retry attempts exceeded" };
}

// ─── Template: Review Request ─────────────────────────────────────────────────

export function buildReviewRequestEmail({
  customerName,
  businessName,
  reviewLink,
  logoUrl,
}: {
  customerName: string;
  businessName: string;
  reviewLink: string;
  logoUrl?: string;
}): { subject: string; html: string } {
  const subject = `How was your experience with ${businessName}?`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#1D4ED8;padding:28px 40px;text-align:center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="height:40px;margin-bottom:8px;display:block;margin:0 auto 8px;" />` : ""}
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">${businessName}</h1>
              <p style="margin:6px 0 0;color:#BFDBFE;font-size:14px;">We value your feedback</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#1E293B;line-height:1.6;">
                Hi <strong>${customerName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
                Thank you for visiting us. Your opinion matters and helps us improve. Would you mind taking 30 seconds to share your experience?
              </p>

              <!-- Star rating CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${reviewLink}"
                       style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:8px;letter-spacing:-0.2px;">
                      ⭐ Share Your Experience
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94A3B8;text-align:center;line-height:1.6;">
                This link is unique to you and expires in 7 days.<br/>
                <a href="${reviewLink}" style="color:#3B82F6;text-decoration:none;word-break:break-all;">${reviewLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #F1F5F9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;">
                You're receiving this because you recently visited ${businessName}.<br/>
                Powered by <a href="https://genuinepulse.com" style="color:#3B82F6;text-decoration:none;">GenuinePulse</a>
                · <a href="${reviewLink}?unsubscribe=1" style="color:#94A3B8;text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}

// ─── Personalize template ─────────────────────────────────────────────────────

export function personalizeEmailTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

// ─── Log helper ───────────────────────────────────────────────────────────────

async function logEmail(data: {
  businessId: string;
  reviewRequestId?: string;
  status: "queued" | "sending" | "delivered" | "failed" | "retrying";
  provider: string;
  providerId?: string;
  toAddress: string;
  subject: string;
  bodyPreview?: string;
  sentAt?: Date;
  failedAt?: Date;
  failureMessage?: string;
  attemptNumber: number;
  isRetry: boolean;
}) {
  return db.insert(messageLogs).values({
    id: crypto.randomUUID(),
    businessId: data.businessId,
    reviewRequestId: data.reviewRequestId,
    channel: "email",
    status: data.status,
    provider: data.provider,
    providerId: data.providerId,
    toAddress: data.toAddress,
    subject: data.subject,
    bodyPreview: data.bodyPreview,
    sentAt: data.sentAt,
    failedAt: data.failedAt,
    failureMessage: data.failureMessage,
    attemptNumber: data.attemptNumber,
    isRetry: data.isRetry,
  });
}
