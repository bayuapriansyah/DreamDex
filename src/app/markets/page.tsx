"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  probBarBg,
  formatHorizon,
  pctStr,
} from "@/lib/dreamdex/formatting";
import { TemporalActivityFeed } from "@/components/activity/TemporalActivityFeed";

interface HorizonData {
  horizonMinutes: number;
  midProbability: number | null;
  secondsLeft: number;
  dataQuality: string;
  status: string;
}

interface MarketTemporal {
  asset: string;
  state: string;
  stateLabel: string;
  confidence: number;
  trajectoryScore: number;
  velocityPerHour: number;
  reversalRisk: number;
  crossHorizonDivergence: number;
  horizons: HorizonData[];
}

function formatPct(p: number | null): string {
  if (p === null) return "—";
  return `${pctStr(p, 0)}%`;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Locking...";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s to lock`;
  return `${s}s to lock`;
}

function getLifecycleDisplay(
  status: string,
  secondsLeft: number
): { label: string; color: string } {
  if (status === "Resolved" || status === "Finalized") {
    return { label: "RESOLVED", color: "var(--text-secondary)" };
  }
  if (status === "Voided") {
    return { label: "VOIDED", color: "var(--accent-warn)" };
  }
  if (status === "Locked" || status === "Settling") {
    return { label: "LOCKED", color: "var(--accent-secondary)" };
  }
  if (status === "Trading" && secondsLeft < 300 && secondsLeft > 0) {
    return { label: "LOCKING SOON", color: "var(--accent-warn)" };
  }
  if (status === "Trading") {
    return { label: "TRADING", color: "var(--accent)" };
  }
  return { label: status.toUpperCase(), color: "var(--text-secondary)" };
}

function isTerminalStatus(status: string): boolean {
  return (
    status === "Resolved" ||
    status === "Finalized" ||
    status === "Voided" ||
    status === "Locked" ||
    status === "Settling"
  );
}

