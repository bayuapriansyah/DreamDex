import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { WagmiProvider } from "@/components/providers/WagmiProvider";
import { Header } from "@/components/layout/Header";

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "DreamDex Temporal — Event Contract Intelligence",
  description:
    "Transform DreamDEX Event Contracts into a real-time probability trajectory.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WagmiProvider>
          <Header />
          <main className="flex-1">{children}</main>
        </WagmiProvider>
      </body>
    </html>
  );
}
