"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { PrismLogo } from "@/components/layout/Logo";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";

/* ═══════════════════════════════════════════════════════ */
/* Nav Config                                              */
/* ═══════════════════════════════════════════════════════ */

interface NavItem {
  href: string;
  label: string;
}

const topNav: NavItem[] = [
  { href: "/markets", label: "Markets" },
  { href: "/analyze/BTC", label: "Analyze" },
  { href: "/signals", label: "Signals" },
  { href: "/replay", label: "Replay" },
];

const portfolioItems: NavItem[] = [
  { href: "/portfolio", label: "Portofolio" },
  { href: "/positions", label: "Positions" },
  { href: "/thesis", label: "Thesis" },
  { href: "/settlement", label: "Settlement" },
];

const mobileNavGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Markets",
    items: [{ href: "/markets", label: "Explorer" }],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/analyze/BTC", label: "Analyze" },
      { href: "/signals", label: "Signals" },
      { href: "/replay", label: "Replay" },
    ],
  },
  {
    label: "Portfolio",
    items: portfolioItems,
  },
];

/* ═══════════════════════════════════════════════════════ */
/* Component                                               */
/* ═══════════════════════════════════════════════════════ */

export function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const isWrongChain = isConnected && chainId !== somniaShannon.id;

  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const walletMenuRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  /* ── Effects ─────────────────────────────────── */

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    setWalletMenuOpen(false);
    setPortfolioOpen(false);
    setNotificationOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (walletMenuRef.current && !walletMenuRef.current.contains(e.target as Node)) {
        setWalletMenuOpen(false);
      }
      if (portfolioRef.current && !portfolioRef.current.contains(e.target as Node)) {
        setPortfolioOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node) &&
        !(e.target as Element)?.closest?.("[data-notification-panel]")
      ) {
        setNotificationOpen(false);
      }
    }
    if (walletMenuOpen || portfolioOpen || notificationOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [walletMenuOpen, portfolioOpen, notificationOpen]);

  /* ── Helpers ─────────────────────────────────── */

  const closeDrawer = useCallback(() => setMobileOpen(false), []);

  function isActive(href: string) {
    if (href === "/analyze/BTC") return pathname.startsWith("/analyze");
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isPortfolioActive() {
    return portfolioItems.some((item) => isActive(item.href));
  }

  const fmt = (addr?: string) =>
    addr ? `${addr.slice(0, 4)}..${addr.slice(-4)}` : "";

  /* ── Render ──────────────────────────────────── */

  return (
    <>
      <header
        className="sticky top-0 z-30"
        style={{
          background: "rgba(9, 9, 11, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{ maxWidth: 1400, padding: "0 24px", height: 72 }}
        >
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 no-underline transition-opacity hover:opacity-90"
          >
            <PrismLogo size={48} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "1.3rem",
                letterSpacing: "0.1em",
                color: "#ffffff",
              }}
            >
              HORIZON
            </span>
          </Link>

          {/* ═══ Desktop Nav ═══ */}
          <nav
            className="hidden lg:flex items-center"
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 9999,
              padding: "4px 5px",
              gap: 2,
            }}
          >
            {/* Top nav items */}
            {topNav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="no-underline transition-all"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: active ? "6px 14px" : "6px 11px",
                    borderRadius: 9999,
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-body)",
                    fontWeight: active ? 600 : 500,
                    color: active ? "#09090b" : "rgba(255, 255, 255, 0.55)",
                    background: active ? "#ffffff" : "transparent",
                    boxShadow: active ? "0 1px 6px rgba(0, 0, 0, 0.3)" : "none",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.55)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* Portfolio Dropdown */}
            <div className="relative" ref={portfolioRef}>
              <button
                type="button"
                onClick={() => setPortfolioOpen(!portfolioOpen)}
                onMouseEnter={() => setPortfolioOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: isPortfolioActive() ? "6px 14px" : "6px 11px",
                  borderRadius: 9999,
                  fontSize: "0.8rem",
                  fontFamily: "var(--font-body)",
                  fontWeight: isPortfolioActive() ? 600 : 500,
                  color: isPortfolioActive() ? "#09090b" : "rgba(255, 255, 255, 0.55)",
                  background: isPortfolioActive() ? "#ffffff" : "transparent",
                  boxShadow: isPortfolioActive() ? "0 1px 6px rgba(0, 0, 0, 0.3)" : "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseLeave={(e) => {
                  if (!isPortfolioActive()) {
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.55)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                Overview
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  style={{
                    transform: portfolioOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                    opacity: 0.6,
                  }}
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
              </button>

              {portfolioOpen && (
                <div
                  onMouseLeave={() => setPortfolioOpen(false)}
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    top: "100%",
                    marginTop: 8,
                    minWidth: 160,
                    background: "#121316",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 12,
                    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
                    padding: "6px",
                    zIndex: 50,
                  }}
                >
                  {portfolioItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setPortfolioOpen(false)}
                        className="no-underline transition-all"
                        style={{
                          display: "block",
                          padding: "8px 14px",
                          borderRadius: 8,
                          fontSize: "0.8rem",
                          fontFamily: "var(--font-body)",
                          fontWeight: active ? 600 : 500,
                          color: active ? "#09090b" : "rgba(255, 255, 255, 0.7)",
                          background: active ? "#ffffff" : "transparent",
                          textDecoration: "none",
                          transition: "all 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = "#ffffff";
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = "rgba(255, 255, 255, 0.7)";
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* ═══ Right Side ═══ */}
          <div className="flex items-center gap-3">
            {/* Notification Bell — always visible */}
            {mounted && isConnected && (
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  style={{
                    position: "relative",
                    width: 36,
                    height: 36,
                    borderRadius: 9999,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    padding: 0,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.7)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  <NotificationBadge />
                </button>
                <NotificationPanel open={notificationOpen} onClose={() => setNotificationOpen(false)} />
              </div>
            )}

            {/* Desktop only: wrong chain + wallet + connect */}
            <div className="hidden lg:flex items-center gap-3">
              {mounted && isWrongChain && (
                <span
                  className="inline-flex items-center"
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 9999,
                    fontSize: "0.72rem",
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                    color: "var(--accent-warn)",
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                  }}
                >
                  Wrong Network
                </span>
              )}

              {mounted && isConnected && (
                <>
                  {/* Wallet Menu */}
                  <div className="relative" ref={walletMenuRef}>
                    <button
                      type="button"
                      onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        height: 36,
                        padding: "0 14px",
                        background: "#ffffff",
                        color: "#09090b",
                        borderRadius: 9999,
                        border: "none",
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        boxShadow: "0 1px 6px rgba(0, 0, 0, 0.25)",
                        transition: "opacity 0.15s ease",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                      </svg>
                      <span>{fmt(address)}</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="#09090b"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        style={{
                          transform: walletMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        <path d="M3 4.5L6 7.5L9 4.5" />
                      </svg>
                    </button>

                    {walletMenuOpen && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 44,
                          width: 210,
                          background: "#121316",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: 12,
                          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
                          padding: "10px",
                          zIndex: 50,
                        }}
                      >
                        <div style={{ padding: "4px 8px 8px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                          <div style={{ fontSize: "0.65rem", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Connected</div>
                          <div style={{ fontSize: "0.76rem", fontFamily: "var(--font-data)", color: "#ffffff", marginTop: 2 }}>{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                          <div style={{ fontSize: "0.68rem", color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>Somnia Shannon ({chainId})</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { disconnect(); setWalletMenuOpen(false); }}
                          style={{
                            width: "100%",
                            marginTop: 8,
                            height: 32,
                            borderRadius: 8,
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            background: "rgba(239, 68, 68, 0.1)",
                            color: "#f87171",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {mounted && !isConnected && (
                <button
                  type="button"
                  onClick={() => connect({ connector: connectors[0] })}
                  disabled={isPending}
                  style={{
                    height: 36,
                    padding: "0 18px",
                    background: "#ffffff",
                    color: "#09090b",
                    borderRadius: 9999,
                    border: "none",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: isPending ? "wait" : "pointer",
                    boxShadow: "0 1px 6px rgba(0, 0, 0, 0.25)",
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {isPending ? "Connecting..." : "Connect"}
                </button>
              )}

              {!mounted && (
                <div style={{ width: 96, height: 36, borderRadius: 9999, background: "rgba(255, 255, 255, 0.08)" }} />
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              type="button"
              className="lg:hidden flex items-center justify-center"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
              style={{
                width: 36,
                height: 36,
                padding: 0,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 9999,
                cursor: "pointer",
                color: "#ffffff",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                {mobileOpen ? (
                  <>
                    <line x1="3" y1="3" x2="13" y2="13" />
                    <line x1="13" y1="3" x2="3" y2="13" />
                  </>
                ) : (
                  <>
                    <line x1="2.5" y1="4.5" x2="13.5" y2="4.5" />
                    <line x1="2.5" y1="8" x2="13.5" y2="8" />
                    <line x1="2.5" y1="11.5" x2="13.5" y2="11.5" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Mobile Overlay ═══ */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={closeDrawer}
          style={{
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        />
      )}

      {/* ═══ Mobile Drawer ═══ */}
      <div
        className="lg:hidden fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 290,
          background: "#0d0e12",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Drawer Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.85rem",
              letterSpacing: "0.06em",
              color: "#ffffff",
            }}
          >
            HORIZON
          </span>
          <button
            type="button"
            onClick={closeDrawer}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: 0,
              padding: 6,
              borderRadius: "50%",
              cursor: "pointer",
              color: "rgba(255, 255, 255, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>

        {/* Grouped Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ padding: "12px 10px" }}>
          <div className="flex flex-col gap-1">
            {mobileNavGroups.map((group, gi) => (
              <div key={gi}>
                <div
                  style={{
                    fontSize: "0.62rem",
                    fontFamily: "var(--font-data)",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(255, 255, 255, 0.25)",
                    padding: "10px 12px 4px",
                  }}
                >
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeDrawer}
                      className="no-underline transition-all"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "9px 12px",
                        fontSize: "0.85rem",
                        fontFamily: "var(--font-body)",
                        fontWeight: active ? 600 : 500,
                        borderRadius: 10,
                        color: active ? "#09090b" : "rgba(255, 255, 255, 0.7)",
                        background: active ? "#ffffff" : "transparent",
                        boxShadow: active ? "0 1px 6px rgba(0, 0, 0, 0.3)" : "none",
                        margin: "1px 0",
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Drawer Footer — Following + Wallet */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", flexDirection: "column", gap: 8 }}>
          <Link
            href="/signals/following"
            onClick={closeDrawer}
            className="no-underline"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              height: 34,
              borderRadius: 9999,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Following
          </Link>

          {/* Wallet at bottom */}
          {mounted && isConnected ? (
            <div
              className="flex items-center justify-between"
              style={{
                height: 34,
                padding: "0 12px",
                borderRadius: 9999,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div className="flex items-center gap-2">
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-success)" }} />
                <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-data)", color: "rgba(255, 255, 255, 0.7)" }}>
                  {fmt(address)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { disconnect(); closeDrawer(); }}
                style={{
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 9999,
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#f87171",
                  fontSize: "0.65rem",
                  fontFamily: "var(--font-data)",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </div>
          ) : mounted ? (
            <button
              type="button"
              onClick={() => { connect({ connector: connectors[0] }); closeDrawer(); }}
              disabled={isPending}
              style={{
                width: "100%",
                height: 34,
                borderRadius: 9999,
                background: "#ffffff",
                color: "#09090b",
                border: "none",
                fontWeight: 600,
                fontSize: "0.78rem",
                fontFamily: "var(--font-body)",
                cursor: isPending ? "wait" : "pointer",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
            >
              {isPending ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
