import React from "react";
import "./globals.css";
import { Providers } from "@/providers";

export const metadata = {
  title: "SupportAI Dashboard",
  description: "AI-Powered Customer Support SaaS Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

