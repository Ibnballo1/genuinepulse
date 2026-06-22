// src/lib/auth.ts
// BetterAuth configuration
// FIXED: cookiePrefix corrected; advanced config explicit for Node.js

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  // ─── Email & Password ─────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // set true in production with email verified
    minPasswordLength: 8,
    maxPasswordLength: 128,

    sendResetPassword: async ({ user, url }) => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: user.email,
        subject: "Reset your GenuinePulse password",
        html: `
          <p>Hi ${user.name ?? "there"},</p>
          <p>Click the link below to reset your password. It expires in 1 hour.</p>
          <p><a href="${url}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    },
  },

  // ─── Session ─────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh token every 24 h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5-minute client-side cache
    },
  },

  // ─── Trusted origins ──────────────────────────────────────────────────────
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ].filter((v, i, a) => a.indexOf(v) === i), // deduplicate

  // ─── Additional user fields ───────────────────────────────────────────────
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "business_owner",
        input: false,
      },
      businessId: {
        type: "string",
        required: false,
        input: false,
      },
      isSuspended: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
    },
  },

  // ─── Advanced ────────────────────────────────────────────────────────────
  advanced: {
    // IMPORTANT: This prefix determines the cookie name the middleware checks.
    // Cookie will be: "gp.session_token"
    cookiePrefix: "gp",
    generateId: false, // use Postgres uuid default
  },
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
