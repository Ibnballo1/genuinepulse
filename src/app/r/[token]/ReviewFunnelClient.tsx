"use client";
// src/app/r/[token]/ReviewFunnelClient.tsx

import { useState } from "react";
import { Star, CheckCircle, ArrowRight, MessageSquare } from "lucide-react";

interface Props {
  token: string;
  businessName: string;
  logoUrl?: string;
  customerFirstName: string;
  positiveThreshold: number;
}

type Step = "rating" | "redirecting" | "private_form" | "thank_you";

export default function ReviewFunnelClient({
  token,
  businessName,
  logoUrl,
  customerFirstName,
  positiveThreshold,
}: Props) {
  const [step, setStep] = useState<Step>("rating");
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratingLabels = ["", "Poor", "Fair", "Okay", "Good", "Excellent"];

  // ─── Submit rating ─────────────────────────────────────────────────────
  async function submitRating(rating: number) {
    setSelectedRating(rating);
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/funnel/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      const result = data.data;

      if (result.action === "redirect_public") {
        setStep("redirecting");
        // Brief pause to show the redirect state, then navigate
        await new Promise((r) => setTimeout(r, 1500));
        window.location.href = result.redirectUrl;
        return;
      }

      if (result.action === "show_feedback_form") {
        setFeedbackId(result.feedbackId);
        setStep("private_form");
        return;
      }

      if (result.action === "already_submitted") {
        setStep("thank_you");
        return;
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    }

    setSubmitting(false);
  }

  // ─── Submit private feedback message ──────────────────────────────────
  async function submitFeedback() {
    if (!feedbackId || !message.trim()) return;
    setSubmitting(true);

    try {
      await fetch("/api/funnel/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackId, message }),
      });
    } catch {}

    setStep("thank_you");
    setSubmitting(false);
  }

  const displayRating = hoveredRating || selectedRating;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-7 text-center">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="h-10 mx-auto mb-3 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold text-lg">
                  {businessName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <h1 className="text-white font-semibold text-lg tracking-tight">{businessName}</h1>
            <p className="text-blue-200 text-sm mt-1">We value your feedback</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">

            {/* ─── STEP: Rating ─────────────────────────────────────── */}
            {step === "rating" && (
              <div className="text-center">
                <p className="text-gray-700 text-base mb-1">
                  Hi <strong>{customerFirstName}</strong>!
                </p>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                  How would you rate your experience with us?<br />
                  It only takes a second.
                </p>

                {/* Star rating */}
                <div className="flex justify-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      disabled={submitting}
                      onClick={() => submitRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className={`transition-all duration-100 disabled:cursor-not-allowed ${
                        submitting ? "opacity-50" : "hover:scale-110 active:scale-95"
                      }`}
                      aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                    >
                      <Star
                        size={44}
                        className={`transition-colors duration-100 ${
                          star <= displayRating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-gray-100 text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Rating label */}
                <p className="text-sm font-medium text-gray-600 h-5 mb-6 transition-all">
                  {displayRating > 0 ? ratingLabels[displayRating] : ""}
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
                    {error}
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Tap a star to submit your rating
                </p>
              </div>
            )}

            {/* ─── STEP: Redirecting ────────────────────────────────── */}
            {step === "redirecting" && (
              <div className="text-center py-6">
                <div className="relative mx-auto w-16 h-16 mb-6">
                  <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-40" />
                  <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you! 🎉</h2>
                <p className="text-gray-500 text-sm mb-6">
                  We're so glad you had a great experience. Taking you to leave a public review…
                </p>
                <div className="flex items-center justify-center gap-2 text-blue-600 text-sm font-medium">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Redirecting…
                </div>
              </div>
            )}

            {/* ─── STEP: Private feedback form ─────────────────────── */}
            {step === "private_form" && (
              <div>
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 mb-1">We're sorry to hear that</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      Your feedback helps us improve. Please tell us what went wrong — this stays private between you and us.
                    </p>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What could we have done better?
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please share your experience so we can make it right…"
                    rows={5}
                    maxLength={5000}
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-gray-400">{message.length}/5000</span>
                  </div>
                </div>

                <button
                  onClick={submitFeedback}
                  disabled={submitting || !message.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Feedback
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep("thank_you")}
                  className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
                >
                  Skip
                </button>
              </div>
            )}

            {/* ─── STEP: Thank you ─────────────────────────────────── */}
            {step === "thank_you" && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                  Thank you for your feedback!
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  We appreciate you taking the time to share your experience. Your feedback helps us serve you better.
                </p>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400 text-center">
              Powered by{" "}
              <a
                href="https://genuinepulse.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                GenuinePulse
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
