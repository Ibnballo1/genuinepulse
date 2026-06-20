# GenuinePulse — Complete Implementation Guide

> Production-ready reputation management SaaS
> Stack: Next.js 14 · PostgreSQL/Supabase · Drizzle ORM · BetterAuth · Twilio · Resend · Vercel

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Phase 1 — Foundation Setup](#phase-1--foundation-setup)
3. [Phase 2 — Database & Schema](#phase-2--database--schema)
4. [Phase 3 — Authentication](#phase-3--authentication)
5. [Phase 4 — Core Features](#phase-4--core-features)
6. [Phase 5 — Integrations](#phase-5--integrations)
7. [Phase 6 — Analytics & Charts](#phase-6--analytics--charts)
8. [Phase 7 — Super Admin](#phase-7--super-admin)
9. [Phase 8 — Testing](#phase-8--testing)
10. [Phase 9 — Deployment to Vercel](#phase-9--deployment-to-vercel)
11. [Environment Variables Reference](#environment-variables-reference)
12. [API Reference](#api-reference)
13. [Architecture Decisions](#architecture-decisions)
14. [Security Checklist](#security-checklist)

---

## Project Structure

```
genuinepulse/
├── src/
│   ├── app/
│   │   ├── (auth)/               # Auth pages (sign-in, sign-up)
│   │   ├── api/
│   │   │   ├── auth/[...all]/    # BetterAuth handler
│   │   │   ├── analytics/        # Dashboard analytics
│   │   │   ├── admin/            # Super admin endpoints
│   │   │   │   ├── overview/     # Platform metrics
│   │   │   │   ├── businesses/   # Tenant management
│   │   │   │   ├── users/        # User management
│   │   │   │   └── logs/         # Message logs
│   │   │   ├── businesses/me/    # Current business CRUD
│   │   │   ├── customers/        # Customer CRUD + import
│   │   │   ├── feedback/         # Feedback list + resolve
│   │   │   ├── funnel/           # Public funnel endpoints
│   │   │   │   ├── rate/         # Rating submission
│   │   │   │   └── feedback/     # Private message capture
│   │   │   ├── onboarding/       # First-run setup
│   │   │   ├── review-requests/  # Send SMS/email
│   │   │   └── webhooks/         # Twilio + Resend webhooks
│   │   ├── dashboard/            # Authenticated pages
│   │   │   ├── analytics/
│   │   │   ├── customers/
│   │   │   ├── feedback/
│   │   │   ├── funnel/
│   │   │   ├── admin/
│   │   │   └── settings/
│   │   ├── onboarding/           # First-run wizard
│   │   ├── r/[token]/            # Public review funnel
│   │   ├── suspended/            # Account suspended
│   │   └── page.tsx              # Marketing landing page
│   ├── components/
│   │   ├── ui/                   # Primitives (Button, Modal, Table…)
│   │   ├── dashboard/            # Dashboard-specific widgets
│   │   └── providers/            # React Query, Toaster
│   ├── db/
│   │   ├── schema.ts             # Full Drizzle schema
│   │   ├── index.ts              # DB client singleton
│   │   └── seed.ts               # Dev seed data
│   ├── hooks/                    # useDebounce, usePagination…
│   ├── lib/
│   │   ├── api.ts                # requireAuth, apiSuccess, withErrorHandling
│   │   ├── auth.ts               # BetterAuth config
│   │   ├── auth-client.ts        # Client-side auth
│   │   ├── email.ts              # Resend service + templates
│   │   ├── funnel.ts             # Core funnel logic
│   │   ├── rate-limit.ts         # Upstash rate limiting
│   │   ├── sms.ts                # Twilio service + retry
│   │   ├── utils.ts              # cn, formatters
│   │   └── validations.ts        # Zod schemas
│   └── middleware.ts             # Auth guard + RBAC
├── tests/
│   ├── setup.ts                  # Vitest env setup
│   ├── unit/                     # Pure logic tests
│   └── api/                      # Route integration tests
├── drizzle/                      # Generated migrations
├── .env.local.example
├── drizzle.config.ts
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── vitest.config.ts
```

---

## Phase 1 — Foundation Setup

### 1.1 Create Next.js project

```bash
npx create-next-app@14 genuinepulse \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --no-eslint

cd genuinepulse
```

### 1.2 Install all dependencies

```bash
npm install \
  better-auth \
  drizzle-orm postgres \
  twilio resend \
  zod nanoid date-fns \
  recharts \
  @tanstack/react-query \
  react-hot-toast \
  lucide-react \
  clsx tailwind-merge \
  class-variance-authority \
  papaparse \
  @upstash/ratelimit @upstash/redis \
  server-only

npm install -D \
  drizzle-kit tsx dotenv \
  vitest @vitest/ui \
  @types/papaparse
```

### 1.3 Copy environment variables

```bash
cp .env.local.example .env.local
# Fill in all values — see Section 11
```

---

## Phase 2 — Database & Schema

### 2.1 Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `genuinepulse-prod`
3. Region: `us-east-1` (closest to your US users)
4. Copy the **Direct connection** string (not pooler) for migrations
5. Copy the **Transaction pooler** string for runtime

### 2.2 Run migrations

```bash
# Generate migration files from schema
npm run db:generate

# Apply to database
npm run db:migrate

# Open Drizzle Studio to inspect
npm run db:studio
```

### 2.3 Seed development data

```bash
npm run db:seed
```

This creates:
- `admin@genuinepulse.com` — super admin
- `james@donovanautodallas.com` — business owner with sample data
- 10 customers, review requests, and feedback with chart history

### 2.4 Key schema decisions

| Table | Key Design Choice |
|-------|------------------|
| `users` | Role enum: `super_admin`, `business_owner`, `staff`. `businessId` FK links to their tenant. |
| `businesses` | `positiveThreshold` (default: 4) drives the funnel routing. `slug` is URL-safe unique identifier. |
| `review_requests` | `token` is a nanoid(16) used in public URLs (`/r/[token]`). `expiresAt` is set 7 days out. |
| `feedback` | `type` enum: `public_review` vs `private_feedback` — this is the core funnel output. |
| `subscriptions` | Tracks `smsSentThisPeriod` / `monthlyEmailLimit` for usage-based enforcement. |
| `message_logs` | Raw delivery records from Twilio/Resend. Separate from `review_requests` for audit purposes. |

---

## Phase 3 — Authentication

### 3.1 BetterAuth setup

BetterAuth is configured in `src/lib/auth.ts` with:
- Email/password provider
- Session cookies (7-day expiry, 24h refresh)
- Custom additional fields: `role`, `businessId`, `isSuspended`

The catch-all route at `src/app/api/auth/[...all]/route.ts` handles all auth endpoints automatically.

### 3.2 Protected routes

The `src/middleware.ts` file runs on every request:

```
Public routes:     /, /sign-in, /sign-up, /r/*, /api/funnel/*, /api/webhooks/*
Admin-only routes: /admin/*, /api/admin/*
Authenticated:     Everything else → redirect to /sign-in
```

### 3.3 Server-side auth check

```typescript
// In any server component or API route:
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: headers() });
if (!session) redirect("/sign-in");
```

### 3.4 Client-side auth

```typescript
// In client components:
import { useSession, signOut } from "@/lib/auth-client";

const { data: session } = useSession();
```

### 3.5 Role-based access

```typescript
// In API routes:
import { requireSuperAdmin, requireAuth } from "@/lib/api";

const admin = await requireSuperAdmin(req);  // throws 403 if not super_admin
const user  = await requireAuth(req);         // throws 401 if not authenticated
```

---

## Phase 4 — Core Features

### 4.1 Review Funnel Logic (THE CORE)

Location: `src/lib/funnel.ts`

```
Customer clicks /r/[token]
  ↓
resolveFunnelToken(token) — checks expiry, idempotency
  ↓
handleRating({ token, rating })
  ↓
  IF rating >= business.positiveThreshold (default: 4)
    → Insert feedback (type: "public_review")
    → Update customer stats
    → Return { action: "redirect_public", redirectUrl: googleUrl }
  ELSE
    → Insert feedback (type: "private_feedback", no message yet)
    → Return { action: "show_feedback_form", feedbackId }
  ↓
handlePrivateFeedback(feedbackId, message)
  → Update feedback.message
  → (Optional) notify business owner
```

### 4.2 Sending Review Requests

**Single request** — `POST /api/review-requests`:
1. Validate customer + business exist
2. Check customer hasn't opted out
3. Enforce SMS/email monthly limits
4. Generate nanoid(16) token
5. Insert review_request record
6. Load template (custom or default)
7. Call `sendSmsWithRetry()` or `sendEmailWithRetry()`
8. Increment usage counter

**Retry logic** (3 attempts):
- SMS: 0s → 30s → 2min
- Email: 0s → 15s → 1min
- Permanent errors (invalid number, bounce) skip retry

### 4.3 CSV Import

`POST /api/customers/import` (multipart/form-data):
- Parses RFC 4180 CSV
- Validates each row with Zod
- Batch inserts 100 rows at a time
- `onConflictDoNothing()` skips existing emails per business

---

## Phase 5 — Integrations

### 5.1 Twilio SMS

**Setup:**
1. Create account at [twilio.com](https://twilio.com)
2. Buy a US phone number (~$1.15/mo)
3. Note your Account SID and Auth Token
4. For webhooks: Configure the phone number's "A message comes in" webhook to `https://yourdomain.com/api/webhooks/twilio`

**Opt-out handling:**
Customers who reply STOP are automatically opted out via the inbound webhook at `POST /api/webhooks/twilio`. The `isOptOutMessage()` function checks for: STOP, UNSUBSCRIBE, CANCEL, QUIT, END.

**TCPA compliance note:**
Only send messages to customers who have given explicit consent. Log all opt-outs. Never send after opt-out.

### 5.2 Resend Email

**Setup:**
1. Create account at [resend.com](https://resend.com)
2. Verify your domain (add DNS records)
3. Generate an API key
4. For webhooks: Configure in Resend dashboard → Webhooks → your endpoint URL

**Webhook secret verification:**
The `POST /api/webhooks/resend` handler verifies Svix signatures in production to prevent spoofing.

### 5.3 Rate Limiting (Upstash Redis)

**Setup:**
1. Create a Redis database at [console.upstash.com](https://console.upstash.com)
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

**Limits configured:**
| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| SMS send | 10/business/IP | 1 min | Prevent spam |
| Email send | 30/business/IP | 1 min | Prevent spam |
| Login | 5/IP | 15 min | Brute force prevention |
| Feedback form | 3/IP | 1 hour | Prevent fake submissions |
| General API | 100/user | 1 min | General protection |

---

## Phase 6 — Analytics & Charts

Charts are built with **Recharts** and use server-side SQL aggregation.

### Weekly trend query

```sql
SELECT
  TO_CHAR(DATE_TRUNC('week', submitted_at), 'Mon DD') AS week,
  COUNT(*) FILTER (WHERE type = 'public_review') AS public_reviews,
  COUNT(*) FILTER (WHERE type = 'private_feedback') AS private_feedback
FROM feedback
WHERE business_id = $1 AND submitted_at >= NOW() - INTERVAL '56 days'
GROUP BY DATE_TRUNC('week', submitted_at)
ORDER BY DATE_TRUNC('week', submitted_at)
```

### Dashboard metrics computed:
- **Conversion rate** = public reviews / requests sent × 100
- **% change** = (current - prev) / prev × 100
- **Rating distribution** = GROUP BY rating with % of total
- **Funnel drop-off** = sent → opened → clicked → reviewed vs private

---

## Phase 7 — Super Admin

The super admin dashboard at `/dashboard/admin` is only accessible when `user.role === "super_admin"`.

### Platform metrics endpoint: `GET /api/admin/overview`

Returns:
- Total users, businesses, active businesses
- Messages sent (30d), reviews generated (30d)
- MRR by plan
- Top 10 businesses by review volume
- System health (placeholder — wire to real uptime monitors)
- Recent failed messages

### Tenant management: `GET /api/admin/businesses`

Returns all tenants with owner info, plan, usage stats.

### Suspend user: `POST /api/admin/users/[id]/suspend`

Requires `reason` field. Creates audit log entry. Middleware blocks suspended users immediately.

### Update plan: `PATCH /api/admin/businesses/[id]/plan`

Changes plan + automatically adjusts SMS/email limits.

---

## Phase 8 — Testing

### Run all tests

```bash
npm test                # Run once
npm run test:ui         # Interactive UI
npx vitest --coverage   # With coverage report
```

### Test structure

```
tests/
├── setup.ts              # Env vars, console mocking
├── unit/
│   ├── funnel.test.ts    # generateToken, pickPlatform, detectPlatform, normalizePhone
│   └── validations.test.ts  # Zod schema edge cases
└── api/
    └── review-requests.test.ts  # Full route tests with mocked DB
```

### Adding tests

```typescript
// Mocking the DB for API tests:
vi.mock("@/db", () => ({
  db: {
    query: { businesses: { findFirst: vi.fn().mockResolvedValue({...}) } },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
    })}),
  },
}));
```

---

## Phase 9 — Deployment to Vercel

### 9.1 Push to GitHub

```bash
git init
git add .
git commit -m "feat: initial GenuinePulse setup"
git remote add origin https://github.com/yourusername/genuinepulse.git
git push -u origin main
```

### 9.2 Create Vercel project

```bash
npx vercel
# Follow prompts, link to your GitHub repo
```

### 9.3 Set environment variables in Vercel

Go to Vercel Dashboard → Project → Settings → Environment Variables and add all variables from `.env.local.example`.

**Use separate values for Preview vs Production:**
- `DATABASE_URL` — use Supabase Transaction Pooler in prod, Direct connection for migrations
- `BETTER_AUTH_URL` — must match your actual production domain
- `NEXT_PUBLIC_APP_URL` — must match your actual production domain

### 9.4 Configure webhooks for production

After deploying, update:
- Twilio → Phone Number → Webhook URL: `https://yourdomain.com/api/webhooks/twilio`
- Resend → Webhooks → URL: `https://yourdomain.com/api/webhooks/resend`
- Add `RESEND_WEBHOOK_SECRET` from Resend dashboard to Vercel env vars

### 9.5 Run production migration

```bash
# Uses DATABASE_URL from .env.local (direct connection, not pooler)
npm run db:migrate
```

### 9.6 Custom domain

1. Vercel → Domains → Add `genuinepulse.com`
2. Update DNS at your registrar
3. Update `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` env vars
4. Redeploy

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Supabase Direct) |
| `BETTER_AUTH_SECRET` | ✅ | 32+ char random secret for session signing |
| `BETTER_AUTH_URL` | ✅ | Your app's full URL (e.g. https://app.genuinepulse.com) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same as above, exposed to client |
| `TWILIO_ACCOUNT_SID` | ✅ | From Twilio Console |
| `TWILIO_AUTH_TOKEN` | ✅ | From Twilio Console |
| `TWILIO_FROM_NUMBER` | ✅ | E.164 format: +15551234567 |
| `RESEND_API_KEY` | ✅ | From Resend Dashboard |
| `RESEND_FROM_EMAIL` | ✅ | Verified email address |
| `RESEND_FROM_NAME` | ✅ | Sender display name |
| `RESEND_WEBHOOK_SECRET` | ⚠️ Prod | For verifying Resend webhook signatures |
| `UPSTASH_REDIS_REST_URL` | ✅ | For rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | For rate limiting |

---

## API Reference

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/*` | BetterAuth handlers |
| `GET`  | `/api/auth/session` | Get current session |
| `POST` | `/api/funnel/rate` | Submit star rating |
| `POST` | `/api/funnel/feedback` | Submit private message |
| `POST` | `/api/webhooks/twilio` | Twilio status + opt-out |
| `POST` | `/api/webhooks/resend` | Resend email events |
| `POST` | `/api/onboarding` | Complete first-run setup |

### Authenticated (business owner)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/businesses/me` | Get own business |
| `PATCH`| `/api/businesses/me` | Update settings |
| `GET`  | `/api/analytics` | Dashboard metrics |
| `GET`  | `/api/customers` | List customers (paginated) |
| `POST` | `/api/customers` | Add customer |
| `POST` | `/api/customers/import` | CSV bulk import |
| `GET`  | `/api/review-requests` | List requests |
| `POST` | `/api/review-requests` | Send request |
| `GET`  | `/api/feedback` | List feedback |
| `POST` | `/api/feedback/[id]/resolve` | Mark resolved |

### Super Admin only

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/admin/overview` | Platform metrics |
| `GET`  | `/api/admin/businesses` | All tenants |
| `PATCH`| `/api/admin/businesses/[id]/plan` | Update plan |
| `GET`  | `/api/admin/logs` | Message logs |
| `POST` | `/api/admin/users/[id]/suspend` | Suspend user |
| `DELETE`| `/api/admin/users/[id]/suspend` | Reinstate user |

---

## Architecture Decisions

### Why Drizzle ORM?
Type-safe queries with full SQL control. Migrations are plain SQL files checked into git. No "magic" that hides N+1 queries.

### Why BetterAuth vs NextAuth?
BetterAuth supports custom DB adapters (Drizzle) natively, has built-in session management, and doesn't require the provider-centric mindset. Simpler for email/password + RBAC.

### Why separate `feedback` from `review_requests`?
A request can be sent but never responded to. Feedback only exists when the customer actually clicks and rates. This separation makes analytics clean — you can count requests vs actual responses independently.

### Why store `positiveThreshold` per business?
Different industries have different expectations. A restaurant might want 4+ to go public; a luxury hotel might want 5-only. This is a key selling point.

### Why not use Supabase Auth?
The spec says "DB only, NOT auth." BetterAuth with a Drizzle adapter gives us full ownership of the auth tables and custom role logic without being locked into Supabase's auth system.

### Why Upstash Redis for rate limiting?
Vercel runs on edge functions that are stateless. You cannot use in-memory rate limiting. Upstash Redis is serverless, has a free tier, and the `@upstash/ratelimit` SDK is purpose-built for this pattern.

---

## Security Checklist

- [x] All dashboard routes protected by `middleware.ts` auth guard
- [x] Suspended users blocked at middleware before any route logic
- [x] Super admin endpoints check `role === "super_admin"` explicitly
- [x] Business owners can only access their own `businessId` data
- [x] All user inputs validated with Zod before DB insertion
- [x] SMS rate limited per business per IP (10/min)
- [x] Feedback form rate limited per IP (3/hour)
- [x] Twilio opt-out keywords handled automatically
- [x] Resend webhook signatures verified in production
- [x] Tokens use `nanoid(16)` — URL-safe, cryptographically random
- [x] Review links expire after 7 days
- [x] Idempotency check on funnel — no duplicate feedback from same request
- [x] Passwords must meet complexity requirements (8+ chars, uppercase, number)
- [x] API errors return generic messages in production (no stack traces)
- [x] `auditLogs` table records all sensitive admin actions
- [ ] TODO: Add CSRF protection for state-changing API routes
- [ ] TODO: Add CSP headers in next.config.mjs
- [ ] TODO: Set up Sentry for error monitoring
- [ ] TODO: Add Stripe webhook signature verification when billing is live

---

## Common Tasks

### Add a new dashboard page

1. Create `src/app/dashboard/[pagename]/page.tsx`
2. Add nav item in `src/components/dashboard/Sidebar.tsx` NAV array
3. Add page title in `src/components/dashboard/Topbar.tsx` PAGE_TITLES

### Add a new API endpoint

1. Create `src/app/api/[resource]/route.ts`
2. Use `withErrorHandling()` wrapper
3. Call `requireAuth()` or `requireSuperAdmin()`
4. Validate body with `validateBody(req, yourZodSchema)`
5. Return `apiSuccess(data)` or `paginatedResponse(...)`

### Add a Zod validation schema

1. Add to `src/lib/validations.ts`
2. Export the type: `export type YourInput = z.infer<typeof yourSchema>`
3. Use in API route: `const body = await validateBody(req, yourSchema)`

### Send a custom notification email

```typescript
import { sendEmail } from "@/lib/email";

await sendEmail({
  to: "customer@email.com",
  subject: "Your feedback was received",
  html: "<p>Thank you for your feedback!</p>",
  businessId: "biz-uuid",
});
```

---

*Built with ❤️ for US service businesses.*
*GenuinePulse — Turn every customer into a 5-star review.*
