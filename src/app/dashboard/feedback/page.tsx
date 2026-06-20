"use client";
// src/app/dashboard/feedback/page.tsx

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  MessageSquare, CheckCircle, Filter, ExternalLink,
  Star, Clock, ThumbsUp,
} from "lucide-react";
import {
  Button, Badge, Card, Modal, Spinner, EmptyState, Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface FeedbackItem {
  id: string;
  rating: number;
  type: "public_review" | "private_feedback";
  message?: string;
  reviewPlatform?: string;
  reviewPlatformUrl?: string;
  isResolved: boolean;
  resolvedAt?: string;
  submittedAt: string;
  customer?: {
    firstName: string;
    lastName?: string;
    email?: string;
  };
}

const TABS = [
  { key: "all",              label: "All" },
  { key: "public_review",    label: "Public Reviews" },
  { key: "private_feedback", label: "Private Feedback" },
  { key: "unresolved",       label: "Unresolved" },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex gap-px">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} size={11} className={cn(s <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200")} />
      ))}
    </span>
  );
}

function ResolveModal({ open, onClose, feedbackId, onResolved }: {
  open: boolean; onClose: () => void; feedbackId: string; onResolved: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleResolve() {
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error("Failed to resolve");
      toast.success("Feedback marked as resolved");
      onResolved();
      onClose();
    } catch {
      toast.error("Failed to resolve feedback");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Resolve Feedback" size="sm">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Optionally add an internal note about how this was handled.</p>
        <Textarea
          label="Internal note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Called customer, offered 10% discount on next visit..."
          charLimit={500}
        />
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleResolve} loading={saving}>
            <CheckCircle size={13} /> Mark Resolved
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [page, setPage] = useState(1);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["feedback", tab, minRating, maxRating, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (tab === "public_review") p.set("type", "public_review");
      else if (tab === "private_feedback") p.set("type", "private_feedback");
      else if (tab === "unresolved") { p.set("type", "private_feedback"); p.set("isResolved", "false"); }
      if (minRating) p.set("minRating", minRating);
      if (maxRating) p.set("maxRating", maxRating);
      const res = await fetch(`/api/feedback?${p}`);
      return res.json();
    },
    staleTime: 20_000,
  });

  const items: FeedbackItem[] = data?.data ?? [];
  const pagination = data?.pagination;

  const refetch = () => qc.invalidateQueries({ queryKey: ["feedback"] });

  return (
    <div className="p-6 max-w-[1100px] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Feedback & Reviews</h2>
          <p className="text-sm text-gray-400">{pagination?.total ?? 0} total responses</p>
        </div>
        <div className="flex gap-2">
          <select
            value={minRating}
            onChange={(e) => { setMinRating(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
          >
            <option value="">Min rating</option>
            {[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} star{v > 1 ? "s" : ""}</option>)}
          </select>
          <select
            value={maxRating}
            onChange={(e) => { setMaxRating(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
          >
            <option value="">Max rating</option>
            {[1,2,3,4,5].map((v) => <option key={v} value={v}>{v} star{v > 1 ? "s" : ""}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={cn(
              "px-4 py-1.5 text-[13px] font-medium rounded-md transition-all",
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={20} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={<MessageSquare size={20} />} title="No feedback here" description="Responses from your review funnel will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "bg-white rounded-xl border p-4 transition-colors",
                item.type === "private_feedback" && !item.isResolved
                  ? "border-amber-200 shadow-[0_0_0_1px_rgba(245,158,11,0.1)]"
                  : "border-gray-200"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                {/* Left */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {item.customer?.firstName?.[0] ?? "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-gray-800">
                        {item.customer?.firstName} {item.customer?.lastName}
                      </p>
                      <StarRow rating={item.rating} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock size={9} />
                        {formatDistanceToNow(new Date(item.submittedAt), { addSuffix: true })}
                      </span>
                      {item.type === "public_review" ? (
                        <Badge variant="blue">
                          {item.reviewPlatform === "google" ? "Google" : item.reviewPlatform ?? "Public"} Review
                        </Badge>
                      ) : (
                        <Badge variant="amber">Private Feedback</Badge>
                      )}
                      {item.isResolved && <Badge variant="green"><CheckCircle size={9} /> Resolved</Badge>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.type === "public_review" && item.reviewPlatformUrl && (
                    <a
                      href={item.reviewPlatformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  )}
                  {item.type === "private_feedback" && !item.isResolved && (
                    <Button size="sm" variant="ghost" onClick={() => setResolveTarget(item.id)}>
                      <CheckCircle size={11} /> Resolve
                    </Button>
                  )}
                </div>
              </div>

              {item.message && (
                <p className="text-sm text-gray-600 leading-relaxed ml-10 mt-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  "{item.message}"
                </p>
              )}
              {!item.message && item.type === "public_review" && (
                <p className="text-xs text-gray-400 ml-10 mt-1 italic">
                  Customer redirected to {item.reviewPlatform ?? "review platform"} — no text captured.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">Page {page} of {pagination.totalPages}</p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="ghost" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ResolveModal
        open={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        feedbackId={resolveTarget ?? ""}
        onResolved={refetch}
      />
    </div>
  );
}
