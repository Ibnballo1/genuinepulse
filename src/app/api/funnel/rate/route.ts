// src/app/api/funnel/rate/route.ts
// POST /api/funnel/rate — customer submits a star rating (public, no auth)

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling, validateBody } from "@/lib/api";
import { submitRatingSchema } from "@/lib/validations";
import { handleRating } from "@/lib/funnel";
import {
  feedbackLimiter,
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = getClientIp(req);

  // Rate limit: 3 submissions per hour per IP (prevent fake reviews)
  const { success, reset } = await checkRateLimit(feedbackLimiter, ip);
  if (!success) return rateLimitResponse(reset);

  const body = await validateBody(req, submitRatingSchema);

  const result = await handleRating({
    token: body.token,
    rating: body.rating,
    ipAddress: ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ success: true, data: result });
});
