// src/components/dashboard/FunnelSummary.tsx

interface Props {
  sent: number;
  opened: number;
  publicReviews: number;
  privateFeedback: number;
}

export default function FunnelSummary({ sent, opened, publicReviews, privateFeedback }: Props) {
  const pct = (n: number, total: number) =>
    total > 0 ? Math.round((n / total) * 100) : 0;

  const steps = [
    { label: "Requests Sent",    value: sent,            color: "bg-blue-600",   pct: 100 },
    { label: "Link Opened",      value: opened,          color: "bg-violet-500", pct: pct(opened, sent) },
    { label: "Public Reviews",   value: publicReviews,   color: "bg-emerald-500",pct: pct(publicReviews, sent) },
    { label: "Private Feedback", value: privateFeedback, color: "bg-amber-500",  pct: pct(privateFeedback, sent) },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 h-full">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-gray-800">Funnel Performance</h3>
        <p className="text-xs text-gray-400 mt-0.5">All-time conversion breakdown</p>
      </div>

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">{step.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{step.pct}%</span>
                <span className="text-sm font-semibold text-gray-800">{step.value.toLocaleString()}</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${step.color}`}
                style={{ width: `${step.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {sent > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Overall conversion rate</span>
            <span className="font-semibold text-emerald-600">
              {pct(publicReviews, sent)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
