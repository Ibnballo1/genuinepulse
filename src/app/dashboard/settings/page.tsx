"use client";
// src/app/dashboard/settings/page.tsx

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Building2, Zap, CreditCard, FileText,
  CheckCircle, AlertCircle, ExternalLink,
} from "lucide-react";
import { Button, Card, Input, Select, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "profile",      label: "Business Profile", icon: <Building2 size={14} /> },
  { key: "integrations", label: "Integrations",      icon: <Zap size={14} /> },
  { key: "templates",    label: "Templates",         icon: <FileText size={14} /> },
  { key: "billing",      label: "Billing",           icon: <CreditCard size={14} /> },
];

// ─── Profile tab ─────────────────────────────────────────────────────────────

function ProfileTab({ business }: { business: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", industry: "", phone: "", city: "", state: "",
    emailFromAddress: "", emailFromName: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({
        name: business.name ?? "",
        industry: business.industry ?? "",
        phone: business.phone ?? "",
        city: business.city ?? "",
        state: business.state ?? "",
        emailFromAddress: business.emailFromAddress ?? "",
        emailFromName: business.emailFromName ?? "",
      });
    }
  }, [business]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/businesses/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["business"] });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-lg">
      <Input label="Business Name" value={form.name} onChange={set("name")} />
      <Select label="Industry" value={form.industry} onChange={set("industry")}>
        <option value="">Select industry…</option>
        {["Auto Dealership","Healthcare","Dental","Restaurant","Home Services",
          "Retail","Real Estate","Legal","Beauty & Wellness","Other"].map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </Select>
      <Input label="Business Phone" value={form.phone} onChange={set("phone")} type="tel" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="City" value={form.city} onChange={set("city")} />
        <Input label="State" value={form.state} onChange={set("state")} />
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">Email Sender Identity</p>
        <div className="space-y-3">
          <Input label="From email" value={form.emailFromAddress} onChange={set("emailFromAddress")}
            placeholder="reviews@yourbusiness.com" type="email" />
          <Input label="From name" value={form.emailFromName} onChange={set("emailFromName")}
            placeholder="Acme Business Reviews" />
        </div>
      </div>
      <Button onClick={handleSave} loading={saving} size="md">Save Changes</Button>
    </div>
  );
}

// ─── Integrations tab ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  const integrations = [
    {
      name: "Twilio SMS",
      description: "Send review requests via SMS",
      configured: !!process.env.NEXT_PUBLIC_TWILIO_CONFIGURED,
      envKey: "TWILIO_ACCOUNT_SID",
      docsUrl: "https://console.twilio.com",
      color: "bg-red-500",
      icon: "T",
    },
    {
      name: "Resend Email",
      description: "Send review requests via email",
      configured: !!process.env.NEXT_PUBLIC_RESEND_CONFIGURED,
      envKey: "RESEND_API_KEY",
      docsUrl: "https://resend.com/api-keys",
      color: "bg-black",
      icon: "R",
    },
    {
      name: "Google Business",
      description: "Primary review destination for happy customers",
      configured: true,
      docsUrl: "https://business.google.com",
      color: "bg-blue-500",
      icon: "G",
    },
    {
      name: "Upstash Redis",
      description: "Rate limiting to prevent SMS abuse",
      configured: !!process.env.NEXT_PUBLIC_REDIS_CONFIGURED,
      envKey: "UPSTASH_REDIS_REST_URL",
      docsUrl: "https://console.upstash.com",
      color: "bg-emerald-600",
      icon: "U",
    },
  ];

  return (
    <div className="space-y-3 max-w-lg">
      {integrations.map((intg) => (
        <div key={intg.name} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0", intg.color)}>
            {intg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">{intg.name}</p>
            <p className="text-xs text-gray-500">{intg.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {intg.configured ? (
              <Badge variant="green"><CheckCircle size={9} /> Connected</Badge>
            ) : (
              <Badge variant="amber"><AlertCircle size={9} /> Not configured</Badge>
            )}
            <a href={intg.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      ))}
      <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs font-medium text-blue-800 mb-1">Environment Variables</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Configure integrations by setting the required environment variables in your
          <code className="bg-blue-100 px-1 rounded mx-0.5">.env.local</code> file
          or Vercel project settings.
        </p>
        <a href="https://vercel.com/docs/projects/environment-variables" target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 block">
          View Vercel env docs →
        </a>
      </div>
    </div>
  );
}

// ─── Templates tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [body, setBody] = useState(
    channel === "email"
      ? `Hi {{first_name}},\n\nThank you for visiting {{business_name}}! We'd love to hear your feedback.\n\nClick here to share your experience: {{review_link}}\n\nIt takes less than 30 seconds — your review means the world to us!\n\nBest,\n{{business_name}} Team`
      : `Hi {{first_name}}! {{business_name}} here — thanks for your recent visit! Mind leaving us a quick review? 👉 {{review_link}} (Reply STOP to opt out)`
  );
  const [saving, setSaving] = useState(false);

  const VARS = ["{{first_name}}", "{{last_name}}", "{{business_name}}", "{{review_link}}"];

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Template saved");
    setSaving(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["email", "sms"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
              channel === c ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <p className="text-xs text-gray-500 w-full mb-1">Available variables:</p>
        {VARS.map((v) => (
          <button
            key={v}
            onClick={() => setBody((b) => b + v)}
            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono hover:bg-gray-200 transition-colors"
          >
            {v}
          </button>
        ))}
      </div>

      {channel === "email" && (
        <Input label="Subject line" defaultValue={`How was your experience with {{business_name}}?`} />
      )}

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1.5">
          Message body {channel === "sms" && <span className="text-gray-400 ml-1">({body.length}/160 chars)</span>}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === "email" ? 8 : 4}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Preview */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-600 mb-2">Preview</p>
        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
          {body
            .replace("{{first_name}}", "Jane")
            .replace("{{last_name}}", "Smith")
            .replace("{{business_name}}", "Acme Business")
            .replace("{{review_link}}", "https://genuinepulse.link/xKq8m2")}
        </p>
      </div>

      <Button onClick={handleSave} loading={saving}>Save Template</Button>
    </div>
  );
}

