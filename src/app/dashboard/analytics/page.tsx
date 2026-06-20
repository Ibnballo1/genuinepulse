"use client";
// src/app/dashboard/analytics/page.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, Star, MessageSquare, Send, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, Spinner, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const COLORS = {
  blue: "#2563eb", green: "#059669", amber: "#d97706",
  red: "#dc2626", violet: "#7c3aed", sky: "#0284c7",
};

const PIE_COLORS = [COLORS.blue, COLORS.green, COLORS.amber, "#f97316", COLORS.red];

function MetricCard({ label, value, suffix, change, color }: {
  label: string; value: string; suffix?: string;
  change?: number | null; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
        {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </div>
      {change != null && (
        <p className={cn("text-xs font-medium", change >= 0 ? "text-emerald-600" : "text-red-500")}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last period
        </p>
      )}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-gray-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  // We build analytics from the same business analytics API
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      // For client-side we derive businessId from session
      const res = await fetch(`/api/analytics?days=${days}`);
      return res.json();
    },
    staleTime: 60_000,
  });

  const analytics = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={24} />
      </div>
    );
  }

  // Build rating distribution for pie chart
  const ratingData = analytics?.ratingDistribution?.map((r: any) => ({
    name: `${r.rating}★`,
    value: r.count,
    pct: r.percentage,
  })) ?? [];

  // Weekly trend
  const trendData = analytics?.weeklyTrend ?? [];

  // Channel stats
  const channelData = analytics?.channelStats ?? [];

  // Best send times (static guidance — real data would require event timestamps)
  const sendTimes = [
    { time: "Tue–Thu 2–4pm", label: "Highest CTR", variant: "green" as const },
    { time: "Mon 9–11am",    label: "Good",         variant: "blue" as const  },
    { time: "Weekday eve",   label: "Average",      variant: "gray" as const  },
    { time: "Weekends",      label: "Low",          variant: "amber" as const },
  ];

  return (
    <div className="p-6 max-w-[1400px] space-y-6">
      {/* Header + range picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-400">Detailed performance metrics</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                days === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Conversion Rate"
          value={`${analytics?.summary?.conversionRate ?? 0}%`}
          change={null}
        />
        <MetricCard
          label="Avg. Rating"
          value={analytics?.summary?.averageRating?.toFixed(1) ?? "—"}
          suffix="/ 5.0"
          change={null}
        />
        <MetricCard
          label="Reviews Generated"
          value={(analytics?.summary?.totalPublicReviews ?? 0).toLocaleString()}
          change={null}
        />
        <MetricCard
          label="Requests Sent"
          value={(analytics?.summary?.totalRequestsSent ?? 0).toLocaleString()}
          change={null}
        />
      </div>

      {/* Review trend chart */}
      <Card noPadding>
        <div className="p-5 border-b border-gray-100">
          <CardTitle sub="Public reviews vs private feedback per week">Weekly Review Volume</CardTitle>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barGap={2} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="publicReviews" name="Public Reviews" fill={COLORS.blue} radius={[3,3,0,0]} />
              <Bar dataKey="privateFeedback" name="Private Feedback" fill={COLORS.amber} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Two-col row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Rating distribution pie */}
        <Card noPadding>
          <div className="p-5 border-b border-gray-100">
            <CardTitle sub="All-time rating breakdown">Rating Distribution</CardTitle>
          </div>
          <div className="p-5 flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={ratingData}
                  cx="50%" cy="50%"
                  innerRadius={40} outerRadius={64}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {ratingData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: any, n: any) => [`${v} responses`, n]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {ratingData.map((r: any, i: number) => (
                <div key={r.name} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-7">{r.name}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${r.pct}%`, background: PIE_COLORS[i] }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-8 text-right">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Channel performance */}
        <Card noPadding>
          <div className="p-5 border-b border-gray-100">
            <CardTitle sub="Conversion by channel">Channel Performance</CardTitle>
          </div>
          <div className="p-5 space-y-5">
            {channelData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No channel data yet</p>
            ) : channelData.map((c: any) => (
              <div key={c.channel}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-gray-700 capitalize">{c.channel}</span>
                  <span className="text-gray-500">{c.conversionRate}% conversion · {c.sent.toLocaleString()} sent</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${c.conversionRate}%`,
                      background: c.channel === "email" ? COLORS.blue : COLORS.green,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-3">Best send times</p>
              <div className="space-y-2">
                {sendTimes.map((s) => (
                  <div key={s.time} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{s.time}</span>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Funnel conversion */}
      <Card noPadding>
        <div className="p-5 border-b border-gray-100">
          <CardTitle sub="Step-by-step drop-off">Funnel Conversion</CardTitle>
        </div>
        <div className="p-5">
          {(() => {
            const f = analytics?.funnel;
            if (!f) return <p className="text-sm text-gray-400">No funnel data</p>;
            const steps = [
              { label: "Requests Sent",   value: f.sent,            color: COLORS.blue  },
              { label: "Links Opened",    value: f.opened,          color: COLORS.sky   },
              { label: "Public Reviews",  value: f.publicReviews,   color: COLORS.green },
              { label: "Private Feedback",value: f.privateFeedback, color: COLORS.amber },
            ];
            return (
              <div className="flex items-end gap-3 h-40">
                {steps.map((s, i) => {
                  const pct = f.sent > 0 ? Math.round((s.value / f.sent) * 100) : 0;
                  return (
                    <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-gray-700">{s.value.toLocaleString()}</span>
                      <div className="w-full flex items-end" style={{ height: 100 }}>
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{ height: `${Math.max(pct, 4)}%`, background: s.color }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 text-center leading-tight">{s.label}</span>
                      <span className="text-[10px] font-medium text-gray-400">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </Card>
    </div>
  );
}
