// src/db/index.ts
// Singleton Drizzle client — safe for Next.js hot reload in dev

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // Prevent multiple instances during hot reload
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 20 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
  });
}

const client =
  process.env.NODE_ENV === "production"
    ? createClient()
    : (global._pgClient ??= createClient());

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === "development" });

// ─── Convenience re-exports ──────────────────────────────────────────────────
export { schema };
export * from "./schema";
