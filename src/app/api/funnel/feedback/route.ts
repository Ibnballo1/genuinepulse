// src/app/api/funnel/feedback/route.ts
// POST /api/funnel/feedback — customer submits private written feedback (no auth)

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling, validateBody } from "@/lib/api";
import { submitFeedbackSchema } from "@/lib/validations";
import { handlePrivateFeedback } from "@/lib/funnel";
import {
  feedbackLimiter,
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = getClientIp(req);

  const { success, reset } = await checkRateLimit(feedbackLimiter, ip);
  if (!success) return rateLimitResponse(reset);

  const body = await validateBody(req, submitFeedbackSchema);
  const result = await handlePrivateFeedback(body.feedbackId, body.message);

  return NextResponse.json({ success: result.success });
});
