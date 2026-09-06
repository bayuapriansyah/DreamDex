"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  formatProb,
  formatHorizon,
  pctStr,
  formatVelocity,
  stateColor,
} from "@/lib/dreamdex/formatting";

interface MarketData {
  asset: string;
  state: string;
  stateLabel: string;
  confidence: number;
  reversalRisk: number;
  trajectoryScore: number;
  velocityPerHour: number;
  divergence: number;
  persistence: number;
  asOf: string;
  horizons: { horizonMinutes: number; midProbability: number | null }[];
}

interface Insight {
  text: string;
  favor: "left" | "right" | "neutral";
}

function computeInsights(a: MarketData | null, b: MarketData | null): Insight[] {
  if (!a || !b) return [];
  const insights: Insight[] = [];

  if (a.trajectoryScore > b.trajectoryScore) {
    insights.push({ text: `${a.asset} has a stronger temporal signal`, favor: "left" });
  } else if (b.trajectoryScore > a.trajectoryScore) {
    insights.push({ text: `${b.asset} has a stronger temporal signal`, favor: "right" });
  }

  if (a.confidence > b.confidence) {
    insights.push({ text: `${a.asset} has higher confidence`, favor: "left" });
  } else if (b.confidence > a.confidence) {
    insights.push({ text: `${b.asset} has higher confidence`, favor: "right" });
  }

  if (a.reversalRisk < b.reversalRisk) {
    insights.push({ text: `${a.asset} has lower reversal risk`, favor: "left" });
  } else if (b.reversalRisk < a.reversalRisk) {
    insights.push({ text: `${b.asset} has lower reversal risk`, favor: "right" });
  }

  if (a.velocityPerHour > b.velocityPerHour) {
    insights.push({ text: `${a.asset} has stronger positive velocity`, favor: "left" });
  } else if (b.velocityPerHour > a.velocityPerHour) {
    insights.push({ text: `${b.asset} has stronger positive velocity`, favor: "right" });
  }

  return insights;
}

function signalColor(state: string): string {
  if (state.startsWith("bullish")) return "var(--accent)";
  if (state.startsWith("bearish")) return "var(--accent-secondary)";
  if (state === "reversal-warning" || state === "cross-horizon-conflict")
    return "var(--accent-warn)";
  return "var(--text-secondary)";
}

