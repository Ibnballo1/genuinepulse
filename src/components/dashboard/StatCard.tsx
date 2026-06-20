// src/components/dashboard/StatCard.tsx

import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  suffix?: string;
  change?: number | null;
  changeInvert?: boolean; // for metrics where down is good (e.g. private feedback)
  icon: ReactNode;
  iconBg: string;
  period?: string;
}

export default function StatCard({
  label, value, suffix, change, changeInvert = false,
  icon, iconBg, period = "vs last period",
}: Props) {
  const isPositive = changeInvert ? (change ?? 0) < 0 : (change ?? 0) > 0;
  const isNegative = changeInvert ? (change ?? 0) > 0 : (change ?? 0) < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg)}>
          {icon}
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</span>
        {suffix && <span className="text-sm text-gray-400 font-normal">{suffix}</span>}
      </div>

      {change !== null && change !== undefined && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-medium",
          isPositive && "text-emerald-600",
          isNegative && "text-red-500",
          !isPositive && !isNegative && "text-gray-400",
        )}>
          {isPositive && <TrendingUp size={12} />}
          {isNegative && <TrendingDown size={12} />}
          <span>
            {change > 0 ? "+" : ""}{change}% {period}
          </span>
        </div>
      )}
    </div>
  );
}
