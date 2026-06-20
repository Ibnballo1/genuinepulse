// src/lib/rate-limit.ts
// Upstash Redis rate limiting — critical for SMS abuse prevention

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Only instantiate when env vars are present (skip in test)
function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

const redis = getRedis();

// ─── Limiters per use case ───────────────────────────────────────────────────

// SMS sending: 10 per minute per IP (prevent spam)
export const smsLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "gp:sms",
    })
  : null;

// Email sending: 30 per minute per IP
export const emailLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "gp:email",
    })
  : null;

// Login attempts: 5 per 15 minutes per IP
export const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "gp:login",
    })
  : null;

// API general: 100 per minute per user/IP
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "gp:api",
    })
  : null;

// Feedback form: 3 per hour per IP (prevent fake submissions)
export const feedbackLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "gp:feedback",
    })
  : null;

// ─── Helper ──────────────────────────────────────────────────────────────────

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: Date }> {
  if (!limiter) {
    return { success: true, remaining: 999, reset: new Date() };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: new Date(result.reset),
  };
}

export function rateLimitResponse(reset: Date): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Rate limit exceeded. Please slow down.",
      retryAfter: Math.ceil((reset.getTime() - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((reset.getTime() - Date.now()) / 1000)),
        "X-RateLimit-Reset": reset.toISOString(),
      },
    }
  );
}
