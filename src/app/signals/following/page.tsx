"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  formatProb,
  formatHorizon,
  pctStr,
} from "@/lib/dreamdex/formatting";
import {
  type FollowedSignal,
  getFollows,
  removeFollow,
  detectMaterialChange,
  deriveFollowStatus,
  updateFollowTimestamp,
} from "@/lib/dreamdex/following";
import {
  getNotifications,
  createNotifications,
} from "@/lib/dreamdex/notifications";

interface EnrichedFollow {
  follow: FollowedSignal;
  current: {
    probability: number | null;
    state: string;
    stateLabel: string;
    confidence: number;
    reversalRisk: number;
    velocityPerHour: number;
    divergence: number;
    asOf: string;
  } | null;
  status: ReturnType<typeof deriveFollowStatus>;
}

function freshnessClass(asOf: string): "live" | "recent" | "stale" {
  const age = Date.now() - new Date(asOf).getTime();
  if (age < 15_000) return "live";
  if (age < 60_000) return "recent";
  return "stale";
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  STRENGTHENING: { color: "var(--accent)", label: "STRENGTHENING" },
  WEAKENING: { color: "var(--accent-secondary)", label: "WEAKENING" },
  UNCHANGED: { color: "var(--text-secondary)", label: "UNCHANGED" },
  INVALIDATED: { color: "var(--accent-warn)", label: "INVALIDATED" },
};

function signalColor(state: string): string {
  if (state.startsWith("bullish")) return "var(--accent)";
  if (state.startsWith("bearish")) return "var(--accent-secondary)";
  if (state === "reversal-warning" || state === "cross-horizon-conflict")
    return "var(--accent-warn)";
  return "var(--text-secondary)";
}