const ASSETS = ["BTC", "ETH"];

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto px-4" style={{ maxWidth: 900, paddingTop: 32 }}>
          <div className="card" style={{ padding: 48 }}>
            <div className="skeleton" style={{ height: 20, width: "60%", margin: "0 auto" }} />
          </div>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const initialA = searchParams.get("a") ?? "BTC";
  const initialB = searchParams.get("b") ?? "ETH";

  const [assetA, setAssetA] = useState(initialA);
  const [assetB, setAssetB] = useState(initialB);
  const [dataA, setDataA] = useState<MarketData | null>(null);
  const [dataB, setDataB] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = useCallback(async (asset: string): Promise<MarketData | null> => {
    try {
      const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
      const data = await res.json();
      if (data.ok && data.trajectory) {
        const t = data.trajectory;
        return {
          asset,
          state: t.state,
          stateLabel: t.stateLabel,
          confidence: t.confidence,
          reversalRisk: t.reversalRisk,
          trajectoryScore: t.trajectoryScore,
          velocityPerHour: t.metrics.velocityPerHour,
          divergence: t.metrics.crossHorizonDivergence,
          persistence: t.metrics.persistence,
          asOf: t.asOf,
          horizons: t.horizons,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      const [a, b] = await Promise.all([fetchMarket(assetA), fetchMarket(assetB)]);
      if (!mounted) return;
      setDataA(a);
      setDataB(b);
      if (!a && !b) setError("Failed to load market data");
      setLoading(false);
    }

    void load();
    const interval = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [assetA, assetB, fetchMarket]);

  const insights = computeInsights(dataA, dataB);

  function renderComparisonRow(
    label: string,
    getValue: (d: MarketData) => string | number,
    getColor?: (d: MarketData) => string
  ) {
    return (
      <div
        className="grid grid-cols-3 gap-4 items-center"
        style={{
          padding: "12px 0",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: dataA ? (getColor?.(dataA) ?? "var(--text-primary)") : "var(--text-secondary)",
            textAlign: "right",
          }}
        >
          {dataA ? getValue(dataA) : "—"}
        </div>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "0.62rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            textAlign: "center",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: "0.82rem",
            fontWeight: 600,
            color: dataB ? (getColor?.(dataB) ?? "var(--text-primary)") : "var(--text-secondary)",
          }}
        >
          {dataB ? getValue(dataB) : "—"}
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 900, paddingTop: 32, paddingBottom: 80 }}
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
            Compare Markets
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 0,
            }}
          >
            Side-by-side temporal intelligence comparison
          </p>
        </div>
      </div>

      {/* Asset selectors */}
      <div
        className="flex items-center gap-4 mb-8 animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        <select
          value={assetA}
          onChange={(e) => setAssetA(e.target.value)}
          style={{
            height: 40,
            padding: "0 32px 0 14px",
            fontSize: 14,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-primary)",
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
            flex: 1,
          }}
        >
          {ASSETS.map((a) => (
            <option key={a} value={a}>{a} / USD</option>
          ))}
        </select>

        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--text-tertiary)",
          }}
        >
          VS
        </span>

        <select
          value={assetB}
          onChange={(e) => setAssetB(e.target.value)}
          style={{
            height: 40,
            padding: "0 32px 0 14px",
            fontSize: 14,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-primary)",
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
            flex: 1,
          }}
        >
          {ASSETS.map((a) => (
            <option key={a} value={a}>{a} / USD</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: 48 }}>
          <div className="skeleton" style={{ height: 20, width: "60%", margin: "0 auto" }} />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card text-center" style={{ padding: 48 }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry
          </button>
        </div>
      )}

      {/* Comparison */}
      {!loading && dataA && dataB && (
        <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {/* Asset headers */}
          <div className="grid grid-cols-3 gap-4 items-center mb-4">
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 24,
                  color: signalColor(dataA.state),
                }}
              >
                {dataA.asset} / USD
              </span>
            </div>
            <div />
            <div>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 24,
                  color: signalColor(dataB.state),
                }}
              >
                {dataB.asset} / USD
              </span>
            </div>
          </div>

          {/* Comparison card */}
          <div className="card" style={{ padding: "16px 24px" }}>
            {renderComparisonRow(
              "PROBABILITY",
              (d) => {
                const prob = d.horizons.find((h) => h.midProbability !== null)?.midProbability;
                return prob != null ? `${pctStr(prob, 0)}%` : "—";
              },
              (d) => signalColor(d.state)
            )}
            {renderComparisonRow(
              "CONFIDENCE",
              (d) => `${pctStr(d.confidence, 0)}%`,
              (d) => d.confidence >= 0.7 ? "var(--accent)" : "var(--text-primary)"
            )}
            {renderComparisonRow(
              "VELOCITY",
              (d) => formatVelocity(d.velocityPerHour),
              (d) => d.velocityPerHour > 0 ? "var(--accent)" : d.velocityPerHour < 0 ? "var(--accent-secondary)" : "var(--text-primary)"
            )}
            {renderComparisonRow(
              "DIVERGENCE",
              (d) => `${pctStr(d.divergence, 1)}pp`,
              (d) => d.divergence > 0.1 ? "var(--accent-warn)" : "var(--text-primary)"
            )}
            {renderComparisonRow(
              "REVERSAL RISK",
              (d) => `${pctStr(d.reversalRisk, 0)}%`,
              (d) => d.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)"
            )}
            {renderComparisonRow(
              "REGIME",
              (d) => d.stateLabel,
              (d) => signalColor(d.state)
            )}
            {renderComparisonRow(
              "SCORE",
              (d) => `${pctStr(d.trajectoryScore, 0)}`,
              (d) => d.trajectoryScore >= 0.6 ? "var(--accent)" : "var(--text-secondary)"
            )}

            {/* Horizon comparison */}
            {dataA.horizons.length > 0 && dataB.horizons.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: "0.62rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  HORIZON PROBABILITIES
                </div>
                {["5m", "1h", "4h"].map((h) => {
                  const mins = h === "5m" ? 5 : h === "1h" ? 60 : 240;
                  const probA = dataA.horizons.find((x) => x.horizonMinutes === mins)?.midProbability;
                  const probB = dataB.horizons.find((x) => x.horizonMinutes === mins)?.midProbability;
                  return (
                    <div key={h} className="grid grid-cols-3 gap-4 items-center" style={{ padding: "6px 0" }}>
                      <div style={{ fontFamily: "var(--font-data)", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)", textAlign: "right" }}>
                        {probA != null ? `${pctStr(probA, 0)}%` : "—"}
                      </div>
                      <div style={{ fontFamily: "var(--font-data)", fontSize: "0.62rem", color: "var(--text-tertiary)", textAlign: "center" }}>
                        {h}
                      </div>
                      <div style={{ fontFamily: "var(--font-data)", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {probB != null ? `${pctStr(probB, 0)}%` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="card" style={{ padding: 24, marginTop: 16 }}>
              <div
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                  marginBottom: 12,
                }}
              >
                INSIGHT
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.map((insight, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        background: insight.favor === "left" ? signalColor(dataA.state) : insight.favor === "right" ? signalColor(dataB.state) : "var(--text-tertiary)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {insight.text}
                    </span>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "0.62rem",
                  color: "var(--text-tertiary)",
                  marginTop: 12,
                  lineHeight: 1.5,
                }}
              >
                All insights are deterministic comparisons of market-implied data. This is not financial advice.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Link
              href={`/analyze/${assetA}`}
              className="flex-1 flex items-center justify-center gap-2"
              style={{
                height: 40,
                borderRadius: "var(--radius-full)",
                background: `${signalColor(dataA.state)}12`,
                border: `1px solid ${signalColor(dataA.state)}25`,
                color: signalColor(dataA.state),
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Analyze {dataA.asset}
            </Link>
            <Link
              href={`/analyze/${assetB}`}
              className="flex-1 flex items-center justify-center gap-2"
              style={{
                height: 40,
                borderRadius: "var(--radius-full)",
                background: `${signalColor(dataB.state)}12`,
                border: `1px solid ${signalColor(dataB.state)}25`,
                color: signalColor(dataB.state),
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Analyze {dataB.asset}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
