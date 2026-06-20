"use client";
// src/components/dashboard/Topbar.tsx

import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard":            { title: "Dashboard",       sub: "Overview of your reputation performance" },
  "/dashboard/analytics":  { title: "Analytics",       sub: "Detailed metrics and trends" },
  "/dashboard/customers":  { title: "Customers",       sub: "Manage your customer contacts" },
  "/dashboard/requests":   { title: "Review Requests", sub: "Send and track review requests" },
  "/dashboard/feedback":   { title: "Feedback",        sub: "All reviews and private feedback" },
  "/dashboard/funnel":     { title: "Review Funnel",   sub: "Smart redirect configuration" },
  "/dashboard/admin":      { title: "Super Admin",     sub: "Platform-wide management" },
  "/dashboard/settings":   { title: "Settings",        sub: "Account, integrations, and billing" },
};

interface Props { user: { name?: string } }

export default function Topbar({ user }: Props) {
  const pathname = usePathname();
  // Match longest prefix
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  const page = PAGE_TITLES[match] ?? { title: "GenuinePulse", sub: "" };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-10">
      <div>
        <h1 className="text-[15px] font-semibold text-gray-900">{page.title}</h1>
        {page.sub && <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{page.sub}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <Search size={14} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors relative">
          <Bell size={14} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
