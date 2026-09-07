import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { WagmiProvider } from "@/components/providers/WagmiProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GlobalCopilot } from "@/components/copilot/GlobalCopilot";

export const metadata: Metadata = {
  title: "Horizon — Temporal Intelligence for Event Contracts",
  description:
    "Transform DreamDEX Event Contracts into a real-time trajectory of market conviction across time horizons.",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WagmiProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <GlobalCopilot />
        </WagmiProvider>
      </body>
    </html>
  );
}
