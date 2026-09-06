"use client";

import Link from "next/link";
import { PrismLogo } from "@/components/layout/Logo";

const navLinks = [
  { href: "/markets", label: "Markets" },
  { href: "/analyze/BTC", label: "Intelligence" },
  { href: "/trade", label: "Trade" },
  { href: "/positions", label: "Positions" },
  { href: "/settlement", label: "Settlement" },
  { href: "/replay", label: "Replay" },
  { href: "/thesis", label: "Thesis" },
];

const resourceLinks = [
  { href: "https://docs.dreamdex.io/developers/event-contracts", label: "DreamDEX Docs", external: true },
  { href: "https://shannon-explorer.somnia.network", label: "Somnia Explorer", external: true },
  { href: "https://github.com/somnia-chain/dreamdex-bot-kit", label: "DreamDEX Bot Kit", external: true },
];

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        background: "rgba(9, 9, 11, 0.98)",
        marginTop: "auto",
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 1400,
          padding: "48px 24px 32px",
        }}
      >
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10">
          {/* Brand & Mission Column */}
          <div className="md:col-span-6 flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
              <PrismLogo size={44} />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.4rem",
                  letterSpacing: "0.1em",
                  color: "#ffffff",
                }}
              >
                HORIZON
              </span>
            </Link>

            <p
              style={{
                fontSize: "0.85rem",
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.6)",
                maxWidth: 420,
                fontFamily: "var(--font-body)",
                margin: 0,
              }}
            >
              A temporal intelligence layer for DreamDEX Event Contracts.
              Transforming isolated event probabilities into a real-time trajectory of market conviction.
            </p>

            {/* Network pill */}
            <div className="flex items-center gap-2 pt-1">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 9999,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-data)",
                  color: "rgba(255, 255, 255, 0.7)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 8px #22c55e",
                  }}
                />
                Somnia Shannon Testnet · 50312
              </div>
            </div>
          </div>

          {/* Navigation Links Column */}
          <div className="md:col-span-3 flex flex-col gap-3">
            <div
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-data)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.4)",
              }}
            >
              Platform
            </div>
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="no-underline transition-colors"
                  style={{
                    fontSize: "0.82rem",
                    color: "rgba(255, 255, 255, 0.65)",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)";
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources Column */}
          <div className="md:col-span-3 flex flex-col gap-3">
            <div
              style={{
                fontSize: "0.72rem",
                fontFamily: "var(--font-data)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.4)",
              }}
            >
              Ecosystem
            </div>
            <div className="flex flex-col gap-2">
              {resourceLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 no-underline transition-colors"
                  style={{
                    fontSize: "0.82rem",
                    color: "rgba(255, 255, 255, 0.65)",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)";
                  }}
                >
                  {link.label}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ opacity: 0.6 }}
                  >
                    <path d="M7 17l9.2-9.2M17 17V8H8" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6"
          style={{
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
          }}
        >
          <p
            style={{
              fontSize: "0.75rem",
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: "var(--font-body)",
              margin: 0,
            }}
          >
            © 2026 Horizon. Somnia × DreamDEX Event Contracts Hackathon.
          </p>
          <p
            style={{
              fontSize: "0.72rem",
              color: "rgba(255, 255, 255, 0.35)",
              fontFamily: "var(--font-data)",
              margin: 0,
            }}
          >
            Decentralized Event Contract Intelligence
          </p>
        </div>
      </div>
    </footer>
  );
}
