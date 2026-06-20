// src/app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "@/components/providers/QueryProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GenuinePulse", template: "%s | GenuinePulse" },
  description: "Reputation management platform — get more 5-star reviews automatically.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <QueryProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#1E293B",
                color: "#F1F5F9",
                fontSize: "13px",
                borderRadius: "8px",
                border: "0.5px solid #334155",
              },
              success: { iconTheme: { primary: "#10B981", secondary: "#fff" } },
              error: { iconTheme: { primary: "#EF4444", secondary: "#fff" } },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
