// src/db/schema.ts
// GenuinePulse — Full normalized multi-tenant schema
// ORM: Drizzle  |  DB: PostgreSQL (Supabase)

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "business_owner",
  "staff",
]);

export const planEnum = pgEnum("plan", ["starter", "pro", "enterprise"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
]);

export const requestChannelEnum = pgEnum("request_channel", ["sms", "email"]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "bounced",
]);

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "public_review", // rating >= threshold → sent to Google/Yelp
  "private_feedback", // rating < threshold → captured internally
]);

export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sending",
  "delivered",
  "failed",
  "retrying",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "login",
  "logout",
  "create",
  "update",
  "delete",
  "send_request",
  "suspend_account",
  "export_data",
]);

// ─────────────────────────────────────────────────────────────────────────────
// USERS  (BetterAuth manages auth; we extend with roles + business link)
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    emailVerified: boolean("email_verified").default(false),
    image: text("image"),
    role: userRoleEnum("role").default("business_owner").notNull(),
    businessId: text("business_id"), // FK set after businesses table
    isSuspended: boolean("is_suspended").default(false).notNull(),
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    businessIdx: index("users_business_idx").on(t.businessId),
    roleIdx: index("users_role_idx").on(t.role),
  }),
);

// BetterAuth required tables
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(t.token),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at"),
    password: text("password"), // hashed for email/password
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("accounts_user_idx").on(t.userId),
    providerIdx: index("accounts_provider_idx").on(t.providerId),
  }),
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESSES  (one per tenant)
// ─────────────────────────────────────────────────────────────────────────────

