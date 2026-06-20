// src/app/page.tsx
import Link from "next/link";
import { Star, Shield, BarChart2, MessageSquare, Zap, CheckCircle, ArrowRight } from "lucide-react";

export const metadata = {
  title: "GenuinePulse — Get More 5-Star Reviews",
  description: "Reputation management for US businesses. Collect customer feedback, generate more public reviews, and stop negative reviews before they go public.",
};

const FEATURES = [
  {
    icon: <Star size={20} className="text-amber-500" />,
    title: "Smart Review Funnel",
    desc: "Happy customers (4-5 stars) are redirected to Google or Yelp. Unhappy customers see a private form — stopping negative reviews before they go public.",
  },
  {
    icon: <MessageSquare size={20} className="text-blue-500" />,
    title: "SMS & Email Requests",
    desc: "Send personalized review requests via Twilio SMS and Resend Email. Automated follow-ups with retry logic ensure delivery.",
  },
  {
    icon: <Shield size={20} className="text-emerald-500" />,
    title: "Private Feedback Capture",
    desc: "Capture and resolve unhappy customer feedback internally before it becomes a public 1-star review.",
  },
  {
    icon: <BarChart2 size={20} className="text-violet-500" />,
    title: "Analytics Dashboard",
    desc: "Track requests sent, reviews generated, rating distribution, and conversion rates with real-time charts.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    features: ["500 SMS/month", "2,000 emails/month", "1 business location", "Review funnel", "Basic analytics"],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "/month",
    features: ["2,500 SMS/month", "Unlimited emails", "3 business locations", "Priority support", "Full analytics", "Custom templates"],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$299",
    period: "/month",
    features: ["Unlimited SMS", "Unlimited emails", "Unlimited locations", "Dedicated support", "Custom integrations", "White-labeling"],
    cta: "Contact us",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">GenuinePulse</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-200 mb-6">
          <Star size={11} className="fill-blue-500 text-blue-500" />
          Trusted by 500+ US businesses
        </div>
        <h1 className="text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-5 max-w-3xl mx-auto">
          Turn every customer into a{" "}
          <span className="text-blue-600">5-star review</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed">
          GenuinePulse helps US businesses collect more public reviews on Google and Yelp,
          while capturing negative feedback privately — before it damages your reputation.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/sign-up"
            className="bg-blue-600 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
          >
            Start 14-day free trial <ArrowRight size={15} />
          </Link>
          <Link
            href="#how-it-works"
            className="text-gray-600 font-medium px-6 py-3.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors text-sm"
          >
            See how it works
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required · Cancel anytime</p>
      </section>

      {/* Funnel diagram */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">The Smart Review Funnel</h2>
          <p className="text-gray-500">One link. Automatic routing. Maximum reviews.</p>
        </div>
        <div className="flex flex-col items-center gap-1">
          {[
            { label: "You send a review request", sub: "SMS or Email — personalized with their name", color: "bg-blue-600", w: "100%" },
            { label: "Customer rates their experience", sub: "1–5 star rating on a beautiful mobile page", color: "bg-blue-500", w: "88%" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center w-full">
              <div className={`${s.color} text-white rounded-xl px-6 py-4 flex justify-between items-center`} style={{ width: s.w }}>
                <span className="font-semibold text-sm">{s.label}</span>
                <span className="text-white/70 text-xs">{s.sub}</span>
              </div>
              <div className="text-gray-300 text-xl font-bold leading-none my-0.5">↓</div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4 w-full mt-1">
            <div className="bg-emerald-500 text-white rounded-xl p-5 text-center">
              <div className="text-2xl mb-1">⭐ ≥ 4 stars</div>
              <p className="font-semibold text-sm">Redirect to Google / Yelp</p>
              <p className="text-emerald-100 text-xs mt-1">Grows your public review count</p>
            </div>
            <div className="bg-amber-500 text-white rounded-xl p-5 text-center">
              <div className="text-2xl mb-1">😟 1–3 stars</div>
              <p className="font-semibold text-sm">Private feedback form</p>
              <p className="text-amber-100 text-xs mt-1">Captured internally — not on Google</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">Everything you need</h2>
            <p className="text-gray-500">Built specifically for service businesses</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
                <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center mb-4 border border-gray-100">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-800 text-sm mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-500">14-day free trial on all plans. Cancel anytime.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-7 relative ${
                p.highlighted
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : "border-gray-200 hover:border-gray-300"
              } transition-all`}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-wide uppercase">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="font-bold text-gray-900 text-lg">{p.name}</h3>
              <div className="mt-3 mb-5">
                <span className="text-4xl font-bold text-gray-900 tracking-tight">{p.price}</span>
                <span className="text-gray-400 text-sm">{p.period}</span>
              </div>
              <ul className="space-y-2.5 mb-7">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  p.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">
            Start collecting reviews today
          </h2>
          <p className="text-blue-100 mb-8 text-sm leading-relaxed">
            Join hundreds of US businesses using GenuinePulse to protect and grow their online reputation.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-7 py-3.5 rounded-xl hover:bg-blue-50 transition-colors text-sm"
          >
            Get started free <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <Zap size={10} className="text-white" />
            </div>
            <span>GenuinePulse</span>
          </div>
          <div className="flex gap-5">
            <a href="/privacy" className="hover:text-gray-600">Privacy</a>
            <a href="/terms" className="hover:text-gray-600">Terms</a>
            <a href="mailto:support@genuinepulse.com" className="hover:text-gray-600">Support</a>
          </div>
          <p>© {new Date().getFullYear()} GenuinePulse</p>
        </div>
      </footer>
    </div>
  );
}
