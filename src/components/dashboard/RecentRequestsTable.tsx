// src/components/dashboard/RecentRequestsTable.tsx

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Customer { firstName: string; lastName?: string; email?: string; phone?: string }
interface Request {
  id: string;
  channel: "sms" | "email";
  status: string;
  sentTo: string;
  sentAt?: Date;
  createdAt: Date;
  customer: Customer;
}

interface Props { requests: Request[] }

const statusStyles: Record<string, string> = {
  pending:   "bg-gray-100 text-gray-600",
  sent:      "bg-blue-50 text-blue-700",
  delivered: "bg-blue-50 text-blue-700",
  opened:    "bg-violet-50 text-violet-700",
  clicked:   "bg-emerald-50 text-emerald-700",
  failed:    "bg-red-50 text-red-700",
  bounced:   "bg-red-50 text-red-700",
};

const channelStyles: Record<string, string> = {
  email: "bg-blue-50 text-blue-700",
  sms:   "bg-amber-50 text-amber-700",
};

export default function RecentRequestsTable({ requests }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Recent Review Requests</h3>
        <Link href="/dashboard/requests" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          View all →
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">No requests sent yet.</p>
          <Link href="/dashboard/requests" className="text-xs text-blue-600 mt-2 inline-block hover:underline">
            Send your first request
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">Customer</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-3">Channel</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-3 py-3">Sent</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const name = [req.customer.firstName, req.customer.lastName].filter(Boolean).join(" ");
                return (
                  <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-800 text-sm">{name}</div>
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{req.sentTo}</div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize", channelStyles[req.channel])}>
                        {req.channel}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize", statusStyles[req.status] ?? "bg-gray-100 text-gray-600")}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                      {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
