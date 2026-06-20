"use client";
// src/app/dashboard/customers/page.tsx

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Users, Plus, Upload, Search, Send,
  Phone, Mail, Star, MoreHorizontal, Tag,
} from "lucide-react";
import {
  Button, Badge, Card, CardHeader, CardTitle,
  Input, Select, Modal, Table, Th, Td, Tr,
  EmptyState, Spinner,
} from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Customer {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  optedOut: boolean;
  totalRequestsSent: number;
  totalReviewsLeft: number;
  lastRating?: number;
  lastRequestSentAt?: string;
  createdAt: string;
}

// ─── Star display ─────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-xs text-gray-300">—</span>;
  return (
    <span className="flex gap-px">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={cn("text-xs", s <= rating ? "text-amber-400" : "text-gray-200")}>★</span>
      ))}
    </span>
  );
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────

function AddCustomerModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.email && !form.phone) errs.email = "Provide an email or phone";
    if (form.email && !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) errs.email = "Invalid email";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add customer");
      toast.success("Customer added");
      onSuccess();
      onClose();
      setForm({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Customer">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name *" value={form.firstName} onChange={set("firstName")} error={errors.firstName} placeholder="Jane" />
          <Input label="Last name" value={form.lastName} onChange={set("lastName")} placeholder="Smith" />
        </div>
        <Input label="Email" value={form.email} onChange={set("email")} error={errors.email} placeholder="jane@example.com" type="email" />
        <Input label="Phone" value={form.phone} onChange={set("phone")} placeholder="+1 (214) 555-0100" type="tel" />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Notes</label>
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Optional internal note..."
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSubmit} loading={saving}>Add Customer</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

function ImportModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/customers/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data.data);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Customers from CSV">
      {!result ? (
        <div className="space-y-4">
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-200 space-y-1">
            <p className="font-medium text-gray-700">CSV Format</p>
            <p>Required columns: <code className="bg-gray-200 px-1 rounded">first_name</code>, and at least one of <code className="bg-gray-200 px-1 rounded">email</code> or <code className="bg-gray-200 px-1 rounded">phone</code></p>
            <p>Optional: <code className="bg-gray-200 px-1 rounded">last_name</code></p>
          </div>

          <label className={cn(
            "flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
            file ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
          )}>
            <Upload size={20} className={cn("mb-1.5", file ? "text-blue-500" : "text-gray-400")} />
            <span className="text-sm font-medium text-gray-700">
              {file ? file.name : "Click to select CSV file"}
            </span>
            <span className="text-xs text-gray-400 mt-0.5">Max 5MB</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleImport} loading={importing} disabled={!file}>
              Import
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700">{result.imported}</div>
              <div className="text-xs text-emerald-600">Imported</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-700">{result.skipped}</div>
              <div className="text-xs text-amber-600">Skipped</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              <p className="text-xs font-medium text-gray-600">Row errors:</p>
              {result.errors.slice(0, 10).map((e) => (
                <p key={e.row} className="text-xs text-red-500">Row {e.row}: {e.reason}</p>
              ))}
            </div>
          )}
          <Button className="w-full" onClick={() => { setResult(null); onClose(); }}>Done</Button>
        </div>
      )}
    </Modal>
  );
}

// ─── Send Request Modal ───────────────────────────────────────────────────────

function SendRequestModal({ open, onClose, customer }: {
  open: boolean; onClose: () => void; customer: Customer | null;
}) {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [sending, setSending] = useState(false);

  if (!customer) return null;

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch("/api/review-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer!.id, channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      toast.success(`Review request sent via ${channel.toUpperCase()}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send Review Request" size="sm">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <p className="font-medium text-gray-800">{customer.firstName} {customer.lastName}</p>
          {customer.email && <p className="text-gray-500 text-xs">{customer.email}</p>}
          {customer.phone && <p className="text-gray-500 text-xs">{customer.phone}</p>}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Send via</p>
          <div className="grid grid-cols-2 gap-2">
            {(["email", "sms"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                disabled={(c === "email" && !customer.email) || (c === "sms" && !customer.phone)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all",
                  channel === c
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {c === "email" ? <Mail size={14} /> : <Phone size={14} />}
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSend} loading={sending}>Send</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, filter, page],
    queryFn: async () => {
      const p = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search && { search }),
        ...(filter === "reviewed" && { hasReviewed: "true" }),
        ...(filter === "no_response" && { hasReviewed: "false" }),
        ...(filter === "opted_out" && { optedOut: "true" }),
      });
      const res = await fetch(`/api/customers?${p}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const customers: Customer[] = data?.data ?? [];
  const pagination = data?.pagination;

  const refetch = () => qc.invalidateQueries({ queryKey: ["customers"] });

  return (
    <div className="p-6 max-w-[1400px] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-400">
            {pagination?.total ?? 0} total contacts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setImportOpen(true)}>
            <Upload size={13} /> Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={13} /> Add Customer
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search customers..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white w-60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All customers</option>
          <option value="reviewed">Has reviewed</option>
          <option value="no_response">No response</option>
          <option value="opted_out">Opted out</option>
        </select>
      </div>

      {/* Table */}
      <Card noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Spinner size={20} /></div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="No customers yet"
            description="Add customers manually or import a CSV to get started."
            action={<Button onClick={() => setAddOpen(true)}><Plus size={13} /> Add First Customer</Button>}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Requests</Th>
                <Th>Reviews</Th>
                <Th>Last Rating</Th>
                <Th>Tags</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {c.firstName[0]}{c.lastName?.[0] ?? ""}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-[13px]">{c.firstName} {c.lastName}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail size={10} className="text-gray-400" />{c.email}
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone size={10} className="text-gray-400" />{c.phone}
                        </div>
                      )}
                    </div>
                  </Td>
                  <Td><span className="text-gray-600">{c.totalRequestsSent}</span></Td>
                  <Td><span className="font-medium text-gray-700">{c.totalReviewsLeft}</span></Td>
                  <Td><StarRating rating={c.lastRating} /></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {c.tags?.map((t) => (
                        <Badge key={t} variant={t === "vip" ? "purple" : t === "unhappy" ? "red" : "gray"}>
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    {c.optedOut ? (
                      <Badge variant="red">Opted out</Badge>
                    ) : (
                      <Badge variant="green">Active</Badge>
                    )}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRequestTarget(c)}
                      disabled={c.optedOut}
                    >
                      <Send size={11} /> Send Request
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="ghost" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddCustomerModal open={addOpen} onClose={() => setAddOpen(false)} onSuccess={refetch} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={refetch} />
      <SendRequestModal open={!!requestTarget} onClose={() => setRequestTarget(null)} customer={requestTarget} />
    </div>
  );
}
