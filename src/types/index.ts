// src/types/index.ts
// Shared TypeScript types used across the app

// ─── Re-export DB types ───────────────────────────────────────────────────────

export type {
  User,
  Business,
  Customer,
  ReviewRequest,
  Feedback,
  MessageLog,
  Subscription,
  MessageTemplate,
} from "@/db/schema";

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ─── Dashboard analytics ──────────────────────────────────────────────────────

export interface DashboardSummary {
  totalRequestsSent: number;
  totalPublicReviews: number;
  totalPrivateFeedback: number;
  averageRating: number;
  conversionRate: number;
}

export interface FunnelStats {
  sent: number;
  opened: number;
  publicReviews: number;
  privateFeedback: number;
}

export interface RatingBucket {
  rating: number;
  count: number;
  percentage: number;
}

export interface WeeklyTrendPoint {
  week: string;
  publicReviews: number;
  privateFeedback: number;
}

export interface ChannelStat {
  channel: "sms" | "email";
  sent: number;
  clicked: number;
  conversionRate: number;
}

// ─── Form state ───────────────────────────────────────────────────────────────

export interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  tags: string[];
}

export interface SendRequestForm {
  customerId: string;
  channel: "sms" | "email";
  templateId?: string;
  scheduledAt?: Date;
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

export type FunnelAction =
  | "redirect_public"
  | "show_feedback_form"
  | "already_submitted"
  | "expired"
  | "invalid";

export interface FunnelResult {
  action: FunnelAction;
  redirectUrl?: string;
  feedbackId?: string;
  businessName?: string;
}

// ─── User roles ───────────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "business_owner" | "staff";
export type Plan = "starter" | "pro" | "enterprise";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";
export type RequestChannel = "sms" | "email";
export type RequestStatus = "pending" | "sent" | "delivered" | "opened" | "clicked" | "failed" | "bounced";
export type FeedbackType = "public_review" | "private_feedback";

// ─── Session user (from BetterAuth) ──────────────────────────────────────────

export interface SessionUser {
  id: string;
  name?: string;
  email: string;
  image?: string;
  role: UserRole;
  businessId?: string;
  isSuspended: boolean;
  emailVerified: boolean;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminOverview {
  summary: {
    totalUsers: number;
    totalBusinesses: number;
    activeBusinesses: number;
    totalRequestsSent30d: number;
    totalReviews30d: number;
    mrr: number;
  };
  planBreakdown: Array<{ plan: Plan; status: SubscriptionStatus; count: number }>;
  planRevenue: Record<string, number>;
  recentFailedMessages: MessageLog[];
  topBusinesses: Array<{
    id: string;
    name: string;
    industry?: string;
    requests_sent: number;
    reviews: number;
    avg_rating?: number;
  }>;
}