export const businesses = pgTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(), // URL-safe identifier
    industry: varchar("industry", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 500 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zipCode: varchar("zip_code", { length: 20 }),
    logoUrl: text("logo_url"),

    // Review funnel config
    positiveThreshold: integer("positive_threshold").default(4).notNull(), // >= this → public
    googleReviewUrl: text("google_review_url"),
    yelpReviewUrl: text("yelp_review_url"),
    facebookReviewUrl: text("facebook_review_url"),
    customReviewUrl: text("custom_review_url"),

    // Messaging config
    smsFromNumber: varchar("sms_from_number", { length: 20 }),
    emailFromAddress: varchar("email_from_address", { length: 255 }),
    emailFromName: varchar("email_from_name", { length: 255 }),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("businesses_slug_idx").on(t.slug),
    ownerIdx: index("businesses_owner_idx").on(t.ownerId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" })
      .unique(),
    plan: planEnum("plan").default("starter").notNull(),
    status: subscriptionStatusEnum("status").default("trialing").notNull(),

    // Limits per plan
    monthlySmsLimit: integer("monthly_sms_limit").default(500).notNull(),
    monthlyEmailLimit: integer("monthly_email_limit").default(2000).notNull(),

    // Usage this billing period
    smsSentThisPeriod: integer("sms_sent_this_period").default(0).notNull(),
    emailSentThisPeriod: integer("email_sent_this_period").default(0).notNull(),

    // Stripe (or manual billing)
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    trialEndsAt: timestamp("trial_ends_at"),
    canceledAt: timestamp("canceled_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    businessIdx: index("subscriptions_business_idx").on(t.businessId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS  (contacts per business)
// ─────────────────────────────────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    notes: text("notes"),
    tags: text("tags").array(), // ["vip", "repeat", "unhappy"]
    optedOut: boolean("opted_out").default(false).notNull(),
    optedOutAt: timestamp("opted_out_at"),
    optedOutChannel: requestChannelEnum("opted_out_channel"),

    // Aggregated stats (updated via triggers or background job)
    totalRequestsSent: integer("total_requests_sent").default(0).notNull(),
    totalReviewsLeft: integer("total_reviews_left").default(0).notNull(),
    lastRequestSentAt: timestamp("last_request_sent_at"),
    lastRating: integer("last_rating"),

    importedAt: timestamp("imported_at"), // null if manually added
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    businessIdx: index("customers_business_idx").on(t.businessId),
    emailIdx: index("customers_email_idx").on(t.email),
    phoneIdx: index("customers_phone_idx").on(t.phone),
    // Unique email per business
    uniqueEmailPerBusiness: uniqueIndex("customers_business_email_idx").on(
      t.businessId,
      t.email,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

export const reviewRequests = pgTable(
  "review_requests",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    sentById: text("sent_by_id").references(() => users.id), // who triggered it

    channel: requestChannelEnum("channel").notNull(),
    status: requestStatusEnum("status").default("pending").notNull(),

    // The short link token (e.g. /r/abc123)
    token: varchar("token", { length: 32 }).notNull(),

    // Delivery details
    sentTo: varchar("sent_to", { length: 255 }).notNull(), // phone or email
    templateId: text("template_id"), // FK to message_templates

    // Tracking
    deliveredAt: timestamp("delivered_at"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),

    // Provider IDs for status webhooks
    twilioSid: varchar("twilio_sid", { length: 100 }),
    resendId: varchar("resend_id", { length: 100 }),

    // Retry logic
    retryCount: integer("retry_count").default(0).notNull(),
    lastRetryAt: timestamp("last_retry_at"),
    failureReason: text("failure_reason"),

    scheduledAt: timestamp("scheduled_at"), // null = send immediately
    sentAt: timestamp("sent_at"),
    expiresAt: timestamp("expires_at"), // link expires after N days
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("review_requests_token_idx").on(t.token),
    businessIdx: index("review_requests_business_idx").on(t.businessId),
    customerIdx: index("review_requests_customer_idx").on(t.customerId),
    statusIdx: index("review_requests_status_idx").on(t.status),
    sentAtIdx: index("review_requests_sent_at_idx").on(t.sentAt),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK  (all responses — public redirects and private captures)
// ─────────────────────────────────────────────────────────────────────────────

export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    reviewRequestId: text("review_request_id").references(
      () => reviewRequests.id,
      { onDelete: "set null" },
    ),

    rating: integer("rating").notNull(), // 1–5
    type: feedbackTypeEnum("type").notNull(),
    // For private feedback: the written message
    message: text("message"),
    // For public reviews: which platform were they sent to
    reviewPlatform: varchar("review_platform", { length: 50 }), // "google"|"yelp"|"facebook"
    reviewPlatformUrl: text("review_platform_url"),

    // Resolution workflow for private feedback
    isResolved: boolean("is_resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedById: text("resolved_by_id").references(() => users.id),
    internalNote: text("internal_note"),

    // Metadata
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    businessIdx: index("feedback_business_idx").on(t.businessId),
    ratingIdx: index("feedback_rating_idx").on(t.rating),
    typeIdx: index("feedback_type_idx").on(t.type),
    submittedIdx: index("feedback_submitted_idx").on(t.submittedAt),
    requestIdx: index("feedback_request_idx").on(t.reviewRequestId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "cascade",
    }), // null = global default
    name: varchar("name", { length: 100 }).notNull(),
    channel: requestChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 255 }), // email only
    body: text("body").notNull(),
    // Available vars: {{first_name}}, {{business_name}}, {{review_link}}
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    businessIdx: index("templates_business_idx").on(t.businessId),
    channelIdx: index("templates_channel_idx").on(t.channel),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE LOGS  (raw delivery records from Twilio/Resend)
// ─────────────────────────────────────────────────────────────────────────────

export const messageLogs = pgTable(
  "message_logs",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    reviewRequestId: text("review_request_id").references(
      () => reviewRequests.id,
      { onDelete: "set null" },
    ),

    channel: requestChannelEnum("channel").notNull(),
    status: messageStatusEnum("status").notNull(),

    // Provider-specific
    provider: varchar("provider", { length: 50 }).notNull(), // "twilio"|"resend"
    providerId: varchar("provider_id", { length: 100 }), // Twilio SID / Resend ID
    providerStatus: varchar("provider_status", { length: 50 }),
    providerResponse: jsonb("provider_response"), // raw provider JSON

    // Message content snapshot
    toAddress: varchar("to_address", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }), // email
    bodyPreview: varchar("body_preview", { length: 200 }),

    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),
    failureCode: varchar("failure_code", { length: 50 }),
    failureMessage: text("failure_message"),

    // Retry tracking
    attemptNumber: integer("attempt_number").default(1).notNull(),
    isRetry: boolean("is_retry").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    businessIdx: index("message_logs_business_idx").on(t.businessId),
    statusIdx: index("message_logs_status_idx").on(t.status),
    sentAtIdx: index("message_logs_sent_at_idx").on(t.sentAt),
    providerIdx: index("message_logs_provider_idx").on(t.provider),
    requestIdx: index("message_logs_request_idx").on(t.reviewRequestId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    businessId: text("business_id").references(() => businesses.id, {
      onDelete: "set null",
    }),
    action: auditActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 50 }), // "customer"|"request"|"feedback"
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"), // contextual data
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("audit_logs_user_idx").on(t.userId),
    businessIdx: index("audit_logs_business_idx").on(t.businessId),
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
    actionIdx: index("audit_logs_action_idx").on(t.action),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  auditLogs: many(auditLogs),
}));

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, { fields: [businesses.ownerId], references: [users.id] }),
  subscription: one(subscriptions, {
    fields: [businesses.id],
    references: [subscriptions.businessId],
  }),
  customers: many(customers),
  reviewRequests: many(reviewRequests),
  feedback: many(feedback),
  templates: many(messageTemplates),
  messageLogs: many(messageLogs),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [customers.businessId],
    references: [businesses.id],
  }),
  reviewRequests: many(reviewRequests),
  feedback: many(feedback),
}));

export const reviewRequestsRelations = relations(
  reviewRequests,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [reviewRequests.businessId],
      references: [businesses.id],
    }),
    customer: one(customers, {
      fields: [reviewRequests.customerId],
      references: [customers.id],
    }),
    sentBy: one(users, {
      fields: [reviewRequests.sentById],
      references: [users.id],
    }),
    feedback: many(feedback),
    messageLogs: many(messageLogs),
  }),
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  business: one(businesses, {
    fields: [feedback.businessId],
    references: [businesses.id],
  }),
  customer: one(customers, {
    fields: [feedback.customerId],
    references: [customers.id],
  }),
  reviewRequest: one(reviewRequests, {
    fields: [feedback.reviewRequestId],
    references: [reviewRequests.id],
  }),
  resolvedBy: one(users, {
    fields: [feedback.resolvedById],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS  (inferred from schema)
// ─────────────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type NewReviewRequest = typeof reviewRequests.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type MessageLog = typeof messageLogs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
