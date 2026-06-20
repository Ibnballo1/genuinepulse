// src/lib/auth-edge.ts
import { betterAuth } from "better-auth";

export const authEdge = betterAuth({
  // DO NOT pass the database adapter here! Keep it database-free.

  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    process.env.NEXT_PUBLIC_APP_URL!,
  ].filter(Boolean),

  advanced: {
    cookiePrefix: "gp",
  },
});
