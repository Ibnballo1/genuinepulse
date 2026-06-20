// src/lib/auth.ts
// BetterAuth setup — email/password + session management + RBAC

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

  // ─── Email & Password ───────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
          <p><a href="${url}">Reset Password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    },

    sendVerificationEmail: async ({ user, url }) => {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: user.email,
        subject: "Verify your GenuinePulse email",
        html: `
          <p>Hi ${user.name ?? "there"},</p>
          <p>Please verify your email address to get started.</p>
          <p><a href="${url}">Verify Email</a></p>
        `,
      });
    },
  },

  // ─── Session config ─────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh every 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5-minute client cache
    },
  },

  // ─── Trusted origins ────────────────────────────────────────────────────
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    process.env.NEXT_PUBLIC_APP_URL!,
  ].filter(Boolean),

  // ─── User hooks ─────────────────────────────────────────────────────────
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "business_owner",
        input: false, // not user-settable
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

  // ─── Advanced ───────────────────────────────────────────────────────────
  advanced: {
    generateId: false, // use our own uuid default
    cookiePrefix: "gp",
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