export default function FollowingPage() {
  const { address, isConnected } = useAccount();
  const [follows, setFollows] = useState<EnrichedFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const loadFollows = useCallback(async () => {
    if (!address) return;
    const walletFollows = getFollows(address);
    const enriched: EnrichedFollow[] = [];

    for (const follow of walletFollows) {
      try {
        const res = await fetch(
          `/api/dreamdex/temporal?asset=${follow.asset}`
        );
        const data = await res.json();
        if (data.ok && data.trajectory) {
          const t = data.trajectory;
          const firstValid = t.horizons?.find(
            (h: { midProbability: number | null }) =>
              h.midProbability !== null
          );
          const currentProb = firstValid?.midProbability ?? null;

          const { changed, changes } = detectMaterialChange(follow, {
            probability: currentProb,
            state: t.state,
            confidence: t.confidence,
            reversalRisk: t.reversalRisk,
            divergence: t.metrics.crossHorizonDivergence,
            velocity: t.metrics.velocityPerHour,
            actionability: data.decisionContext?.actionability ?? "low",
          });

          if (changed) {
            createNotifications(address, follow.id, follow.asset, changes);
          }

          updateFollowTimestamp(address, follow.id);

          const current = {
            probability: currentProb,
            state: t.state,
            stateLabel: t.stateLabel,
            confidence: t.confidence,
            reversalRisk: t.reversalRisk,
            velocityPerHour: t.metrics.velocityPerHour,
            divergence: t.metrics.crossHorizonDivergence,
            asOf: t.asOf,
          };

          enriched.push({
            follow,
            current,
            status: deriveFollowStatus(follow, {
              probability: currentProb,
              state: t.state,
              confidence: t.confidence,
              reversalRisk: t.reversalRisk,
            }),
          });
        } else {
          enriched.push({
            follow,
            current: null,
            status: { status: "UNCHANGED", delta: 0 },
          });
        }
      } catch {
        enriched.push({
          follow,
          current: null,
          status: { status: "UNCHANGED", delta: 0 },
        });
      }
    }

    setFollows(enriched);
    setLastUpdated(new Date().toLocaleTimeString());
  }, [address]);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    void loadFollows();
    setLoading(false);

    const interval = setInterval(loadFollows, 30000);
    return () => clearInterval(interval);
  }, [address, loadFollows]);

  function handleUnfollow(followId: string) {
    if (!address) return;
    removeFollow(address, followId);
    setFollows((prev) => prev.filter((e) => e.follow.id !== followId));
  }

  if (!isConnected) {
    return (
      <div
        className="mx-auto px-4 text-center"
        style={{ maxWidth: 800, paddingTop: 80 }}
      >
        <div className="card" style={{ padding: 64 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 24,
              color: "var(--text-primary)",
              marginBottom: 12,
            }}
          >
            Connect Wallet
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 0,
            }}
          >
            Connect your wallet to view followed signals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 1100, paddingTop: 32, paddingBottom: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 40px)",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            My Following
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 0,
            }}
          >
            Signals you are monitoring for conviction changes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="live-dot" style={{ fontSize: 12 }}>Live</span>
          {lastUpdated && (
            <span
              style={{
                fontSize: 13,
                fontFamily: "var(--font-data)",
                color: "var(--text-tertiary)",
              }}
            >
              Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && follows.length === 0 && (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="card" style={{ padding: 32 }}>
              <div className="flex gap-4">
                <div className="skeleton" style={{ width: 80, height: 24 }} />
                <div className="flex-1 space-y-3">
                  <div className="skeleton" style={{ height: 16, width: 120 }} />
                  <div className="skeleton" style={{ height: 40, width: "100%" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && follows.length === 0 && (
        <div className="card text-center" style={{ padding: 64 }}>
          <p
            style={{
              fontSize: 18,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            No followed signals
          </p>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 24,
            }}
          >
            Follow a temporal signal to monitor how conviction evolves.
          </p>
          <Link href="/signals" className="btn-primary" style={{ textDecoration: "none" }}>
            Explore Signals
          </Link>
        </div>
      )}

      {/* Followed signals */}
      {follows.length > 0 && (
        <div className="space-y-4">
          {follows.map((enriched, idx) => {
            const { follow, current, status } = enriched;
            const color = current
              ? signalColor(current.state)
              : "var(--text-secondary)";
            const statusStyle = STATUS_STYLES[status.status];
            const ppDelta = status.delta;
            const age = Date.now() - new Date(follow.followedAt).getTime();
            const followedMins = Math.floor(age / 60000);

            return (
              <div
                key={follow.id}
                className="card animate-fade-up"
                style={{
                  padding: 28,
                  animationDelay: `${0.05 + idx * 0.05}s`,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 22,
                        color: "var(--text-primary)",
                      }}
                    >
                      {follow.asset} / USD
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {formatHorizon(follow.horizonMinutes)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-data)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    FOLLOWED {followedMins < 1 ? "just now" : `${followedMins}m ago`}
                  </span>
                </div>

                {/* Metrics comparison */}
                <div
                  className="grid grid-cols-5 gap-4 mb-5"
                  style={{
                    padding: "14px 0",
                    borderTop: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {/* Baseline */}
                  <div>
                    <span className="form-label" style={{ marginBottom: 4, fontSize: 10 }}>
                      BASELINE
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 22,
                        fontFamily: "var(--font-data)",
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {pctStr(follow.baselineProbability, 0)}%
                    </span>
                  </div>

                  {/* Current */}
                  <div>
                    <span className="form-label" style={{ marginBottom: 4, fontSize: 10 }}>
                      CURRENT
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 22,
                        fontFamily: "var(--font-data)",
                        fontWeight: 700,
                        color,
                      }}
                    >
                      {current?.probability !== null && current?.probability !== undefined
                        ? pctStr(current.probability, 0) + "%"
                        : "—"}
                    </span>
                  </div>

                  {/* Change */}
                  <div>
                    <span className="form-label" style={{ marginBottom: 4, fontSize: 10 }}>
                      CHANGE
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 22,
                        fontFamily: "var(--font-data)",
                        fontWeight: 700,
                        color:
                          ppDelta > 0
                            ? "var(--accent)"
                            : ppDelta < 0
                              ? "var(--accent-secondary)"
                              : "var(--text-secondary)",
                      }}
                    >
                      {ppDelta > 0 ? "+" : ""}{ppDelta}pp
                    </span>
                  </div>

                  {/* Confidence */}
                  <div>
                    <span className="form-label" style={{ marginBottom: 4, fontSize: 10 }}>
                      CONFIDENCE
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 18,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {current?.confidence !== undefined
                        ? `${pctStr(current.confidence, 0)}%`
                        : "—"}
                    </span>
                  </div>

                  {/* Reversal Risk */}
                  <div>
                    <span className="form-label" style={{ marginBottom: 4, fontSize: 10 }}>
                      REVERSAL RISK
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 18,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color:
                          (current?.reversalRisk ?? 0) > 0.5
                            ? "var(--accent-warn)"
                            : "var(--text-primary)",
                      }}
                    >
                      {current?.reversalRisk !== undefined
                        ? `${pctStr(current.reversalRisk, 0)}%`
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Regime + Status row */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span className="form-label" style={{ fontSize: 10 }}>
                      REGIME
                    </span>
                    {current && (
                      <span
                        className="status-pill"
                        style={{
                          color,
                          background: `${color}18`,
                          border: `1px solid ${color}30`,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {current.stateLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="form-label" style={{ fontSize: 10 }}>
                      STATUS
                    </span>
                    <span
                      className="status-pill"
                      style={{
                        color: statusStyle?.color,
                        background: `${statusStyle?.color}18`,
                        border: `1px solid ${statusStyle?.color}30`,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {statusStyle?.label ?? "UNKNOWN"}
                    </span>
                  </div>
                </div>

                {/* Freshness */}
                {current && (
                  <div
                    className="flex items-center gap-2 mb-4"
                    style={{
                      fontSize: 11,
                      fontFamily: "var(--font-data)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span
                      className="live-dot"
                      style={{
                        width: 6,
                        height: 6,
                        background:
                          freshnessClass(current.asOf) === "live"
                            ? "var(--accent-success)"
                            : freshnessClass(current.asOf) === "recent"
                              ? "var(--accent)"
                              : "var(--accent-warn)",
                      }}
                    />
                    {freshnessClass(current.asOf) === "stale"
                      ? "DATA STALE"
                      : `Updated ${freshnessClass(current.asOf) === "live" ? "just now" : "recently"}`}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Link
                    href={`/analyze/${follow.asset}?from=follow&horizon=${follow.horizonMinutes}`}
                    className="flex-1 flex items-center justify-center gap-2"
                    style={{
                      height: 36,
                      borderRadius: "var(--radius-full)",
                      background: `${color}12`,
                      border: `1px solid ${color}25`,
                      color,
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                      fontSize: 13,
                      textDecoration: "none",
                      transition: "all var(--duration-normal) var(--ease-out)",
                    }}
                  >
                    Open Analysis
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleUnfollow(follow.id)}
                    className="btn-secondary"
                    style={{
                      height: 36,
                      padding: "0 16px",
                      fontSize: 12,
                      fontFamily: "var(--font-data)",
                      fontWeight: 500,
                      color: "var(--accent-warn)",
                      borderColor: "var(--accent-warn)",
                    }}
                  >
                    Unfollow
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notification count */}
      {address && (
        <div
          className="mt-8 text-center"
          style={{
            fontSize: 12,
            fontFamily: "var(--font-data)",
            color: "var(--text-tertiary)",
          }}
        >
          LOCAL SIGNAL ALERTS — data stored in browser only
        </div>
      )}
    </div>
  );
}
