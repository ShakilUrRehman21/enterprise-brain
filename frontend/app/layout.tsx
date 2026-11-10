import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enterprise Brain — AI Knowledge Platform",
  description: "Permission-aware, evidence-grounded AI knowledge platform for enterprise intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen flex flex-col bg-[#0b0f17] text-slate-100">
        {children}
      </body>
    </html>
  );
}
