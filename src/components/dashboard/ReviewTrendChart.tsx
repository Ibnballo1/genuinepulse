"use client";
// src/components/dashboard/ReviewTrendChart.tsx

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface DataPoint {
  week: string;
  five_star: number;
  four_star: number;
}

interface Props {
  data: DataPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl border border-gray-700">
      <p className="font-medium mb-1.5 text-gray-300">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ReviewTrendChart({ data }: Props) {
  // Pad to 8 weeks if fewer data points
  const displayData = data.length > 0 ? data : Array.from({ length: 6 }, (_, i) => ({
    week: `Week ${i + 1}`, five_star: 0, four_star: 0,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Reviews Over Time</h3>
          <p className="text-xs text-gray-400 mt-0.5">Weekly review volume by type</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
            Public reviews
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            Private feedback
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={displayData} barSize={16} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8FAFC" }} />
          <Bar dataKey="five_star" name="Public reviews" fill="#2563EB" radius={[3, 3, 0, 0]} />
          <Bar dataKey="four_star" name="Private feedback" fill="#10B981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
