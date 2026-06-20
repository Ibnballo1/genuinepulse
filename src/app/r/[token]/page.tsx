// src/app/r/[token]/page.tsx
// Public review funnel page — no auth required
// Route: /r/[token]

import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { reviewRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import ReviewFunnelClient from "./ReviewFunnelClient";

interface Props {
  params: { token: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.token, params.token),
    with: { business: true },
  });

  if (!request) return { title: "Review Request | GenuinePulse" };

  return {
    title: `How was your experience at ${request.business.name}?`,
    description: `Share your feedback with ${request.business.name}`,
    robots: { index: false, follow: false }, // don't index funnel pages
  };
}

export default async function ReviewFunnelPage({ params }: Props) {
  const request = await db.query.reviewRequests.findFirst({
    where: eq(reviewRequests.token, params.token),
    with: { business: true, customer: true },
  });

  if (!request) notFound();

  // Expired
  if (request.expiresAt && request.expiresAt < new Date()) {
    return (
      <FunnelShell>
        <div className="text-center py-12">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">This link has expired</h2>
          <p className="text-gray-500 text-sm">Review links are valid for 7 days.</p>
        </div>
      </FunnelShell>
    );
  }

  return (
    <ReviewFunnelClient
      token={params.token}
      businessName={request.business.name}
      logoUrl={request.business.logoUrl ?? undefined}
      customerFirstName={request.customer.firstName}
      positiveThreshold={request.business.positiveThreshold}
    />
  );
}

function FunnelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
