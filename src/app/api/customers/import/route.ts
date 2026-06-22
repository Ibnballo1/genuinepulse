// src/app/api/customers/import/route.ts
// POST /api/customers/import — bulk CSV import

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBusinessContext, withErrorHandling } from "@/lib/api";
import { csvCustomerRowSchema } from "@/lib/validations";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user, businessId } = await getBusinessContext(req);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!file.name.endsWith(".csv")) {
    return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 5MB)" },
      { status: 400 },
    );
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return NextResponse.json(
      { error: "CSV must have a header and at least one row" },
      { status: 400 },
    );
  }

  // Parse header (case-insensitive)
  const headers = lines[0].split(",").map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z_]/g, "_"),
  );

  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as { row: number; reason: string }[],
  };

  const toInsert: (typeof customers.$inferInsert)[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? "";
    });

    // Validate
    const parsed = csvCustomerRowSchema.safeParse({
      first_name: row["first_name"] || row["firstname"] || row["name"] || "",
      last_name: row["last_name"] || row["lastname"] || "",
      email: row["email"] || "",
      phone: row["phone"] || row["mobile"] || row["cell"] || "",
    });

    if (!parsed.success) {
      results.errors.push({
        row: i + 1,
        reason: parsed.error.errors[0]?.message ?? "Invalid row",
      });
      results.skipped++;
      continue;
    }

    const { first_name, last_name, email, phone } = parsed.data;

    toInsert.push({
      id: crypto.randomUUID(),
      businessId,
      firstName: first_name,
      lastName: last_name || undefined,
      email: email ? email.toLowerCase() : undefined,
      phone: phone || undefined,
      importedAt: new Date(),
    });
  }

  // Batch insert with conflict handling (skip existing emails)
  if (toInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      await db.insert(customers).values(batch).onConflictDoNothing(); // skip duplicate emails per business
    }
    results.imported = toInsert.length;
  }

  return NextResponse.json({
    success: true,
    data: results,
  });
});

// RFC 4180 compliant CSV line parser
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
