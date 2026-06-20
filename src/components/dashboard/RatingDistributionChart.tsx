"use client";
// src/components/dashboard/RatingDistributionChart.tsx

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface RatingBucket { rating: number; count: number; pct: number }
interface Props { data: RatingBucket[] }

const COLORS = ["#EF4444", "#F97316", "#F59E0B", "#10B981", "#2563EB"];
const LABELS: Record<number, string> = { 1: "1★", 2: "2★", 3: "3★", 4: "4★", 5: "5★" };

export default function RatingDistributionChart({ data }: Props) {
  const pieData = data.filter((d) => d.count > 0).map((d) => ({
    name: LABELS[d.rating],
    value: d.count,
    pct: d.pct,
    color: COLORS[d.rating - 1],
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-800">Rating Distribution</h3>
        <p className="text-xs text-gray-400 mt-0.5">All-time breakdown</p>
      </div>

      {pieData.length > 0 ? (
        <>
          <div className="flex items-center justify-center mb-5">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={56}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#fff"
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} reviews`, name]}
                  contentStyle={{
                    background: "#1E293B", border: "none", borderRadius: 8,
                    color: "#F1F5F9", fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2.5">
            {[...data].reverse().map((d) => (
              <div key={d.rating} className="flex items-center gap-2.5">
                <span className="text-xs text-gray-500 font-medium w-5 text-right">
                  {d.rating}★
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.pct}%`, background: COLORS[d.rating - 1] }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-3xl mb-3">📊</div>
          <p className="text-sm text-gray-400">No ratings yet</p>
          <p className="text-xs text-gray-300 mt-1">Send your first review request to get started</p>
        </div>
      )}
    </div>
  );
}
