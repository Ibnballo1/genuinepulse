"use client";
// src/app/(auth)/reset-password/page.tsx

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError("Password is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    setLoading(true);
    setError("");

    try {
      await authClient.resetPassword({ newPassword: password, token });
      setDone(true);
      setTimeout(() => router.push("/sign-in"), 2500);
    } catch {
      setError("Reset link is invalid or expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center py-6">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <h2 className="font-semibold text-gray-800 mb-2">Invalid link</h2>
        <p className="text-sm text-gray-500 mb-4">This reset link is missing a token.</p>
        <Link href="/forgot-password" className="text-blue-600 hover:underline text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return done ? (
    <div className="text-center py-4">
      <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={28} className="text-emerald-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Password updated!</h2>
      <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
    </div>
  ) : (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Choose a new password</h1>
        <p className="text-sm text-gray-500 mt-1">Must be at least 8 characters.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
          <AlertCircle size={15} className="flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="New password"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            className="absolute right-3 top-7 text-gray-400 hover:text-gray-600"
          >
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
        />
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Reset password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-xl font-semibold text-gray-900 tracking-tight">GenuinePulse</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8">
          <Suspense fallback={<div className="h-40 animate-pulse bg-gray-50 rounded-xl" />}>
            <ResetPasswordForm />
          </Suspense>
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/sign-in" className="text-blue-600 hover:text-blue-700 font-medium">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
