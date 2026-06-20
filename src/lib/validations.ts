// src/lib/validations.ts
// Zod schemas — single source of truth for all input validation

import { z } from "zod";

// ─── Shared primitives ────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid("Invalid ID format");

export const phoneSchema = z
  .string()
  .min(7)
  .max(20)
  .regex(/^[+\d\s\-().]+$/, "Invalid phone number");

export const emailSchema = z.string().email("Invalid email address").max(255);

export const ratingSchema = z
  .number()
  .int()
  .min(1, "Rating must be at least 1")
  .max(5, "Rating must be at most 5");

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  name: z.string().min(2).max(100),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  businessName: z.string().min(2).max(255),
  industry: z.string().max(100).optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

// ─── Business ─────────────────────────────────────────────────────────────────

export const updateBusinessSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  industry: z.string().max(100).optional(),
  phone: phoneSchema.optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  googleReviewUrl: z.string().url().optional().nullable(),
  yelpReviewUrl: z.string().url().optional().nullable(),
  facebookReviewUrl: z.string().url().optional().nullable(),
  positiveThreshold: z.number().int().min(1).max(5).optional(),
  emailFromAddress: emailSchema.optional(),
  emailFromName: z.string().max(100).optional(),
});

// ─── Customers ────────────────────────────────────────────────────────────────

export const createCustomerSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().max(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: "Customer must have at least an email or phone number",
  });

export const updateCustomerSchema = z
  .object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().max(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: "Customer must have at least an email or phone number",
  });

export const csvCustomerRowSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
  })
  .refine((r) => r.email || r.phone, {
    message: "Row must have email or phone",
  });

// ─── Review Requests ──────────────────────────────────────────────────────────

export const sendReviewRequestSchema = z.object({
  customerId: uuidSchema,
  channel: z.enum(["sms", "email"]),
  templateId: uuidSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
});

export const bulkSendRequestSchema = z.object({
  customerIds: z.array(uuidSchema).min(1).max(500),
  channel: z.enum(["sms", "email"]),
  templateId: uuidSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
});

// ─── Funnel ───────────────────────────────────────────────────────────────────

export const submitRatingSchema = z.object({
  token: z.string().min(8).max(64),
  rating: ratingSchema,
});

export const submitFeedbackSchema = z.object({
  feedbackId: uuidSchema,
  message: z
    .string()
    .min(1, "Feedback message cannot be empty")
    .max(5000, "Feedback is too long"),
});

// ─── Templates ────────────────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.enum(["sms", "email"]),
  subject: z.string().max(255).optional(),
  body: z
    .string()
    .min(10, "Template body is too short")
    .max(2000)
    .refine(
      (b) => b.includes("{{review_link}}"),
      "Template must include {{review_link}}",
    ),
  isDefault: z.boolean().optional(),
});

// ─── Feedback filters ─────────────────────────────────────────────────────────

export const feedbackQuerySchema = z.object({
  type: z.enum(["public_review", "private_feedback", "all"]).optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  isResolved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// ─── Super admin ──────────────────────────────────────────────────────────────

export const suspendUserSchema = z.object({
  userId: uuidSchema,
  reason: z.string().min(1).max(500),
});

export const updatePlanSchema = z.object({
  businessId: uuidSchema,
  plan: z.enum(["starter", "pro", "enterprise"]),
  monthlySmsLimit: z.number().int().min(0).optional(),
  monthlyEmailLimit: z.number().int().min(0).optional(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type SignUpInput = z.infer<typeof signUpSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type SendReviewRequestInput = z.infer<typeof sendReviewRequestSchema>;
export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;