function LifecycleBadge({
  status,
  secondsLeft,
}: {
  status: string;
  secondsLeft?: number;
}) {
  const { label, color } = getLifecycleDisplay(
    status,
    secondsLeft ?? Infinity
  );
  return (
    <span
      className="status-pill"
      style={{
        color,
        background: `${color}15`,
        border: `1px solid ${color}25`,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </span>
  );
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketTemporal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        // Dynamic asset discovery from markets API
        const marketsRes = await fetch("/api/dreamdex/markets");
        if (!marketsRes.ok) throw new Error(`HTTP ${marketsRes.status}`);
        const marketsData = await marketsRes.json();
        const assets: string[] = marketsData.ok ? Object.keys(marketsData.grouped || {}) : ["BTC", "ETH"];

        const results: MarketTemporal[] = [];
        for (const asset of assets) {
          const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!fetchedRef.current && data.ok && data.trajectory) {
            const t = data.trajectory;
            results.push({
              asset,
              state: t.state,
              stateLabel: t.stateLabel,
              confidence: t.confidence,
              trajectoryScore: t.trajectoryScore,
              velocityPerHour: t.metrics.velocityPerHour,
              reversalRisk: t.reversalRisk,
              crossHorizonDivergence: t.metrics.crossHorizonDivergence,
              horizons: t.horizons.map(
                (h: {
                  horizonMinutes: number;
                  midProbability: number | null;
                  secondsLeft: number;
                  dataQuality: string;
                  status: string;
                }) => ({
                  horizonMinutes: h.horizonMinutes,
                  midProbability: h.midProbability,
                  secondsLeft: h.secondsLeft,
                  dataQuality: h.dataQuality,
                  status: h.status,
                })
              ),
            });
          }
        }
        if (!fetchedRef.current) {
          setMarkets(results);
          setLastUpdated(new Date().toLocaleTimeString());
          if (results.length === 0)
            setError("No active Event Contract markets available.");
        }
      } catch (e) {
        if (!fetchedRef.current) {
          setError(
            e instanceof Error ? e.message : "Failed to load markets"
          );
        }
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, 30000);
    return () => {
      fetchedRef.current = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 1100, paddingTop: 32, paddingBottom: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-10 animate-fade-up">
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
            Market Explorer
          </h1>
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
        <span
          style={{
            fontSize: 13,
            fontFamily: "var(--font-data)",
            color: "var(--text-secondary)",
          }}
        >
          {markets.length} markets
        </span>
      </div>

      {/* Loading */}
      {loading && markets.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="card" style={{ padding: 32 }}>
              <div className="flex gap-4">
                <div className="skeleton" style={{ width: 80, height: 32 }} />
                <div className="flex-1 space-y-4">
                  <div className="skeleton" style={{ height: 20, width: 140 }} />
                  <div className="flex gap-3">
                    {[0, 1, 2].map((j) => (
                      <div
                        key={j}
                        className="skeleton"
                        style={{ height: 100, flex: 1 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && markets.length === 0 && (
        <div className="card text-center" style={{ padding: 64 }}>
          <p
            style={{
              fontSize: 16,
              color: "var(--text-secondary)",
              marginBottom: 20,
            }}
          >
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && markets.length === 0 && (
        <div className="card text-center" style={{ padding: 64 }}>
          <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
            No active Event Contract markets available.
          </p>
          <p
            style={{
              fontSize: 13,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
              marginTop: 8,
            }}
          >
            Waiting for Shannon testnet data.
          </p>
        </div>
      )}

      {/* Market Cards */}
      {markets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {markets.map((market, idx) => {
            const sorted = [...market.horizons].sort(
              (a, b) => a.horizonMinutes - b.horizonMinutes
            );
            const statuses = market.horizons.map((h) => h.status);
            const hasLocked = statuses.some(
              (s) => s === "Locked" || s === "Settling"
            );
            const allTerminal = statuses.every((s) => isTerminalStatus(s));
            const anyTrading = statuses.some((s) => s === "Trading");
            const tradingHorizons = market.horizons.filter(
              (h) => h.status === "Trading"
            );
            const minSecondsLeft =
              tradingHorizons.length > 0
                ? Math.min(...tradingHorizons.map((h) => h.secondsLeft))
                : Infinity;
            const shortestHorizon = sorted[0];
            const isCountdown =
              shortestHorizon?.status === "Trading" &&
              shortestHorizon.secondsLeft < 300 &&
              shortestHorizon.secondsLeft > 0;

            return (
              <Link
                key={market.asset}
                href={`/analyze/${market.asset}`}
                className="card card-interactive no-underline p-5 sm:p-8 animate-fade-up"
                style={{
                  animationDelay: `${0.05 + idx * 0.1}s`,
                }}
              >
                {/* Asset Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-4">
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 32,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {market.asset}
                    </span>
                    <LifecycleBadge
                      status={
                        allTerminal
                          ? statuses[0] === "Voided"
                            ? "Voided"
                            : "Resolved"
                          : hasLocked
                            ? "Locked"
                            : anyTrading
                              ? "Trading"
                              : statuses[0]
                      }
                      secondsLeft={
                        anyTrading && !allTerminal ? minSecondsLeft : undefined
                      }
                    />
                    {isCountdown && (
                      <span
                        className="status-pill"
                        style={{
                          color: "var(--accent-warn)",
                          background: "var(--accent-warn)15",
                          border: "1px solid var(--accent-warn)25",
                          fontSize: 10,
                          fontWeight: 600,
                          fontFeatureSettings: '"tnum"',
                        }}
                      >
                        {formatCountdown(shortestHorizon.secondsLeft)}
                      </span>
                    )}
                    {allTerminal && (
                      <span
                        className="form-label"
                        style={{
                          fontSize: 10,
                          color: "var(--text-tertiary)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        FINAL
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-data)",
                      color: "var(--text-secondary)",
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {pctStr(market.confidence, 0)}% conf
                  </span>
                </div>

                {/* Horizon Bars — Bigger */}
                <div className="flex gap-4 mb-6">
                  {sorted.map((h) => {
                    const hTerminal = isTerminalStatus(h.status);
                    const hTrading = h.status === "Trading";
                    const hLockingSoon =
                      hTrading && h.secondsLeft < 300 && h.secondsLeft > 0;
                    return (
                      <div
                        key={h.horizonMinutes}
                        className="flex-1 text-center"
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-data)",
                            color: "var(--text-tertiary)",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {formatHorizon(h.horizonMinutes)}
                        </div>
                        <div
                          className="relative overflow-hidden"
                          style={{
                            height: 100,
                            borderRadius: "var(--radius-md)",
                            background: "var(--surface-2)",
                          }}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 metric-fill"
                            style={{
                              height: `${(h.midProbability ?? 0.5) * 100}%`,
                              background: probBarBg(h.midProbability),
                              borderRadius:
                                "var(--radius-md) var(--radius-md) 0 0",
                              opacity: hTerminal ? 0.5 : 1,
                            }}
                          />
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: 24,
                            fontFamily: "var(--font-data)",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginTop: 12,
                          }}
                        >
                          {formatPct(h.midProbability)}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          {hTerminal ? (
                            <span
                              className="form-label"
                              style={{
                                fontSize: 9,
                                color: "var(--text-tertiary)",
                                letterSpacing: "0.04em",
                              }}
                            >
                              FINAL
                            </span>
                          ) : hLockingSoon ? (
                            <span
                              className="status-pill"
                              style={{
                                fontSize: 9,
                                color: "var(--accent-warn)",
                                fontFeatureSettings: '"tnum"',
                              }}
                            >
                              {formatCountdown(h.secondsLeft)}
                            </span>
                          ) : hTrading ? (
                            <span
                              className="status-pill"
                              style={{
                                fontSize: 9,
                                color: "var(--accent)",
                              }}
                            >
                              LIVE
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Metrics Row */}
                <div
                  className="flex flex-wrap items-center gap-x-6 gap-y-2.5"
                  style={{
                    padding: "16px 0 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Velocity
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 14,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color:
                          market.velocityPerHour > 0
                            ? "var(--accent)"
                            : "var(--accent-secondary)",
                      }}
                    >
                      {market.velocityPerHour > 0 ? "+" : ""}
                      {pctStr(market.velocityPerHour, 2)}%/hr
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Divergence
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 14,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {pctStr(market.crossHorizonDivergence, 1)}pp
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Rev Risk
                    </span>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 14,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color:
                          market.reversalRisk > 0.5
                            ? "var(--accent-warn)"
                            : "var(--text-primary)",
                      }}
                    >
                      {pctStr(market.reversalRisk, 0)}%
                    </span>
                  </div>
                  <div className="ml-auto">
                    <span
                      className="flex items-center gap-1.5"
                      style={{
                        fontSize: 14,
                        fontFamily: "var(--font-body)",
                        fontWeight: 500,
                        color: "var(--accent)",
                      }}
                    >
                      Analyze
                      <svg
                        width="16"
                        height="16"
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
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* TEMPORAL ACTIVITY — Live feed */}
      <div style={{ marginTop: 48 }}>
        <div className="flex items-center gap-3 mb-4">
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--text-primary)" }}>
            Temporal Activity
          </h2>
          <span className="live-dot">LIVE</span>
        </div>
        <TemporalActivityFeed />
      </div>
    </div>
  );
}
