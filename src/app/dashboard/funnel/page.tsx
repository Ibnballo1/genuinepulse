"use client";
// src/app/dashboard/funnel/page.tsx

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  GitBranch, Star, ExternalLink, CheckCircle,
  ArrowDown, Google, ChevronRight,
} from "lucide-react";
import { Button, Badge, Card, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

// ─── Live Funnel Preview ──────────────────────────────────────────────────────

function FunnelPreview({ threshold }: { threshold: number }) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const display = hovered ?? selectedRating;
  const isPublic = selectedRating !== null && selectedRating >= threshold;
  const isPrivate = selectedRating !== null && selectedRating < threshold;

  return (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
      {/* Simulated phone card */}
      <div className="max-w-sm mx-auto bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl font-bold">AB</span>
          </div>
          <h3 className="text-white text-lg font-semibold">Acme Business</h3>
          <p className="text-blue-100 text-sm mt-1">How was your experience?</p>
        </div>

        {/* Star rater */}
        <div className="px-6 py-6 text-center">
          <p className="text-sm text-gray-500 mb-4">Tap to rate your visit</p>
          <div className="flex justify-center gap-2 mb-4">
            {[1,2,3,4,5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHovered(s)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelectedRating(s)}
                className="transition-transform active:scale-90"
              >
                <Star
                  size={32}
                  className={cn(
                    "transition-colors",
                    (display ?? 0) >= s ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-100"
                  )}
                />
              </button>
            ))}
          </div>

          {/* Result message */}
          {isPublic && (
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
              <CheckCircle size={20} className="text-emerald-600 mx-auto mb-1.5" />
              <p className="text-sm font-semibold text-emerald-700">Awesome! Redirecting to Google…</p>
              <p className="text-xs text-emerald-600 mt-1">Your review helps others find us ★</p>
            </div>
          )}
          {isPrivate && (
            <div className="animate-in fade-in-0 slide-in-from-bottom-2 bg-amber-50 rounded-xl p-4 text-center border border-amber-200">
              <p className="text-sm font-semibold text-amber-700">We're sorry to hear that.</p>
              <p className="text-xs text-amber-600 mt-1">Please tell us what went wrong so we can improve.</p>
              <textarea
                className="w-full mt-3 p-2 text-xs border border-amber-200 rounded-lg resize-none h-16 focus:outline-none bg-white"
                placeholder="Share your experience..."
              />
              <button className="mt-2 w-full bg-amber-500 text-white text-xs font-medium py-2 rounded-lg">
                Submit Feedback
              </button>
            </div>
          )}
          {selectedRating === null && (
            <p className="text-xs text-gray-400">← Click a star to preview the funnel</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Funnel diagram ───────────────────────────────────────────────────────────

function FunnelDiagram({ threshold }: { threshold: number }) {
  const steps = [
    { label: "Customer receives link",  width: "100%", bg: "bg-blue-600",   text: "1,284 sent" },
    { label: "Opens link & rates",       width: "78%",  bg: "bg-blue-500",   text: "~912 opened" },
  ];

  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div key={i} className="flex flex-col items-center">
          <div
            className={cn("rounded-lg flex items-center justify-between px-4 py-3 text-white text-sm font-medium transition-all", s.bg)}
            style={{ width: s.width }}
          >
            <span>{s.label}</span>
            <span className="text-white/80 text-xs">{s.text}</span>
          </div>
          {i < steps.length - 1 && (
            <div className="text-gray-300 text-xs my-0.5">▼</div>
          )}
        </div>
      ))}

      {/* Split */}
      <div className="text-gray-300 text-xs text-center">▼</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500 rounded-lg px-4 py-3 text-white text-center">
          <p className="font-semibold text-sm">★ ≥ {threshold} stars</p>
          <p className="text-xs text-emerald-100 mt-0.5">→ Google / Yelp</p>
          <p className="text-lg font-bold mt-1">347</p>
          <p className="text-xs text-emerald-200">public reviews</p>
        </div>
        <div className="bg-amber-500 rounded-lg px-4 py-3 text-white text-center">
          <p className="font-semibold text-sm">★ &lt; {threshold} stars</p>
          <p className="text-xs text-amber-100 mt-0.5">→ Private form</p>
          <p className="text-lg font-bold mt-1">89</p>
          <p className="text-xs text-amber-200">captured privately</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FunnelPage() {
  const qc = useQueryClient();

  const { data: businessData } = useQuery({
    queryKey: ["business"],
    queryFn: () => fetch("/api/businesses/me").then((r) => r.json()),
  });

  const business = businessData?.data;
  const [threshold, setThreshold] = useState(4);
  const [googleUrl, setGoogleUrl] = useState("");
  const [yelpUrl, setYelpUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setThreshold(business.positiveThreshold ?? 4);
      setGoogleUrl(business.googleReviewUrl ?? "");
      setYelpUrl(business.yelpReviewUrl ?? "");
      setFacebookUrl(business.facebookReviewUrl ?? "");
    }
  }, [business]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/businesses/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positiveThreshold: threshold,
          googleReviewUrl: googleUrl || null,
          yelpReviewUrl: yelpUrl || null,
          facebookReviewUrl: facebookUrl || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Funnel settings saved");
      qc.invalidateQueries({ queryKey: ["business"] });
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-[1200px] space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Review Funnel</h2>
        <p className="text-sm text-gray-400">
          Configure your smart review redirect. Happy customers go public; unhappy ones stay private.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-4">
          {/* Threshold */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Redirect Threshold</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Customers who rate <strong>{threshold} stars or above</strong> will be sent to your public review platform.
              Customers who rate <strong>below {threshold} stars</strong> will see the private feedback form instead.
            </p>
            <div className="flex gap-2 mb-2">
              {[3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setThreshold(v)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all",
                    threshold === v
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  )}
                >
                  ≥ {v} stars → public
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              Recommended: 4 stars — captures most public reviews while filtering dissatisfied customers.
            </p>
          </Card>

          {/* Platform URLs */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Review Platforms</h3>
            <div className="space-y-3">
              <div>
                <Input
                  label="Google Business review link"
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  placeholder="https://g.page/r/XXXXXXXX/review"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Find this in your Google Business Profile → Ask for reviews
                </p>
              </div>
              <Input
                label="Yelp review link"
                value={yelpUrl}
                onChange={(e) => setYelpUrl(e.target.value)}
                placeholder="https://www.yelp.com/writeareview/biz/XXXXXXXX"
              />
              <Input
                label="Facebook review link"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/YourPage/reviews"
              />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Priority: Google → Yelp → Facebook. First connected platform is used.
            </p>
          </Card>

          {/* Funnel diagram */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Current Funnel Flow</h3>
            <FunnelDiagram threshold={threshold} />
          </Card>

          <Button className="w-full" size="lg" onClick={handleSave} loading={saving}>
            Save Funnel Settings
          </Button>
        </div>

        {/* Live Preview */}
        <div>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Customer-Facing Preview</h3>
              <Badge variant="blue">Live demo</Badge>
            </div>
            <FunnelPreview threshold={threshold} />
            <p className="text-xs text-gray-400 text-center mt-3">
              This is what customers see when they click your review link.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