// ─── Billing tab ──────────────────────────────────────────────────────────────

function BillingTab({ business }: { business: any }) {
  const sub = business?.subscription;

  const plans = [
    {
      name: "Starter",
      price: 49,
      features: ["500 SMS/mo", "2,000 emails/mo", "1 location", "Basic analytics"],
    },
    {
      name: "Pro",
      price: 149,
      features: ["2,500 SMS/mo", "Unlimited emails", "3 locations", "Full analytics", "Priority support"],
      popular: true,
    },
    {
      name: "Enterprise",
      price: 299,
      features: ["Unlimited SMS", "Unlimited emails", "Unlimited locations", "Custom integrations", "Dedicated support"],
    },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      {/* Current plan */}
      {sub && (
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-900 capitalize">
              {sub.plan} Plan — ${sub.plan === "pro" ? 149 : sub.plan === "enterprise" ? 299 : 49}/month
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              SMS: {sub.smsSentThisPeriod}/{sub.monthlySmsLimit} used this period
            </p>
          </div>
          <Badge variant={sub.status === "active" ? "green" : "amber"}>
            {sub.status}
          </Badge>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={cn(
              "rounded-xl border p-4 relative transition-all",
              p.popular ? "border-blue-500 shadow-md" : "border-gray-200 hover:border-gray-300"
            )}
          >
            {p.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                  Most Popular
                </span>
              </div>
            )}
            <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">${p.price}<span className="text-xs font-normal text-gray-400">/mo</span></p>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckCircle size={11} className="text-emerald-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant={p.popular ? "primary" : "ghost"}
              size="sm"
              className="w-full mt-4"
              onClick={() => toast.success(`Redirecting to ${p.name} checkout…`)}
            >
              {sub?.plan === p.name.toLowerCase() ? "Current plan" : `Upgrade to ${p.name}`}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Billing powered by Stripe. Cancel anytime. No hidden fees.
      </p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const { data } = useQuery({
    queryKey: ["business"],
    queryFn: () => fetch("/api/businesses/me").then((r) => r.json()),
  });
  const business = data?.data;

  return (
    <div className="p-6 max-w-[1100px] space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-400">Manage your account, integrations, and billing</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-2">
        {tab === "profile"      && <ProfileTab business={business} />}
        {tab === "integrations" && <IntegrationsTab />}
        {tab === "templates"    && <TemplatesTab />}
        {tab === "billing"      && <BillingTab business={business} />}
      </div>
    </div>
  );
}
