// src/db/seed.ts
// Development seed — run with: npm run db:seed

import { db } from "./index";
import { randomUUID } from "crypto";
import {
  users, businesses, subscriptions, customers,
  reviewRequests, feedback, messageTemplates,
} from "./schema";
import { generateReviewToken } from "../lib/funnel";
import { subDays } from "date-fns";

async function seed() {
  console.log("🌱 Seeding database…");

  // ─── Super admin ─────────────────────────────────────────────────────
  const [admin] = await db.insert(users).values({
    id: randomUUID(),
    email: "admin@genuinepulse.com",
    name: "Super Admin",
    role: "super_admin",
    emailVerified: true,
  }).returning().onConflictDoNothing();

  // ─── Business owner ───────────────────────────────────────────────────
  const [owner] = await db.insert(users).values({
    id: randomUUID(),
    email: "james@donovan.auto",
    name: "James Donovan",
    role: "business_owner",
    emailVerified: true,
  }).returning().onConflictDoNothing();

  // ─── Business ─────────────────────────────────────────────────────────
  const [business] = await db.insert(businesses).values({
    ownerId: owner?.id ?? admin.id,
    name: "Donovan Auto Group",
    slug: "donovan-auto-group",
    industry: "Auto Dealership",
    city: "Dallas",
    state: "TX",
    positiveThreshold: 4,
    googleReviewUrl: "https://g.page/r/donovan-auto-group/review",
    yelpReviewUrl: "https://yelp.com/biz/donovan-auto-group",
  }).returning();

  // Link user to business
  await db.update(users).set({ businessId: business.id });

  // ─── Subscription ─────────────────────────────────────────────────────
  await db.insert(subscriptions).values({
    businessId: business.id,
    plan: "pro",
    status: "active",
    monthlySmsLimit: 2500,
    monthlyEmailLimit: 10000,
    smsSentThisPeriod: 184,
    emailSentThisPeriod: 1100,
  });

  // ─── Message templates ────────────────────────────────────────────────
  const messageTemplateData: Array<{
    businessId: string;
    name: string;
    channel: "email" | "sms";
    subject?: string;
    body: string;
    isDefault: boolean;
  }> = [
    {
      businessId: business.id,
      name: "Standard Email Request",
      channel: "email",
      subject: "How was your experience at {{business_name}}?",
      body: `<p>Hi {{first_name}},</p><p>Thank you for visiting {{business_name}}. We'd love your feedback!</p><p><a href="{{review_link}}">Share Your Experience</a></p>`,
      isDefault: true,
    },
    {
      businessId: business.id,
      name: "Standard SMS Request",
      channel: "sms",
      body: "Hi {{first_name}}! Thanks for visiting {{business_name}}. Leave a quick review: {{review_link}} (Reply STOP to opt out)",
      isDefault: true,
    },
  ];

  await db.insert(messageTemplates).values(messageTemplateData);

  // ─── Customers ────────────────────────────────────────────────────────
  const customerData = [
    { firstName: "Maria",  lastName: "Thompson",  email: "maria.t@gmail.com",      phone: "+12145550191", totalReviewsLeft: 3, lastRating: 5 },
    { firstName: "Carlos", lastName: "Ruiz",       email: "c.ruiz@outlook.com",     phone: "+12145550182", totalReviewsLeft: 0, lastRating: 3 },
    { firstName: "Sarah",  lastName: "Mitchell",   email: "sarah.m@icloud.com",     phone: "+14695550156", totalReviewsLeft: 2, lastRating: 4 },
    { firstName: "James",  lastName: "Okafor",     phone: "+14695550114", totalReviewsLeft: 0, lastRating: null },
    { firstName: "Priya",  lastName: "Sharma",     email: "priya.s@gmail.com",      phone: "+19725550145", totalReviewsLeft: 4, lastRating: 5 },
    { firstName: "Derek",  lastName: "Walsh",      email: "derek.w@yahoo.com",      phone: "+14695550099", totalReviewsLeft: 0, lastRating: null },
    { firstName: "Lisa",   lastName: "Park",       email: "lisa.park@gmail.com",    totalReviewsLeft: 1, lastRating: 5 },
    { firstName: "Tom",    lastName: "Rivera",     email: "t.rivera@company.com",   phone: "+12145550211", totalReviewsLeft: 1, lastRating: 4 },
  ];

  const createdCustomers = await db.insert(customers).values(
    customerData.map((c) => ({
      businessId: business.id,
      ...c,
      totalRequestsSent: (c.totalReviewsLeft ?? 0) + 1,
      lastRequestSentAt: subDays(new Date(), Math.floor(Math.random() * 30)),
    }))
  ).returning();

  // ─── Review requests + feedback ───────────────────────────────────────
  const requestsData = [
    { cIdx: 0, channel: "email" as const, status: "clicked" as const, daysAgo: 0 },
    { cIdx: 1, channel: "sms"   as const, status: "clicked" as const, daysAgo: 0 },
    { cIdx: 2, channel: "email" as const, status: "clicked" as const, daysAgo: 1 },
    { cIdx: 3, channel: "sms"   as const, status: "delivered" as const, daysAgo: 1 },
    { cIdx: 4, channel: "email" as const, status: "clicked" as const, daysAgo: 2 },
    { cIdx: 5, channel: "sms"   as const, status: "failed" as const, daysAgo: 2 },
  ];

  for (const r of requestsData) {
    const customer = createdCustomers[r.cIdx];
    const token = generateReviewToken();
    const [req] = await db.insert(reviewRequests).values({
      businessId: business.id,
      customerId: customer.id,
      channel: r.channel,
      status: r.status,
      token,
      sentTo: r.channel === "email" ? customer.email! : customer.phone!,
      sentAt: subDays(new Date(), r.daysAgo),
      createdAt: subDays(new Date(), r.daysAgo),
      expiresAt: subDays(new Date(), r.daysAgo - 7),
    }).returning();

    // Add feedback for clicked requests
    if (r.status === "clicked" && customer.lastRating) {
      const isPublic = customer.lastRating >= 4;
      await db.insert(feedback).values({
        businessId: business.id,
        customerId: customer.id,
        reviewRequestId: req.id,
        rating: customer.lastRating,
        type: isPublic ? "public_review" : "private_feedback",
        reviewPlatform: isPublic ? "google" : undefined,
        reviewPlatformUrl: isPublic ? "https://g.page/r/donovan-auto-group/review" : undefined,
        message: isPublic ? undefined : "The wait time was longer than expected and nobody came to greet me.",
        submittedAt: subDays(new Date(), r.daysAgo),
      });
    }
  }

  // ─── Historical feedback (for charts) ────────────────────────────────
  const historicalRatings = [5,5,5,4,5,4,5,3,5,5,4,5,5,2,5,4,5,5,5,4,5,5,1,5,5,4,5,5,5,4];
  for (let i = 0; i < historicalRatings.length; i++) {
    const rating = historicalRatings[i];
    await db.insert(feedback).values({
      businessId: business.id,
      rating,
      type: rating >= 4 ? "public_review" : "private_feedback",
      reviewPlatform: rating >= 4 ? "google" : undefined,
      submittedAt: subDays(new Date(), i + 3),
    });
  }

  console.log("✅ Seed complete!");
  console.log("   Business:", business.name);
  console.log("   Customers:", createdCustomers.length);
  console.log("   Admin:", admin?.email ?? owner?.email);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
