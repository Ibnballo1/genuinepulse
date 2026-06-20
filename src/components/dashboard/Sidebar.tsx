"use client";
// src/components/dashboard/Sidebar.tsx

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BarChart2, Users, Send, MessageSquare,
  GitBranch, ShieldCheck, Settings, ChevronDown, Zap,
} from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/dashboard",           label: "Dashboard",        icon: <LayoutDashboard size={15} /> },
      { href: "/dashboard/analytics", label: "Analytics",        icon: <BarChart2 size={15} /> },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/dashboard/customers", label: "Customers",        icon: <Users size={15} /> },
      { href: "/dashboard/requests",  label: "Review Requests",  icon: <Send size={15} /> },
      { href: "/dashboard/feedback",  label: "Feedback",         icon: <MessageSquare size={15} /> },
      { href: "/dashboard/funnel",    label: "Review Funnel",    icon: <GitBranch size={15} /> },
    ],
  },
  {
    section: "Platform",
    items: [
      { href: "/dashboard/admin",    label: "Super Admin",   icon: <ShieldCheck size={15} />, adminOnly: true },
      { href: "/dashboard/settings", label: "Settings",      icon: <Settings size={15} /> },
    ],
  },
];

interface Props {
  user: { name?: string; email?: string; role?: string };
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  const initials = (user.name ?? user.email ?? "?")
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="w-[220px] flex-shrink-0 bg-gray-950 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="text-white text-[15px] font-semibold tracking-tight">GenuinePulse</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {NAV.map(({ section, items }) => {
          const visibleItems = items.filter(
            (i) => !i.adminOnly || user.role === "super_admin"
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section}>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest px-2 mb-1">
                {section}
              </p>
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all group mb-0.5",
                    isActive(item.href)
                      ? "bg-blue-600/20 text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]"
                  )}
                >
                  <span className={cn("flex-shrink-0", isActive(item.href) ? "text-blue-400" : "text-gray-500 group-hover:text-gray-400")}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-white/[0.06]">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors group"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[12px] font-medium text-gray-300 truncate">{user.name ?? "User"}</p>
            <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
          </div>
          <ChevronDown size={12} className="text-gray-500 group-hover:text-gray-400 flex-shrink-0" />
        </button>
      </div>
    </aside>
  );
}
