"use client";
// src/app/dashboard/requests/page.tsx

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Send, Search, Mail, Phone, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Customer { id: string; firstName: string; lastName?: string; email?: string; phone?: string }
interface Template { id: string; name: string; channel: string; body: string }
interface Request { id: string; channel: string; status: string; sentTo: string; createdAt: string; customer: Customer }

export default function RequestsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers?limit=100").then((r) => r.json()),
      fetch("/api/review-requests?limit=20").then((r) => r.json()),
    ]).then(([c, r]) => {
      setCustomers(c.data ?? []);
      setRequests(r.data ?? []);
      setLoading(false);
    });
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const q = customerSearch.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      (c.lastName ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q)
    );
  });

  async function handleSend() {
    if (!selectedCustomer) { toast.error("Please select a customer"); return; }
    if (channel === "email" && !selectedCustomer.email) { toast.error("Customer has no email address"); return; }
    if (channel === "sms" && !selectedCustomer.phone) { toast.error("Customer has no phone number"); return; }

    setSending(true);
    try {
      const res = await fetch("/api/review-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          channel,
          templateId: selectedTemplate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to send request");
        return;
      }

      toast.success(`Review request sent via ${channel.toUpperCase()}`);
      setSelectedCustomer(null);
      setCustomerSearch("");
      // Refresh requests list
      const updated = await fetch("/api/review-requests?limit=20").then((r) => r.json());
      setRequests(updated.data ?? []);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-gray-100 text-gray-600",
      sent: "bg-blue-50 text-blue-700",
      delivered: "bg-blue-50 text-blue-700",
      opened: "bg-violet-50 text-violet-700",
      clicked: "bg-emerald-50 text-emerald-700",
      failed: "bg-red-50 text-red-700",
      bounced: "bg-red-50 text-red-700",
    };
    return map[status] ?? "bg-gray-100 text-gray-600";
  };

  return (
    <div className="p-6 max-w-[1400px] space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ─── Send Form ─────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Send Review Request</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select a customer and channel to send a personalized request</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Channel picker */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Channel</label>
              <div className="grid grid-cols-2 gap-2">
                {(["email", "sms"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-lg border text-sm font-medium transition-all",
                      channel === ch
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    {ch === "email" ? <Mail size={15} /> : <Phone size={15} />}
                    {ch === "email" ? "Email" : "SMS"}
                    <span className={cn(
                      "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded",
                      ch === "email" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {ch === "email" ? "Resend" : "Twilio"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Customer search */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Customer</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone…"
                  value={selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName ?? ""}`.trim() : customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Dropdown */}
              {!selectedCustomer && customerSearch && filteredCustomers.length > 0 && (
                <div className="mt-1 border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto bg-white z-10 relative">
                  {filteredCustomers.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                        {c.firstName[0]}{c.lastName?.[0] ?? ""}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.firstName} {c.lastName}</p>
                        <p className="text-xs text-gray-400">{c.email ?? c.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected customer preview */}
            {selectedCustomer && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 text-xs font-bold flex-shrink-0">
                  {selectedCustomer.firstName[0]}{selectedCustomer.lastName?.[0] ?? ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-900">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                  <p className="text-xs text-emerald-700">
                    {channel === "email" ? selectedCustomer.email ?? "No email" : selectedCustomer.phone ?? "No phone"}
                  </p>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-emerald-600 hover:text-emerald-800 text-xs">
                  ✕
                </button>
              </div>
            )}

            {/* Preview */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Message Preview</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {channel === "email"
                  ? `Hi ${selectedCustomer?.firstName ?? "{{first_name}}"}! Thank you for visiting us. We'd love your feedback — click below to share your experience in 30 seconds.`
                  : `Hi ${selectedCustomer?.firstName ?? "{{first_name}}"}! Thanks for your recent visit. Mind leaving a quick review? → genuinepulse.link/xxxxx (Reply STOP to opt out)`}
              </p>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !selectedCustomer}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-3 rounded-lg transition-all"
            >
              {sending ? (
                <><RefreshCw size={14} className="animate-spin" /> Sending…</>
              ) : (
                <><Send size={14} /> Send {channel === "email" ? "Email" : "SMS"} Request</>
              )}
            </button>
          </div>
        </div>

        {/* ─── Request History ────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Request History</h2>
              <p className="text-xs text-gray-400 mt-0.5">Live delivery status from Twilio & Resend</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-gray-300" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <Send size={28} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No requests sent yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Customer", "Channel", "Status", "Sent"].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-800">{req.customer.firstName} {req.customer.lastName}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[140px]">{req.sentTo}</div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize",
                          req.channel === "email" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700")}>
                          {req.channel}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium capitalize", statusBadge(req.status))}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
