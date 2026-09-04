"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface HorizonData {
  horizonMinutes: number;
  lastPrice: number | null;
  secondsLeft: number;
  marketId: string;
}

interface TemporalSnapshot {
  state: string;
  stateLabel: string;
  confidence: number;
  reversalRisk: number;
  velocityPerHour: number;
}

interface Market {
  asset: string;
  horizons: HorizonData[];
}

function formatProb(p: number | null): string {
  if (p === null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function formatHorizon(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(0)}h`;
  return `${(mins / 1440).toFixed(0)}d`;
}

function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

function stateColor(state: string): string {
  if (state.includes("bullish")) return "var(--accent-copper)";
  if (state.includes("bearish")) return "var(--accent-steel)";
  if (state === "reversal-warning") return "var(--accent-warn)";
  return "var(--muted-foreground)";
}

function probBarColor(p: number): string {
  if (p > 0.6) return "var(--accent-copper)";
  if (p < 0.4) return "var(--accent-steel)";
  return "rgba(239,230,214,0.25)";
}

export function MarketList() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [temporals, setTemporals] = useState<Record<string, TemporalSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        const res = await fetch("/api/dreamdex/markets", { cache: "no-store" });
        const data = await res.json();
        if (fetchedRef.current) return;

        if (data.ok) {
          const grouped = data.grouped as Record<string, { horizonMinutes: number; marketId: string; lastPrice: number | null; secondsLeft: number }[]>;
          const assetList: Market[] = Object.entries(grouped).map(([asset, horizons]) => ({
            asset,
            horizons: horizons.map((h) => ({
              horizonMinutes: h.horizonMinutes,
              lastPrice: h.lastPrice,
              secondsLeft: h.secondsLeft,
              marketId: h.marketId,
            })),
          }));
          setMarkets(assetList);
          setLastUpdated(new Date());

          for (const m of assetList) {
            try {
              const tRes = await fetch(`/api/dreamdex/temporal?asset=${m.asset}`);
              const tData = await tRes.json();
              if (!fetchedRef.current && tData.ok && tData.trajectory) {
                const t = tData.trajectory;
                setTemporals((prev) => ({
                  ...prev,
                  [m.asset]: {
                    state: t.state,
                    stateLabel: t.stateLabel,
                    confidence: t.confidence,
                    reversalRisk: t.reversalRisk,
                    velocityPerHour: t.metrics.velocityPerHour,
                  },
                }));
              }
            } catch {
              // silent
            }
          }
        } else {
          setError(data.error || "Failed to load markets");
        }
      } catch (e: unknown) {
        if (!fetchedRef.current) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, 30_000);
    return () => { fetchedRef.current = true; clearInterval(interval); };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded skeleton"
            style={{ background: "rgba(239,230,214,0.035)" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-2">
        <p style={{ color: "var(--accent-warn)", fontFamily: "var(--font-data)", fontSize: "0.9rem" }}>{error}</p>
        <button onClick={() => window.location.reload()}
          style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", textDecoration: "underline", fontFamily: "var(--font-data)" }}>
          Retry
        </button>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-data)", fontSize: "0.9rem" }}>
        No live markets found
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Table header */}
      <div className="grid gap-2 px-3 py-1.5"
        style={{
          gridTemplateColumns: "100px 1fr 120px 80px 60px",
          fontSize: "0.58rem",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          borderBottom: "1px solid rgba(239,230,214,0.14)",
        }}>
        <span>Asset</span>
        <span>Horizons</span>
        <span>State</span>
        <span style={{ textAlign: "right" }}>Velocity</span>
        <span style={{ textAlign: "right" }}>Expires</span>
      </div>

      {markets.map((m) => {
        const t = temporals[m.asset];
        const sorted = [...m.horizons].sort((a, b) => a.horizonMinutes - b.horizonMinutes);
        const shortest = sorted[0];

        return (
          <Link key={m.asset} href={`/analyze/${m.asset}`}>
            <div className="grid items-center px-3 py-3 horizon-row cursor-pointer"
              style={{
                gridTemplateColumns: "100px 1fr 120px 80px 60px",
                gap: 8,
                borderBottom: "1px solid rgba(239,230,214,0.06)",
              }}>
              {/* Asset */}
              <span style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "1rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--tape)",
              }}>{m.asset}</span>

              {/* Horizon bars */}
              <div className="flex items-end gap-1.5" style={{ height: 32 }}>
                {sorted.map((h) => (
                  <div key={h.marketId} className="flex-1 flex flex-col items-center gap-0.5">
                    <span style={{
                      fontSize: "0.56rem",
                      fontFamily: "var(--font-data)",
                      fontFeatureSettings: "\"tnum\"",
                      color: "var(--muted-foreground)",
                    }}>
                      {formatProb(h.lastPrice)}
                    </span>
                    <div className="w-full rounded-sm"
                      style={{
                        height: `${Math.max((h.lastPrice ?? 0.5) * 24, 2)}px`,
                        background: probBarColor(h.lastPrice ?? 0.5),
                        opacity: 0.5 + (h.lastPrice ?? 0.5) * 0.5,
                      }} />
                  </div>
                ))}
              </div>

              {/* State */}
              {t ? (
                <span style={{
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: stateColor(t.state),
                }}>
                  {t.stateLabel}
                </span>
              ) : (
                <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)" }}>—</span>
              )}

              {/* Velocity */}
              {t ? (
                <span style={{
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-data)",
                  textAlign: "right",
                  fontFeatureSettings: "\"tnum\"",
                  color: "var(--chalk)",
                }}>
                  {t.velocityPerHour > 0 ? "+" : ""}{(t.velocityPerHour * 100).toFixed(1)}%/h
                </span>
              ) : (
                <span style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", textAlign: "right" }}>—</span>
              )}

              {/* Expires */}
              <span style={{
                fontSize: "0.7rem",
                fontFamily: "var(--font-data)",
                color: "var(--muted-foreground)",
                textAlign: "right",
                fontFeatureSettings: "\"tnum\"",
              }}>
                {shortest ? formatTimeLeft(shortest.secondsLeft) : "—"}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
