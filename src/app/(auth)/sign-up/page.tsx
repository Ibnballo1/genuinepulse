"use client";
// src/app/(auth)/sign-up/page.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import toast from "react-hot-toast";
import { Eye, EyeOff, Zap, Loader2, Check } from "lucide-react";
import { signUpSchema } from "@/lib/validations";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", password: "", businessName: "", industry: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwChecks = {
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    number: /[0-9]/.test(form.password),
  };

  function update(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Validation error");
      return;
    }

    setLoading(true);
    try {
      // 1. Create BetterAuth user
      const result = await signUp.email({
        name: form.name,
        email: form.email,
        password: form.password,
      });

      if (result.error) {
        toast.error(result.error.message ?? "Failed to create account");
        return;
      }

      // 2. Create business via our API
      const bizRes = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.businessName, industry: form.industry }),
      });

      if (!bizRes.ok) {
        toast.error("Account created but failed to set up business. Please contact support.");
      }

      toast.success("Account created! Please check your email to verify.");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const INDUSTRIES = [
    "Auto Dealership", "Healthcare / Dental", "Restaurant / Food",
    "Home Services", "Real Estate", "Legal Services",
    "Beauty / Salon", "Fitness / Gym", "Retail", "Other",
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-white text-xl font-semibold tracking-tight">GenuinePulse</span>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <h1 className="text-white text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-gray-400 text-sm mb-6">Start your 14-day free trial. No credit card required.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Your name</label>
                <input type="text" required value={form.name} onChange={update("name")} placeholder="James"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Business name</label>
                <input type="text" required value={form.businessName} onChange={update("businessName")} placeholder="Acme Corp"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Industry</label>
              <select value={form.industry} onChange={update("industry")}
                className="w-full bg-gray-800 border border-gray-700 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white">
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Work email</label>
              <input type="email" required value={form.email} onChange={update("email")} placeholder="you@company.com"
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} required value={form.password} onChange={update("password")} placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm rounded-lg px-3.5 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {form.password && (
                <div className="flex gap-3 mt-2">
                  {[["8+ chars", pwChecks.length], ["Uppercase", pwChecks.upper], ["Number", pwChecks.number]].map(([label, ok]) => (
                    <div key={label as string} className={`flex items-center gap-1 text-[10px] font-medium ${ok ? "text-emerald-400" : "text-gray-600"}`}>
                      <Check size={10} /> {label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : "Create free account"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-blue-400 hover:text-blue-300 font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-4">
          By creating an account you agree to our{" "}
          <a href="/terms" className="text-gray-500 hover:text-gray-400 underline">Terms</a> and{" "}
          <a href="/privacy" className="text-gray-500 hover:text-gray-400 underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
