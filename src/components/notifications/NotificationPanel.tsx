"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  type SignalNotification,
  getNotifications,
  markRead,
  markAllRead,
  clearNotifications,
} from "@/lib/dreamdex/notifications";

const TYPE_ICONS: Record<string, string> = {
  "probability-shift": "📊",
  "regime-change": "🔄",
  "risk-change": "⚠️",
  "confidence-change": "📈",
};

const TYPE_LABELS: Record<string, string> = {
  "probability-shift": "PROB SHIFT",
  "regime-change": "REGIME CHANGE",
  "risk-change": "RISK ALERT",
  "confidence-change": "CONFIDENCE",
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    function handler(e: MediaQueryListEvent) { setIsMobile(e.matches); }
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { address } = useAccount();
  const [notifications, setNotifications] = useState<SignalNotification[]>([]);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!address || !open) return;
    const list = getNotifications(address);
    setNotifications(list);
  }, [address, open]);

  // Lock body scroll on mobile when sheet is open
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, isMobile]);

  // Desktop click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (!isMobile && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [isMobile, onClose]
  );

  useEffect(() => {
    if (open && !isMobile) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, isMobile, handleClickOutside]);

  function handleMarkRead(id: string) {
    if (!address) return;
    markRead(address, id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  function handleMarkAllRead() {
    if (!address) return;
    markAllRead(address);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleClear() {
    if (!address) return;
    clearNotifications(address);
    setNotifications([]);
  }

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* ── Notification List Content ── */
  const renderList = () => (
    <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
      {notifications.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
            }}
          >
            🔔
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "0.9rem",
                color: "#ffffff",
                marginBottom: 4,
              }}
            >
              No Signal Alerts
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                fontFamily: "var(--font-body)",
                color: "rgba(255, 255, 255, 0.4)",
                maxWidth: 240,
                lineHeight: 1.5,
              }}
            >
              Changes in conviction or regime for your followed signals will appear here.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleMarkRead(n.id)}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                background: n.read ? "transparent" : "rgba(245, 158, 11, 0.04)",
                cursor: "pointer",
                transition: "background 0.15s ease",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = n.read
                  ? "rgba(255, 255, 255, 0.03)"
                  : "rgba(245, 158, 11, 0.07)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = n.read
                  ? "transparent"
                  : "rgba(245, 158, 11, 0.04)";
              }}
            >
              <div className="flex items-start gap-3">
                <span style={{ fontSize: 16, lineHeight: "22px", flexShrink: 0 }}>
                  {TYPE_ICONS[n.type] ?? "📊"}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {n.asset && (
                        <span
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "rgba(255, 255, 255, 0.08)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {n.asset}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontFamily: "var(--font-body)",
                          fontWeight: n.read ? 500 : 600,
                          color: "#ffffff",
                        }}
                      >
                        {n.title}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontFamily: "var(--font-data)",
                        color: "rgba(255, 255, 255, 0.35)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {timeAgo(n.timestamp)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-body)",
                      color: "rgba(255, 255, 255, 0.6)",
                      lineHeight: 1.45,
                      marginBottom: 6,
                    }}
                  >
                    {n.detail}
                  </div>

                  <div className="flex items-center justify-between">
                    <Link
                      href={n.asset ? `/analyze/${n.asset}` : `/signals/following`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                      }}
                      style={{
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: "var(--accent)",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      View Analysis →
                    </Link>

                    {!n.read && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.65rem",
                          fontFamily: "var(--font-data)",
                          color: "var(--accent)",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--accent)",
                            boxShadow: "0 0 6px var(--accent)",
                          }}
                        />
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Header Bar ── */
  const renderHeader = () => (
    <div
      className="flex items-center justify-between"
      style={{
        padding: isMobile ? "14px 18px" : "14px 18px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "0.85rem",
            letterSpacing: "0.06em",
            color: "#ffffff",
          }}
        >
          SIGNAL ALERTS
        </span>
        {unreadCount > 0 && (
          <span
            style={{
              padding: "2px 7px",
              borderRadius: 9999,
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "var(--accent)",
              fontFamily: "var(--font-data)",
              fontSize: "0.65rem",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {unreadCount} NEW
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            style={{
              fontSize: "0.72rem",
              fontFamily: "var(--font-data)",
              color: "var(--accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            Mark all read
          </button>
        )}
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              fontSize: "0.72rem",
              fontFamily: "var(--font-data)",
              color: "rgba(255, 255, 255, 0.4)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            Clear
          </button>
        )}
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification sheet"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              cursor: "pointer",
              color: "rgba(255, 255, 255, 0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              marginLeft: 4,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  /* ── Footer Bar ── */
  const renderFooter = () => (
    <div
      style={{
        padding: "10px 16px",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(255, 255, 255, 0.02)",
      }}
    >
      <Link
        href="/signals/following"
        onClick={onClose}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          width: "100%",
          padding: "8px 14px",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          color: "rgba(255, 255, 255, 0.8)",
          fontSize: "0.75rem",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          textDecoration: "none",
          transition: "background 0.15s ease",
        }}
      >
        <span>Manage Followed Signals</span>
        <span>→</span>
      </Link>
    </div>
  );

  /* ═══ MOBILE: Bottom Sheet with Portal ═══ */
  if (isMobile) {
    if (!mounted) return null;

    return createPortal(
      <div
        data-notification-panel="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {/* Dark Backdrop */}
        <div
          onClick={onClose}
          className="animate-fade-in"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.72)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 1,
          }}
        />

        {/* Slide-Up Bottom Sheet */}
        <div
          ref={panelRef}
          className="animate-slide-up"
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxHeight: "82vh",
            display: "flex",
            flexDirection: "column",
            background: "#111114",
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "24px 24px 0 0",
            boxShadow: "0 -12px 40px rgba(0, 0, 0, 0.75)",
            overflow: "hidden",
          }}
        >
          {/* Grab Handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
            <div
              style={{
                width: 38,
                height: 4,
                borderRadius: 9999,
                background: "rgba(255, 255, 255, 0.2)",
              }}
            />
          </div>

          {renderHeader()}
          {renderList()}
          {renderFooter()}
        </div>
      </div>,
      document.body
    );
  }

  /* ═══ DESKTOP: Floating Dropdown under Bell ═══ */
  return (
    <div
      ref={panelRef}
      data-notification-panel="true"
      className="animate-fade-in"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 380,
        maxHeight: 520,
        background: "#111114",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 16,
        boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7)",
        zIndex: 200,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {renderHeader()}
      {renderList()}
      {renderFooter()}
    </div>
  );
}
