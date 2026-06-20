"use client";
// src/app/onboarding/page.tsx
// First-run wizard for new business owners

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Building2, MapPin, Star, ArrowRight, CheckCircle, Zap } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Business Info",    icon: <Building2 size={16} /> },
  { id: 2, label: "Review Setup",     icon: <Star size={16} /> },
  { id: 3, label: "You're all set!",  icon: <CheckCircle size={16} /> },
];

const INDUSTRIES = [
  "Auto Dealership", "Healthcare", "Dental", "Restaurant", "Home Services",
  "Retail", "Real Estate", "Legal", "Beauty & Wellness", "Fitness",
  "Hospitality", "Education", "Financial Services", "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    // Step 1
    businessName: "",
    industry: "",
    city: "",
    state: "",
    // Step 2
    googleReviewUrl: "",
    yelpReviewUrl: "",
    positiveThreshold: "4",
  });

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submitStep1() {
    if (!form.businessName.trim()) { toast.error("Business name is required"); return; }
    if (!form.industry) { toast.error("Please select an industry"); return; }
    setStep(2);
  }

  async function submitStep2() {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.businessName,
          industry: form.industry,
          city: form.city,
          state: form.state,
          googleReviewUrl: form.googleReviewUrl || null,
          yelpReviewUrl: form.yelpReviewUrl || null,
          positiveThreshold: parseInt(form.positiveThreshold),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Setup failed");
      }
      setStep(3);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-semibold text-gray-900 tracking-tight">GenuinePulse</span>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                step === s.id
                  ? "bg-blue-600 text-white"
                  : step > s.id
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-400"
              )}>
                {step > s.id ? <CheckCircle size={12} /> : s.icon}
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("w-8 h-px", step > s.id ? "bg-emerald-300" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Step 1 — Business Info */}
          {step === 1 && (
            <div>
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-7 py-6">
                <h1 className="text-xl font-semibold text-white">Tell us about your business</h1>
                <p className="text-blue-100 text-sm mt-1">We'll personalize your review requests</p>
              </div>
              <div className="p-7 space-y-4">
                <Input
                  label="Business Name *"
                  value={form.businessName}
                  onChange={set("businessName")}
                  placeholder="e.g. Donovan Auto Group"
                  autoFocus
                />
                <Select label="Industry *" value={form.industry} onChange={set("industry")}>
                  <option value="">Select your industry…</option>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="City" value={form.city} onChange={set("city")} placeholder="Dallas" />
                  <Input label="State" value={form.state} onChange={set("state")} placeholder="TX" />
                </div>
                <Button className="w-full" size="lg" onClick={submitStep1}>
                  Continue <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Review Setup */}
          {step === 2 && (
            <div>
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-7 py-6">
                <h1 className="text-xl font-semibold text-white">Connect your review platforms</h1>
                <p className="text-emerald-100 text-sm mt-1">Where should happy customers go?</p>
              </div>
              <div className="p-7 space-y-4">
                <div>
                  <Input
                    label="Google Business Review Link"
                    value={form.googleReviewUrl}
                    onChange={set("googleReviewUrl")}
                    placeholder="https://g.page/r/XXXXXX/review"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Find in Google Business Profile → Ask for reviews → Get more reviews
                  </p>
                </div>
                <Input
                  label="Yelp Review Link (optional)"
                  value={form.yelpReviewUrl}
                  onChange={set("yelpReviewUrl")}
                  placeholder="https://www.yelp.com/writeareview/biz/..."
                />
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">
                    Redirect threshold — send to public review when rating is…
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["3", "4", "5"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setForm((f) => ({ ...f, positiveThreshold: v }))}
                        className={cn(
                          "py-2.5 rounded-lg text-sm font-medium border transition-all",
                          form.positiveThreshold === v
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                        )}
                      >
                        ≥ {v} stars
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Recommended: 4 stars. Customers below this threshold see a private feedback form instead.
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                  <Button className="flex-1" size="lg" onClick={submitStep2} loading={saving}>
                    Finish Setup <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">You're all set! 🎉</h2>
              <p className="text-sm text-gray-500 mb-7 leading-relaxed">
                {form.businessName} is ready to start collecting reviews.
                Your smart funnel is configured — add customers and send your first request.
              </p>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {[
                  { icon: "👥", text: "Add your first customers", href: "/dashboard/customers" },
                  { icon: "📨", text: "Send your first review request", href: "/dashboard/requests" },
                  { icon: "⚙️", text: "Customize your templates", href: "/dashboard/settings" },
                ].map((item) => (
                  <div
                    key={item.href}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700"
                  >
                    <span className="text-lg">{item.icon}</span>
                    {item.text}
                    <ArrowRight size={13} className="ml-auto text-gray-400" />
                  </div>
                ))}
              </div>
              <Button size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
