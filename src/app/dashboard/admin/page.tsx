"use client";
// src/app/dashboard/admin/page.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ShieldCheck, Users, Building2, MessageSquare,
  Star, DollarSign, Activity, AlertTriangle, Ban,
  CheckCircle, Search, RefreshCw,
} from "lucide-react";
import {
  Button, Badge, Card, CardHeader, CardTitle,
  Modal, Table, Th, Td, Tr, Spinner, EmptyState, Input,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const TABS = [
  { key: "overview",  label: "Overview"  },
  { key: "tenants",   label: "Tenants"   },
  { key: "logs",      label: "Logs"      },
  { key: "plans",     label: "Plans"     },
];

// ─── System metric card ───────────────────────────────────────────────────────

function SysCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Suspend user modal ───────────────────────────────────────────────────────

function SuspendModal({ open, onClose, userId, userName, onDone }: {
  open: boolean; onClose: () => void; userId: string; userName: string; onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSuspend() {
    if (!reason.trim()) { toast.error("Provide a reason"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`${userName} suspended`);
      onDone();
      onClose();
    } catch {
      toast.error("Failed to suspend user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Suspend ${userName}`} size="sm">
      <div className="space-y-3">
        <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 border border-red-200">
          This will immediately block the user from accessing their account.
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-400/20"
            placeholder="e.g. Violation of terms of service — spam activity detected"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleSuspend} loading={saving}>
            <Ban size={13} /> Suspend
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: any }) {
  if (!data) return <div className="flex justify-center py-10"><Spinner size={20} /></div>;
  const s = data.summary;

  const health = [
    { name: "Twilio SMS",        status: "operational", uptime: "99.8%"  },
    { name: "Resend Email",      status: "operational", uptime: "99.9%"  },
    { name: "PostgreSQL DB",     status: "operational", uptime: "100%"   },
    { name: "API Rate Limiting", status: "degraded",    uptime: "72% cap" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SysCard label="Active Tenants" value={s.activeBusinesses} sub={`${s.totalBusinesses} total`}
          icon={<Building2 size={15} className="text-blue-600" />} color="bg-blue-50" />
        <SysCard label="Total Users" value={s.totalUsers} icon={<Users size={15} className="text-violet-600" />} color="bg-violet-50" />
        <SysCard label="Messages (30d)" value={s.totalRequestsSent30d?.toLocaleString()} icon={<MessageSquare size={15} className="text-emerald-600" />} color="bg-emerald-50" />
        <SysCard label="MRR" value={`$${Number(s.mrr ?? 0).toLocaleString()}`} icon={<DollarSign size={15} className="text-amber-600" />} color="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* System health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </span>
          </CardHeader>
          <div className="space-y-3">
            {health.map((h) => (
              <div key={h.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full",
                    h.status === "operational" ? "bg-emerald-500" : "bg-amber-400"
                  )} />
                  <span className="text-sm text-gray-700">{h.name}</span>
                </div>
                <span className={cn("text-xs font-medium",
                  h.status === "operational" ? "text-emerald-600" : "text-amber-500"
                )}>
                  {h.uptime}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Plan revenue */}
        <Card>
          <CardHeader><CardTitle>Revenue by Plan</CardTitle></CardHeader>
          <div className="space-y-4">
            {Object.entries(data.planRevenue ?? {}).map(([plan, revenue]: [string, any]) => {
              const planRow = data.planBreakdown?.find((p: any) => p.plan === plan && ["active","trialing"].includes(p.status));
              return (
                <div key={plan}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-700 capitalize">{plan}</span>
                    <span className="text-gray-500">${revenue.toLocaleString()}/mo · {planRow?.count ?? 0} businesses</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (revenue / (s.mrr || 1)) * 100)}%`,
                        background: plan === "enterprise" ? "#7c3aed" : plan === "pro" ? "#2563eb" : "#059669",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top businesses */}
      <Card noPadding>
        <div className="p-5 border-b border-gray-100">
          <CardTitle sub="Last 30 days">Top Performing Businesses</CardTitle>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Business</Th><Th>Industry</Th><Th>Requests</Th><Th>Reviews</Th><Th>Avg Rating</Th>
            </tr>
          </thead>
          <tbody>
            {(data.topBusinesses ?? []).slice(0, 8).map((b: any) => (
              <Tr key={b.id}>
                <Td><p className="font-medium text-gray-800">{b.name}</p></Td>
                <Td><span className="text-gray-500">{b.industry ?? "—"}</span></Td>
                <Td>{b.requests_sent ?? 0}</Td>
                <Td><strong>{b.reviews ?? 0}</strong></Td>
                <Td>
                  {b.avg_rating
                    ? <span className="flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" />{b.avg_rating}</span>
                    : <span className="text-gray-300">—</span>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Tenants tab ──────────────────────────────────────────────────────────────

function TenantsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants", search],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "30", ...(search && { search }) });
      return fetch(`/api/admin/businesses?${p}`).then((r) => r.json());
    },
    staleTime: 30_000,
  });

  const tenants: any[] = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tenants..."
          className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <Card noPadding>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Business</Th><Th>Owner</Th><Th>Plan</Th>
                <Th>Requests</Th><Th>Reviews</Th><Th>Status</Th><Th />
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-[10px] font-bold">
                        {t.name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-[13px]">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.industry}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className="text-xs text-gray-600">{t.owner_name}</p>
                    <p className="text-xs text-gray-400">{t.owner_email}</p>
                  </Td>
                  <Td><Badge variant={t.plan === "pro" ? "blue" : t.plan === "enterprise" ? "purple" : "gray"}>{t.plan}</Badge></Td>
                  <Td>{t.total_requests ?? 0}</Td>
                  <Td><strong>{t.total_reviews ?? 0}</strong></Td>
                  <Td>
                    {t.is_suspended ? (
                      <Badge variant="red">Suspended</Badge>
                    ) : t.sub_status === "trialing" ? (
                      <Badge variant="amber">Trial</Badge>
                    ) : (
                      <Badge variant="green">Active</Badge>
                    )}
                  </Td>
                  <Td>
                    {!t.is_suspended && (
                      <Button size="sm" variant="ghost" onClick={() => setSuspendTarget({ id: t.id, name: t.name })}>
                        <Ban size={11} /> Suspend
                      </Button>
                    )}
                    {t.is_suspended && (
                      <Button size="sm" variant="ghost"
                        onClick={async () => {
                          await fetch(`/api/admin/users/${t.id}/suspend`, { method: "DELETE" });
                          toast.success("Account reinstated");
                          qc.invalidateQueries({ queryKey: ["admin-tenants"] });
                        }}>
                        Reinstate
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {suspendTarget && (
        <SuspendModal
          open={!!suspendTarget}
          onClose={() => setSuspendTarget(null)}
          userId={suspendTarget.id}
          userName={suspendTarget.name}
          onDone={() => qc.invalidateQueries({ queryKey: ["admin-tenants"] })}
        />
      )}
    </div>
  );
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: () => fetch("/api/admin/logs?limit=40").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const logs: any[] = data?.data ?? [];

  const statusColor: Record<string, string> = {
    delivered: "text-emerald-600", sending: "text-blue-500",
    failed: "text-red-500", retrying: "text-amber-500",
    queued: "text-gray-400",
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">Live message delivery log (auto-refreshes every 15s)</p>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      <Card noPadding>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <span className={cn("text-xs font-bold font-mono uppercase min-w-[52px]", statusColor[log.status] ?? "text-gray-400")}>
                  {log.status.toUpperCase().slice(0, 3)}
                </span>
                <span className="text-xs font-mono text-gray-400 min-w-[60px]">
                  {log.sentAt ? new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                </span>
                <span className="text-xs font-medium text-gray-600 capitalize min-w-[40px]">{log.channel}</span>
                <span className="text-xs text-gray-500 font-mono truncate flex-1">{log.toAddress}</span>
                {log.failureCode && (
                  <span className="text-xs text-red-400 font-mono">{log.failureCode}</span>
                )}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">No logs yet</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState("overview");

  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetch("/api/admin/overview").then((r) => r.json()),
    staleTime: 60_000,
  });

  return (
    <div className="p-6 max-w-[1400px] space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
          <ShieldCheck size={18} className="text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Super Admin</h2>
          <p className="text-sm text-gray-400">Platform-wide management and monitoring</p>
        </div>
        <Badge variant="red" className="ml-auto">Admin Mode</Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
              tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-1">
        {tab === "overview" && <OverviewTab data={data?.data} />}
        {tab === "tenants"  && <TenantsTab />}
        {tab === "logs"     && <LogsTab />}
        {tab === "plans"    && (
          <div className="text-sm text-gray-500 py-8 text-center">
            Stripe billing integration — connect your Stripe account to manage plan assignments.
          </div>
        )}
      </div>
    </div>
  );
}
