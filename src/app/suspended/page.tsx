// src/app/suspended/page.tsx
import { ShieldX } from "lucide-react";
import Link from "next/link";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-xl p-10 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <ShieldX size={28} className="text-red-500" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Account Suspended</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Your account has been suspended. If you believe this is a mistake,
          please contact our support team.
        </p>
        <a
          href="mailto:support@genuinepulse.com"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Contact Support
        </a>
        <p className="mt-4">
          <Link href="/sign-in" className="text-xs text-gray-400 hover:text-gray-600">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
