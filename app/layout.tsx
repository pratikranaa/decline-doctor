import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Decline Doctor — AI payment-failure diagnosis",
  description:
    "Paste a failed payment. Get the root cause, a retry-safe recovery decision, and a customer message — in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
