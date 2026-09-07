"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import * as d3 from "d3";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ForecastCone } from "@/components/charts/ForecastCone";

import { OrderbookPanel } from "@/components/markets/OrderbookPanel";
import { stateColor, probColor, formatHorizon, formatProb, formatVelocity, pctStr, pctNum, ppStr } from "@/lib/dreamdex/formatting";
import type { DecisionContext } from "@/lib/dreamdex/decision";
import { composeStrategies, type StrategyType } from "@/lib/dreamdex/strategy";
import type { MarketState } from "@/lib/dreamdex/temporal";

interface HorizonPoint {
  horizonMinutes: number;
  marketId: string;
  yesProbability: number | null;
  bidProbability: number | null;
  askProbability: number | null;
  midProbability: number | null;
  spread: number | null;
  volume: number | null;
  secondsLeft: number;
  dataQuality: "high" | "medium" | "low" | "none";
  quoteDecimals: number;
  status: string;
}

interface TemporalMetrics {
  velocity: number;
  velocityPerHour: number;
  persistence: number;
  convictionDecay: number;
  crossHorizonDivergence: number;
  dataQuality: number;
  directionStrength: number;
  momentum: number;
  liquidity: number;
}

interface Trajectory {
  asset: string;
  asOf: string;
  horizons: HorizonPoint[];
  metrics: TemporalMetrics;
  state: MarketState;
  stateLabel: string;
  stateDescription: string;
  trajectoryScore: number;
  confidence: number;
  reversalRisk: number;
  whatChanged: string;
  why: string;
  evidence: string[];
}

function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/* ── Shared: Metric Row ── */
function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 600, color: color || "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

/* ── Shared: Section Card ── */
function SectionCard({ label, badge, children, id, glowColor }: { label: string; badge?: React.ReactNode; children: React.ReactNode; id?: string; glowColor?: string }) {
  return (
    <div id={id} style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", position: "relative", ...(glowColor ? { boxShadow: `0 0 40px ${glowColor}08` } : {}) }}>
      {glowColor && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${glowColor}40, transparent)` }} />}
      <div className="flex items-center justify-between px-3.5 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>{label}</span>
        {badge}
      </div>
      <div className="p-3.5 sm:p-5">{children}</div>
    </div>
  );
}

export default function AnalyzePage() {
  const params = useParams();
  const asset = (params.asset as string)?.toUpperCase() || "BTC";
  const [decisionCtx, setDecisionCtx] = useState<DecisionContext | null>(null);
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);
  const [totalMarkets, setTotalMarkets] = useState(0);
  const fetchedRef = useRef(false);
  const [now, setNow] = useState<number>(0);
  const [selectedHorizon, setSelectedHorizon] = useState<number | null>(null);

  useEffect(() => {
    function tick() { setNow(Date.now()); }
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
        const data = await res.json();
        if (!fetchedRef.current) {
          if (data.ok) {
            setTrajectory(data.trajectory);
            if (data.decisionContext) setDecisionCtx(data.decisionContext);
            if (data.availableAssets) setAvailableAssets(data.availableAssets);
            if (data.totalMarkets != null) setTotalMarkets(data.totalMarkets);
          } else {
            setError(data.error || "Failed to fetch trajectory");
          }
        }
      } catch (e: unknown) {
        if (!fetchedRef.current) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, 15000);
    return () => { fetchedRef.current = true; clearInterval(interval); };
  }, [asset]);

  if (loading && !trajectory) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div className="skeleton" style={{ height: 48, width: 200, borderRadius: 12, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 24, width: 360, borderRadius: 8 }} />
        </div>
        {/* Event context card skeleton */}
        <div className="skeleton" style={{ height: 140, borderRadius: 16, marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="skeleton" style={{ height: 380, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 160, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 260, borderRadius: 16 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error && !trajectory) {
    return (
      <div style={{ padding: "16px 24px", textAlign: "center" }} className="space-y-3">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Unable to load market intelligence: {error}
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (!trajectory) return null;

  const { horizons, metrics, state, stateLabel } = trajectory;
  const sorted = [...horizons].sort((a, b) => a.horizonMinutes - b.horizonMinutes);
  const shortP = sorted[0]?.midProbability;
  const longP = sorted[sorted.length - 1]?.midProbability;
  const isLive = !!(trajectory.asOf && (now - new Date(trajectory.asOf).getTime()) < 30000);
  const minSecondsLeft = sorted[0]?.secondsLeft ?? 0;
  const accentColor = stateColor(state);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
      {/* ══ PAGE HEADER — MARKET WORKSPACE ══ */}
      <div style={{ marginBottom: 28 }}>
        {/* Breadcrumbs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-tertiary)" }}>
          <a href="/markets" style={{ color: "var(--text-tertiary)", textDecoration: "none", transition: "color 0.15s" }} className="hover:text-[var(--accent)]">Markets</a><span>/</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{asset}</span>
        </div>

        {/* Event Context Card */}
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          {/* Top glow */}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)` }} />

          <div style={{ padding: "18px 22px" }}>
            {/* Row 1: Asset + Lifecycle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(28px, 4vw, 40px)", color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {trajectory.asset}
                </h1>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: accentColor, padding: "3px 10px", border: `1px solid ${accentColor}30`, borderRadius: 6, background: `${accentColor}10`, textTransform: "uppercase" }}>
                  {stateLabel}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* LIVE/STALE */}
                <div className="flex items-center gap-1.5" style={{ padding: "4px 10px", borderRadius: 9999, background: isLive ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${isLive ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.1)"}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: isLive ? "#22c55e" : "#71717a", boxShadow: isLive ? "0 0 6px #22c55e" : "none" }} />
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, color: isLive ? "#22c55e" : "var(--text-secondary)" }}>{isLive ? "LIVE" : "STALE"}</span>
                </div>
                {/* TRADING badge */}
                <div style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>TRADING</div>
                {/* Time to lock */}
                {minSecondsLeft > 0 && (
                  <div style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)" }}>
                    {formatTimeLeft(minSecondsLeft)} to lock
                  </div>
                )}
                {/* Data freshness */}
                {trajectory.asOf && (
                  <div style={{ padding: "4px 10px", borderRadius: 9999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)" }}>
                    Updated {formatTimeLeft(Math.floor((Date.now() - new Date(trajectory.asOf).getTime()) / 1000))} ago
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Event Question */}
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
              {trajectory.stateDescription || "Multi-horizon temporal trajectory analysis"}
            </p>

            {/* Available assets hint when empty */}
            {sorted.length === 0 && availableAssets.length > 0 && (
              <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 10 }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 6 }}>
                  {totalMarkets} active market{totalMarkets !== 1 ? "s" : ""} found — available assets:
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableAssets.map((a) => (
                    <a
                      key={a}
                      href={`/analyze/${a}`}
                      style={{
                        fontFamily: "var(--font-data)",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 6,
                        textDecoration: "none",
                        color: a === asset ? "var(--accent)" : "var(--text-secondary)",
                        background: a === asset ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${a === asset ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      {a}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Row 3: YES / NO Pricing — Event Contract Style */}
            {sorted.length >= 2 && shortP != null && longP != null && (
              <div className="grid grid-cols-2 gap-3">
                {/* YES side */}
                <div style={{ padding: "14px 18px", background: shortP > 0.5 ? `${probColor(shortP)}08` : "rgba(255,255,255,0.02)", border: `1px solid ${shortP > 0.5 ? `${probColor(shortP)}25` : "rgba(255,255,255,0.08)"}`, borderRadius: 12, transition: "all 0.15s" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>UP</span>
                    <span className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
                      {formatHorizon(sorted[0]?.horizonMinutes ?? 15)}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 700, color: probColor(shortP), lineHeight: 1 }}>
                    {pctStr(shortP, 1)}%
                  </div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    {(() => {
                      const first = sorted[0];
                      return first?.bidProbability != null && first.askProbability != null
                        ? `Bid ${pctStr(first.bidProbability, 1)}% / Ask ${pctStr(first.askProbability, 1)}%`
                        : "Market probability";
                    })()}
                  </div>
                </div>

                {/* NO side */}
                <div style={{ padding: "14px 18px", background: (1 - shortP) > 0.5 ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${(1 - shortP) > 0.5 ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, transition: "all 0.15s" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>DOWN</span>
                    <span className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-secondary)" }} />
                      {formatHorizon(sorted[sorted.length - 1]?.horizonMinutes ?? 60)}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 700, color: probColor(1 - shortP), lineHeight: 1 }}>
                    {pctStr(1 - shortP, 1)}%
                  </div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    {(() => {
                      const last = sorted[sorted.length - 1];
                      return last?.bidProbability != null && last.askProbability != null
                        ? `Bid ${pctStr(1 - last.askProbability, 1)}% / Ask ${pctStr(1 - last.bidProbability, 1)}%`
                        : "Market probability";
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ TWO-COLUMN LAYOUT ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* TEMPORAL PROBABILITY CHART */}
          <SectionCard
            label="Temporal Probability"
            glowColor={accentColor}
            badge={
              <div style={{ display: "flex", gap: 4 }}>
                {sorted.map((h) => (
                  <button
                    key={h.marketId}
                    onClick={() => setSelectedHorizon(selectedHorizon === h.horizonMinutes ? null : h.horizonMinutes)}
                    style={{ padding: "3px 8px", fontSize: 11, fontFamily: "var(--font-data)", fontWeight: 500, background: selectedHorizon === h.horizonMinutes ? `${accentColor}20` : "rgba(255,255,255,0.04)", color: selectedHorizon === h.horizonMinutes ? accentColor : "var(--text-secondary)", border: `1px solid ${selectedHorizon === h.horizonMinutes ? `${accentColor}40` : "rgba(255,255,255,0.08)"}`, borderRadius: 6, cursor: "pointer", transition: "all 0.15s" }}
                  >
                    {formatHorizon(h.horizonMinutes)}
                  </button>
                ))}
              </div>
            }
          >
            {sorted.length < 1 ? (
              <p className="text-center py-8" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                No horizon data available for this asset.
              </p>
            ) : (
              <TemporalChart
                asset={asset}
                horizons={sorted}
                state={state}
                selectedHorizon={selectedHorizon}
                forecastProjections={decisionCtx?.forecast?.projections}
              />
            )}
          </SectionCard>

          {/* WHAT THE MARKET IS SAYING */}
          {shortP != null && longP != null && sorted.length >= 2 && (
            <SectionCard label="What The Market Is Saying">
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 20 }}>
                {trajectory.why}
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 p-3.5 sm:p-5 bg-[rgba(255,255,255,0.02)] border border-[var(--border)] rounded-xl">
                <div className="flex sm:flex-col items-center justify-between sm:justify-center text-center sm:min-w-[72px]">
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 10, textTransform: "uppercase", color: "var(--text-tertiary)" }}>{formatHorizon(sorted[0]?.horizonMinutes ?? 15)}</div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: "1.4rem", fontWeight: 700, color: probColor(shortP), lineHeight: 1 }}>{pctStr(shortP, 1)}%</div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>SHORT</div>
                </div>
                <div className="flex-1 w-full">
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, position: "relative", marginBottom: 8 }}>
                    <div style={{ position: "absolute", height: "100%", borderRadius: 2, width: `${Math.abs(shortP - longP) * 100}%`, left: shortP > longP ? `${longP * 100}%` : `${shortP * 100}%`, background: shortP > longP ? "var(--accent)" : "var(--accent-secondary)" }} />
                    <div style={{ position: "absolute", left: "50%", top: -4, width: 1, height: 12, background: "rgba(255,255,255,0.15)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: shortP > longP ? "var(--accent)" : "var(--accent-secondary)" }}>{ppStr(shortP - longP, 1)} {shortP > longP ? "stronger short" : "weaker short"}</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-tertiary)" }}>{ppStr(Math.abs(shortP - longP), 1)} spread</span>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center justify-between sm:justify-center text-center sm:min-w-[72px]">
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 10, textTransform: "uppercase", color: "var(--text-tertiary)" }}>{formatHorizon(sorted[sorted.length - 1]?.horizonMinutes ?? 60)}</div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: "1.4rem", fontWeight: 700, color: probColor(longP), lineHeight: 1 }}>{pctStr(longP, 1)}%</div>
                  <div style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>LONG</div>
                </div>
              </div>

              {/* What Changed — structured breakdown */}
              <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>What Changed</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                  {[
                    { label: "Probability", value: `${pctStr(shortP, 1)}% → ${pctStr(longP, 1)}%`, color: shortP > longP ? "var(--accent)" : "var(--accent-secondary)" },
                    { label: "Velocity", value: formatVelocity(metrics.velocityPerHour), color: metrics.velocityPerHour > 0 ? "var(--accent)" : metrics.velocityPerHour < 0 ? "var(--accent-secondary)" : "var(--text-primary)" },
                    { label: "Divergence", value: ppStr(metrics.crossHorizonDivergence, 1), color: metrics.crossHorizonDivergence > 0.1 ? "var(--accent-warn)" : "var(--text-primary)" },
                    { label: "Regime", value: trajectory.stateLabel, color: stateColor(trajectory.state) },
                    { label: "Risk", value: pctStr(trajectory.reversalRisk, 0) + "%", color: trajectory.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6 }}>
                      <div style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          {/* TEMPORAL SIGNAL */}
          <SectionCard label="Temporal Signal">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
              {[
                { label: "Velocity", value: formatVelocity(metrics.velocityPerHour), color: metrics.velocityPerHour > 0 ? "var(--accent)" : metrics.velocityPerHour < 0 ? "var(--accent-secondary)" : "var(--text-primary)" },
                { label: "Persistence", value: `${pctStr(metrics.persistence, 0)}%` },
                { label: "Momentum", value: `${metrics.momentum > 0 ? "+" : ""}${pctStr(metrics.momentum, 2)}%`, color: metrics.momentum > 0 ? "var(--accent)" : "var(--accent-secondary)" },
                { label: "Conviction Decay", value: `${ppStr(metrics.convictionDecay, 1)}`, color: metrics.convictionDecay < 0 ? "var(--accent-warn)" : "var(--accent)" },
                { label: "Cross-Horizon Div.", value: `${ppStr(metrics.crossHorizonDivergence, 1)}` },
                { label: "Direction Strength", value: `${pctStr(metrics.directionStrength, 0)}%` },
                { label: "Trajectory Signal", value: `${pctNum(trajectory.trajectoryScore, 0)}/100` },
                { label: "Reversal Risk", value: `${pctStr(trajectory.reversalRisk, 0)}%`, color: trajectory.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)" },
              ].map((m) => (
                <MetricRow key={m.label} label={m.label} value={m.value} color={m.color} />
              ))}
            </div>
          </SectionCard>

          {/* EVIDENCE */}
          <SectionCard label="Evidence">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {trajectory.evidence.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--accent)", marginTop: 1, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{e}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* WHY? */}
          {trajectory.why && (
            <SectionCard
              label={`Why ${trajectory.stateLabel}?`}
              badge={
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--accent)", padding: "2px 8px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 4 }}>DETERMINISTIC</span>
              }
            >
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.6, color: "var(--text-primary)", marginBottom: 16 }}>
                {trajectory.why}
              </p>
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>DATA LIMITATION</span>
                <p style={{ fontFamily: "var(--font-data)", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 4 }}>
                  Orderbook depth is limited. All signals are derived from market-implied probabilities, not fundamental analysis.
                </p>
              </div>
            </SectionCard>
          )}

          {/* WHAT WOULD INVALIDATE THIS? */}
          {decisionCtx?.forecast && decisionCtx.forecast.invalidation.length > 0 && (
            <SectionCard
              label="What Would Invalidate This Signal?"
              badge={
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--accent-secondary)", padding: "2px 8px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 4 }}>CONDITIONAL ANALYSIS</span>
              }
            >
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                Current Signal: <span style={{ color: stateColor(state), fontWeight: 600 }}>{trajectory.stateLabel}</span>
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-tertiary)", marginBottom: 12 }}>
                Potential invalidation conditions:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {decisionCtx.forecast.invalidation.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.1)", borderRadius: 10 }}>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--accent-warn)", marginTop: 1, flexShrink: 0 }}>•</span>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{item}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>CONDITIONAL ANALYSIS</span>
                <p style={{ fontFamily: "var(--font-data)", fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)", marginTop: 4 }}>
                  This is not certainty. These are potential invalidation conditions. No outcome is guaranteed.
                </p>
              </div>
            </SectionCard>
          )}

          {/* MAP THE NEXT HOUR */}
          {decisionCtx?.forecast && decisionCtx.forecast.projections.length > 0 && (
            <SectionCard
              label="Map the Next Hour"
              id="map-next-hour"
              badge={
                <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)", padding: "2px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>SCENARIO / HEURISTIC</span>
              }
            >
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                Projection based on current trajectory. Not a guaranteed prediction.
              </p>

              <ForecastCone
                projections={decisionCtx.forecast.projections}
                currentProbability={shortP}
                state={state}
              />

              {shortP != null && decisionCtx.forecast.projections.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)" }}>NOW</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, color: probColor(shortP) }}>{pctStr(shortP, 1)}%</span>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>→</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)" }}>60m</span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, color: probColor(decisionCtx.forecast.projections[decisionCtx.forecast.projections.length - 1]?.projectedProbability ?? null) }}>
                    {(() => {
                      const lastProj = decisionCtx.forecast.projections[decisionCtx.forecast.projections.length - 1];
                      return lastProj?.projectedProbability != null ? `${pctStr(lastProj.projectedProbability, 1)}%` : "—";
                    })()}
                  </span>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)", marginLeft: "auto" }}>CONF {pctStr(decisionCtx.forecast.confidence, 0)}%</span>
                </div>
              )}
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)", marginTop: 12, lineHeight: 1.55 }}>{decisionCtx.forecast.summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3.5">
                {[
                  { title: "Assumptions", items: decisionCtx.forecast.assumptions.slice(0, 3) },
                  { title: "Invalidation", items: decisionCtx.forecast.invalidation.slice(0, 2) },
                ].map((block) => (
                  <div key={block.title} style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
                    <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>{block.title}</div>
                    {block.items.map((a: string, i: number) => (
                      <div key={i} style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, paddingLeft: 8, borderLeft: "2px solid rgba(255,255,255,0.08)", marginBottom: 4 }}>{a}</div>
                    ))}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* DECISION CONTEXT */}
          {decisionCtx && (
            <SectionCard label="Decision Context">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                {[
                  { label: "Data Quality", value: `${pctStr(decisionCtx.decisionQuality.dataQuality, 0)}%` },
                  { label: "Trajectory Score", value: `${pctStr(decisionCtx.decisionQuality.trajectoryScore, 0)}%` },
                  { label: "Confidence", value: `${pctStr(decisionCtx.decisionQuality.confidence, 0)}%` },
                  { label: "Reversal Risk", value: `${pctStr(decisionCtx.decisionQuality.reversalRisk, 0)}%`, color: decisionCtx.decisionQuality.reversalRisk > 0.5 ? "var(--accent-warn)" : undefined },
                  { label: "Forecast Conf.", value: `${pctStr(decisionCtx.decisionQuality.forecastConfidence, 0)}%` },
                  { label: "Composite", value: `${pctStr(decisionCtx.decisionQuality.composite, 0)}%` },
                  { label: "Tier", value: decisionCtx.decisionQuality.tier.toUpperCase(), color: decisionCtx.decisionQuality.tier === "strong" ? "var(--accent)" : decisionCtx.decisionQuality.tier === "weak" || decisionCtx.decisionQuality.tier === "unusable" ? "var(--accent-warn)" : undefined },
                  { label: "Regime", value: decisionCtx.regime.durationHint.toUpperCase() },
                ].map((m) => (
                  <MetricRow key={m.label} label={m.label} value={m.value} color={m.color} />
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: decisionCtx.actionability === "high" ? "rgba(245,158,11,0.08)" : decisionCtx.actionability === "low" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${decisionCtx.actionability === "high" ? "rgba(245,158,11,0.25)" : decisionCtx.actionability === "low" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10 }}>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Actionability</span>
                <span style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, color: decisionCtx.actionability === "high" ? "var(--accent)" : decisionCtx.actionability === "low" ? "var(--accent-warn)" : "var(--text-primary)" }}>{decisionCtx.actionability.toUpperCase()}</span>
              </div>
              {decisionCtx.pipelineSummary && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                  <p style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>{decisionCtx.pipelineSummary}</p>
                </div>
              )}
            </SectionCard>
          )}

        </div>

        {/* ── RIGHT STICKY RAIL ── */}
        <div className="lg:sticky lg:top-20" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SignalRail
            trajectory={trajectory}
            decisionCtx={decisionCtx}
            isLive={isLive}
            minSecondsLeft={minSecondsLeft}
          />

          {/* STRATEGY COMPOSER — now in right column */}
          <StrategyComposer trajectory={trajectory} asset={asset} decisionCtx={decisionCtx} />



          {/* ORDERBOOK — collapsible */}
          <CollapsibleOrderbook asset={asset} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* TemporalChart — D3 probability trajectory              */
/* ═══════════════════════════════════════════════════════ */

function TemporalChart({
  asset,
  horizons,
  state,
  selectedHorizon,
  forecastProjections,
}: {
  asset: string;
  horizons: HorizonPoint[];
  state: string;
  selectedHorizon: number | null;
  forecastProjections?: Array<{ offsetMinutes: number; projectedProbability: number | null; upperBound: number; lowerBound: number }>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const color = useMemo(() => {
    if (state.includes("bullish")) return "#22c55e";
    if (state.includes("bearish")) return "#ef4444";
    if (state === "reversal-warning") return "#eab308";
    if (state === "cross-horizon-conflict") return "#f97316";
    return "#9ca3af";
  }, [state]);

  const drawChart = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 560;
    const height = 300;
    const margin = { top: 24, right: 28, bottom: 40, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([innerH, 0]);

    const sorted = [...horizons]
      .filter((h) => h.midProbability !== null)
      .sort((a, b) => a.horizonMinutes - b.horizonMinutes);

    if (sorted.length < 1) return;

    // Single horizon: show a single labeled point
    if (sorted.length === 1) {
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
      const x = innerW / 2;
      const y = yScale(sorted[0].midProbability as number);

      // 50% reference line
      g.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(0.5)).attr("y2", yScale(0.5))
        .attr("stroke", "#475569").attr("stroke-dasharray", "4,4").attr("stroke-width", 1);

      // Single point
      g.append("circle")
        .attr("cx", x).attr("cy", y)
        .attr("r", 6)
        .attr("fill", color).attr("fill-opacity", 0.2)
        .attr("stroke", color).attr("stroke-width", 2);

      // Label
      g.append("text")
        .attr("x", x).attr("y", y - 14)
        .attr("text-anchor", "middle")
        .attr("fill", color).attr("font-size", "11px").attr("font-weight", "600").attr("font-family", "var(--font-data)")
        .text(`${pctStr(sorted[0].midProbability as number, 1)}%`);

      // Horizon label
      g.append("text")
        .attr("x", x).attr("y", innerH + 30)
        .attr("text-anchor", "middle")
        .attr("fill", "#9ca3af").attr("font-size", "10px").attr("font-family", "var(--font-data)")
        .text(formatHorizon(sorted[0].horizonMinutes));

      // Note
      g.append("text")
        .attr("x", x).attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b").attr("font-size", "9px").attr("font-family", "var(--font-data)")
        .text("SINGLE HORIZON — multi-horizon trajectory requires 2+ data points");

      return;
    }

    // Categorical x-axis: equally spaced horizons
    const horizonLabels = sorted.map((d) => formatHorizon(d.horizonMinutes));
    const xScale = d3.scalePoint<string>()
      .domain(horizonLabels)
      .range([0, innerW])
      .padding(0.15);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append("g")
      .selectAll("line")
      .data(yScale.ticks(5))
      .join("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", (d) => yScale(d)).attr("y2", (d) => yScale(d))
      .attr("stroke", "#1e293b").attr("stroke-opacity", 0.5);

    // 50% reference line
    g.append("line")
      .attr("x1", 0).attr("x2", innerW)
      .attr("y1", yScale(0.5)).attr("y2", yScale(0.5))
      .attr("stroke", "#475569").attr("stroke-dasharray", "4,4").attr("stroke-width", 1);
    g.append("text")
      .attr("x", innerW + 4).attr("y", yScale(0.5) + 3)
      .attr("fill", "#475569").attr("font-size", "8px").attr("font-family", "var(--font-data)")
      .text("NEUTRAL");

    // Forecast uncertainty band (shaded area)
    if (forecastProjections && forecastProjections.length > 0) {
      const forecastData = forecastProjections
        .filter((p) => p.projectedProbability !== null)
        .map((p) => ({
          offset: p.offsetMinutes,
          prob: p.projectedProbability as number,
          upper: p.upperBound,
          lower: p.lowerBound,
        }));

      if (forecastData.length > 1) {
        const fScale = d3.scaleLinear().domain([0, 60]).range([0, innerW]);
        const upperArea = d3.area<{ offset: number; upper: number; lower: number }>()
          .x((d) => fScale(d.offset))
          .y0((d) => yScale(d.lower))
          .y1((d) => yScale(d.upper))
          .curve(d3.curveMonotoneX);
        const lowerArea = d3.area<{ offset: number; lower: number; prob: number }>()
          .x((d) => fScale(d.offset))
          .y0((d) => yScale(d.lower))
          .y1((d) => yScale(d.prob))
          .curve(d3.curveMonotoneX);

        g.append("path")
          .datum(forecastData)
          .attr("fill", `${color}10`)
          .attr("d", upperArea);
        g.append("path")
          .datum(forecastData)
          .attr("fill", `${color}08`)
          .attr("d", lowerArea);

        // Forecast dashed line
        const fLine = d3.line<{ offset: number; prob: number }>()
          .x((d) => fScale(d.offset))
          .y((d) => yScale(d.prob))
          .curve(d3.curveMonotoneX);

        g.append("path")
          .datum(forecastData)
          .attr("fill", "none")
          .attr("stroke", `${color}60`)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3")
          .attr("d", fLine);
      }
    }

    // Observed trajectory line
    const line = d3.line<HorizonPoint>()
      .x((d) => xScale(formatHorizon(d.horizonMinutes)) ?? 0)
      .y((d) => yScale(d.midProbability as number))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(sorted)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2)
      .attr("d", line);

    // Data points
    const points = g.selectAll<SVGGElement, HorizonPoint>(".point")
      .data(sorted)
      .join("g")
      .attr("class", "point")
      .attr("transform", (d) => `translate(${xScale(formatHorizon(d.horizonMinutes)) ?? 0},${yScale(d.midProbability as number)})`);

    points.append("circle")
      .attr("r", (d) => selectedHorizon === d.horizonMinutes ? 6 : 4)
      .attr("fill", (d) => selectedHorizon === d.horizonMinutes ? color : `${color}cc`)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2);

    // Probability labels
    points.append("text")
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", color)
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("font-family", "var(--font-data)")
      .text((d) => `${pctStr(d.midProbability as number, 1)}%`);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick text").attr("fill", "#9ca3af").attr("font-size", "9px").attr("dy", 12));

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${pctStr(d as number, 0)}%`))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "#374151").attr("stroke-opacity", 0.4))
      .call((g) => g.selectAll(".tick text").attr("fill", "#9ca3af").attr("font-size", "9px"));

    // Legend
    const legend = g.append("g").attr("transform", `translate(${innerW - 160}, -12)`);
    const legendItems = [
      { label: "Observed", stroke: color, dash: "", fill: "" },
      { label: "Scenario", stroke: `${color}60`, dash: "4,3", fill: "" },
      { label: "Uncertainty", stroke: "none", dash: "", fill: `${color}15` },
    ];
    legendItems.forEach((item, i) => {
      const lx = i * 56;
      if (item.fill) {
        legend.append("rect").attr("x", lx).attr("y", 0).attr("width", 12).attr("height", 6).attr("fill", item.fill).attr("rx", 1);
      } else {
        legend.append("line").attr("x1", lx).attr("x2", lx + 12).attr("y1", 3).attr("y2", 3).attr("stroke", item.stroke).attr("stroke-width", 1.5).attr("stroke-dasharray", item.dash);
      }
      legend.append("text").attr("x", lx + 16).attr("y", 5).attr("fill", "#64748b").attr("font-size", "7px").attr("font-family", "var(--font-data)").text(item.label);
    });

    // Hover interaction
    const overlay = g.append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .attr("cursor", "crosshair");

    const focusLine = g.append("line")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,2")
      .style("opacity", 0);

    const focusDot = g.append("circle")
      .attr("r", 5)
      .attr("fill", color)
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2)
      .style("opacity", 0);

    overlay.on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      // Find nearest horizon by x position
      let nearest: HorizonPoint | null = null;
      let minDist = Infinity;
      for (const d of sorted) {
        const hx = xScale(formatHorizon(d.horizonMinutes)) ?? 0;
        const dist = Math.abs(mx - hx);
        if (dist < minDist) { minDist = dist; nearest = d; }
      }
      if (!nearest || nearest.midProbability === null) return;

      const cx = xScale(formatHorizon(nearest.horizonMinutes)) ?? 0;
      const cy = yScale(nearest.midProbability);

      focusLine.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", innerH).style("opacity", 1);
      focusDot.attr("cx", cx).attr("cy", cy).style("opacity", 1);

      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = "1";
        tooltipRef.current.style.left = `${margin.left + cx + 12}px`;
        tooltipRef.current.style.top = `${margin.top + cy - 10}px`;
        tooltipRef.current.innerHTML = [
          `<div style="font-weight:600;margin-bottom:3px">${asset} · ${formatHorizon(nearest.horizonMinutes)}</div>`,
          `<div style="color:${color}">UP Probability</div>`,
          `<div style="font-size:11px;font-weight:700">${pctStr(nearest.midProbability, 1)}%</div>`,
          nearest.bidProbability !== null ? `<div>Bid ${pctStr(nearest.bidProbability, 1)}%</div>` : "",
          nearest.askProbability !== null ? `<div>Ask ${pctStr(nearest.askProbability, 1)}%</div>` : "",
          `<div>Mid ${pctStr(nearest.midProbability, 1)}%</div>`,
        ].filter(Boolean).join("");
      }
    });

    overlay.on("mouseleave", () => {
      focusLine.style("opacity", 0);
      focusDot.style("opacity", 0);
      if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    });

  }, [horizons, color, selectedHorizon, forecastProjections, asset]);

  useEffect(() => { drawChart(); }, [drawChart]);

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width="100%" viewBox="0 0 560 300" style={{ display: "block" }} />
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.15s",
          background: "rgba(9,9,11,0.95)",
          border: "1px solid var(--border-hover)",
          borderRadius: 4,
          padding: "6px 10px",
          fontFamily: "var(--font-data)",
          fontSize: 10,
          color: "var(--text-primary)",
          lineHeight: 1.5,
          zIndex: 10,
          whiteSpace: "nowrap",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* SignalRail — RIGHT STICKY SIGNAL                       */
/* ═══════════════════════════════════════════════════════ */

function SignalRail({
  trajectory,
  decisionCtx,
  isLive,
  minSecondsLeft,
}: {
  trajectory: Trajectory;
  decisionCtx: DecisionContext | null;
  isLive: boolean;
  minSecondsLeft: number;
}) {
  const sorted = [...trajectory.horizons].sort((a, b) => a.horizonMinutes - b.horizonMinutes);
  const shortP = sorted[0]?.midProbability;

  const horizonAgreement = useMemo(() => {
    const valid = sorted.filter((h) => h.midProbability !== null);
    if (valid.length < 2) return "INSUFFICIENT";
    const range = Math.abs((valid[valid.length - 1].midProbability as number) - (valid[0].midProbability as number));
    if (range < 0.05) return "STRONG";
    if (range < 0.15) return "MODERATE";
    return "WEAK";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajectory.horizons]);

  const accentColor = stateColor(trajectory.state);
  const agreementColor = horizonAgreement === "STRONG" ? "var(--accent-success)" : horizonAgreement === "WEAK" ? "var(--accent-warn)" : "var(--text-primary)";

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.02)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)` }} />
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Live Signal</span>
      </div>

      <div style={{ padding: "18px" }}>
        {/* BIG Probability Display */}
        <div style={{ textAlign: "center", marginBottom: 18, padding: "20px 16px", background: shortP != null ? `${probColor(shortP)}08` : "rgba(255,255,255,0.02)", border: `1px solid ${shortP != null ? `${probColor(shortP)}20` : "rgba(255,255,255,0.06)"}`, borderRadius: 12 }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>Market Probability</div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: "2.8rem", fontWeight: 700, color: shortP != null ? probColor(shortP) : "var(--text-tertiary)", lineHeight: 1, marginBottom: 4 }}>
            {shortP != null ? `${pctStr(shortP, 1)}%` : "—"}
          </div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-tertiary)" }}>{formatHorizon(sorted[0]?.horizonMinutes ?? 15)} horizon</div>
        </div>

        {/* Signal Metrics */}
        <div style={{ marginBottom: 16 }}>
          {[
            { label: "Signal Strength", value: `${pctNum(trajectory.trajectoryScore, 0)}/100`, color: trajectory.trajectoryScore > 0.6 ? "var(--accent)" : "var(--text-primary)" },
            { label: "Confidence", value: `${pctStr(trajectory.confidence, 0)}%`, color: trajectory.confidence > 0.5 ? "var(--accent)" : "var(--text-primary)" },
            { label: "Reversal Risk", value: `${pctStr(trajectory.reversalRisk, 0)}%`, color: trajectory.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)" },
          ].map((m) => (
            <MetricRow key={m.label} label={m.label} value={m.value} color={m.color} />
          ))}
        </div>

        {/* Regime */}
        <div style={{ padding: "10px 14px", background: `${accentColor}08`, border: `1px solid ${accentColor}25`, borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Regime</div>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 600, color: accentColor }}>{trajectory.stateLabel}</div>
        </div>

        {/* Status rows */}
        <div style={{ marginBottom: 14 }}>
          {[
            { label: "Horizon Agreement", value: horizonAgreement, color: agreementColor },
            { label: "Actionability", value: decisionCtx?.actionability?.toUpperCase() ?? "—", color: decisionCtx?.actionability === "high" ? "var(--accent)" : decisionCtx?.actionability === "low" ? "var(--accent-warn)" : "var(--text-primary)" },
            { label: "Time to Lock", value: minSecondsLeft ? formatTimeLeft(minSecondsLeft) : "—" },
            { label: "Data Status", value: isLive ? "LIVE" : "STALE", color: isLive ? "#22c55e" : "var(--text-secondary)" },
          ].map((m) => (
            <MetricRow key={m.label} label={m.label} value={m.value} color={m.color} />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href="#trade" className="btn-primary" style={{ display: "flex", justifyContent: "center", width: "100%", textDecoration: "none", borderRadius: 10 }}>Place Order</a>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* StrategyComposer                                       */
/* ═══════════════════════════════════════════════════════ */

function StrategyComposer({
  trajectory,
  asset,
  decisionCtx,
}: {
  trajectory: Trajectory;
  asset: string;
  decisionCtx: DecisionContext | null;
}) {
  const { address } = useAccount();
  const [selected, setSelected] = useState<StrategyType>("balanced");
  const [overrideSide, setOverrideSide] = useState<"auto" | "up" | "down">("auto");
  const [executing, setExecuting] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ ok: boolean; hash?: string; error?: string; errorCode?: string; orderId?: string; orderStatus?: string; state?: string; progress?: Array<{ state: string; message: string; ts: number }> } | null>(null);

  const strategies = useMemo(() => {
    if (decisionCtx?.strategies) return decisionCtx.strategies;
    // Fallback: use canonical composeStrategies from strategy.ts
    return composeStrategies(trajectory);
  }, [trajectory, decisionCtx]);

  const active = strategies.find((s) => s.type === selected) ?? strategies[1];

  // Actionability: use deterministic actionability from DecisionContext
  const actionability = decisionCtx?.actionability ?? "low";

  // Average probability from trajectory — used for trade suppression
  const avgProb = useMemo(() => {
    const valid = trajectory.horizons.filter((h) => h.midProbability !== null);
    if (valid.length === 0) return 0.5;
    return valid.reduce((a, h) => a + (h.midProbability as number), 0) / valid.length;
  }, [trajectory.horizons]);

  const suppressTrade = (selected === "conservative" && actionability !== "high")
    || (selected === "balanced" && actionability === "low")
    || avgProb < 0.15
    || avgProb > 0.85
    || trajectory.state === "insufficient-data"
    || trajectory.state === "cross-horizon-conflict";

  // Effective side: override or auto
  const effectiveSide: "buy" | "sell" | "hold" = overrideSide === "auto"
    ? active.side
    : overrideSide === "up" ? "buy" : "sell";

  async function executeTrade() {
    if (effectiveSide === "hold") return;
    if (!active.maxEntryPrice || active.maxEntryPrice <= 0 || active.maxEntryPrice > 1) {
      setTradeResult({ ok: false, error: "Invalid entry price." });
      return;
    }
    if (!active.suggestedSize || active.suggestedSize <= 0) {
      setTradeResult({ ok: false, error: "Invalid trade size." });
      return;
    }
    setExecuting(true);
    setTradeResult(null);
    try {
      const targetHorizon = trajectory.horizons.find((h) => h.horizonMinutes === active.suggestedHorizon);
      if (!targetHorizon) {
        setTradeResult({ ok: false, error: "Target horizon not found." });
        setExecuting(false);
        return;
      }
      const res = await fetch("/api/dreamdex/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: targetHorizon.marketId,
          symbol: asset,
          side: effectiveSide,
          amount: active.suggestedSize,
          price: active.maxEntryPrice,
          type: "limit",
        }),
      });
      const data = await res.json();
      setTradeResult(data);
      if (data.ok && data.hash) {
        const fillPrice = data.averagePrice ?? active.maxEntryPrice;
        const thesisEntry = {
          id: `pos-${data.hash}-0`,
          asset,
          direction: effectiveSide as "up" | "down",
          horizon: active.suggestedHorizon,
          entryProbability: fillPrice,
          thesis: `Temporal thesis: ${trajectory.state}. Velocity ${trajectory.metrics.velocityPerHour.toFixed(2)}/hr, persistence ${(trajectory.metrics.persistence * 100).toFixed(0)}%.`,
          state: trajectory.state,
          stateLabel: trajectory.state,
          signalConfidence: trajectory.confidence,
          reversalRisk: trajectory.reversalRisk,
          trajectoryScore: trajectory.trajectoryScore,
          trajectoryState: trajectory.state,
          createdAt: new Date().toISOString(),
        };
        try {
          if (address) {
            const short = address.toLowerCase().slice(0, 10);
            const key = `dreamdex-${short}-thesis-monitor`;
            const existing: unknown[] = JSON.parse(localStorage.getItem(key) || "[]");
            existing.push(thesisEntry);
            localStorage.setItem(key, JSON.stringify(existing));
          }
        } catch {
          // Non-fatal — thesis save failed but trade succeeded
        }
      }
    } catch (e: unknown) {
      setTradeResult({ ok: false, error: e instanceof Error ? e.message : "Trade failed" });
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div id="trade">
    <SectionCard label="Strategy Composer">

      {/* Market Lifecycle Check */}
      {(() => {
        const statuses = trajectory.horizons.map((h) => h.status);
        const isLocked = statuses.some((s) => s === "Locked" || s === "Settling");
        const isResolved = statuses.every((s) => s === "Resolved" || s === "Finalized" || s === "Voided");
        const isVoided = statuses.some((s) => s === "Voided");

        if (isLocked) {
          return (
            <div className="p-3 rounded mb-3" style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="status-pill" style={{ color: "var(--accent-secondary)" }}>LOCKED</span>
                <span className="text-xs font-mono" style={{ color: "var(--accent-secondary)" }}>Market locked — no new orders</span>
              </div>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                Awaiting oracle resolution. Trading is suspended.
              </p>
            </div>
          );
        }
        if (isResolved) {
          return (
            <div className="p-3 rounded mb-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="status-pill" style={{ color: "var(--accent-warn)" }}>{isVoided ? "VOIDED" : "RESOLVED"}</span>
                <span className="text-xs font-mono" style={{ color: "var(--accent-warn)" }}>
                  {isVoided ? "Market voided — both sides redeem at par" : "Market resolved — check settlement"}
                </span>
              </div>
              <a href="/settlement" className="text-[10px] font-mono underline" style={{ color: "var(--accent)" }}>
                VIEW SETTLEMENT →
              </a>
            </div>
          );
        }
        return null;
      })()}

      <Tabs value={selected} onValueChange={(v: string) => { setSelected(v as StrategyType); setOverrideSide("auto"); }}>
        <TabsList className="h-8 w-full grid grid-cols-3">
          <TabsTrigger value="conservative" className="text-[11px] h-6">Conservative</TabsTrigger>
          <TabsTrigger value="balanced" className="text-[11px] h-6">Balanced</TabsTrigger>
          <TabsTrigger value="aggressive" className="text-[11px] h-6">Aggressive</TabsTrigger>
        </TabsList>

        <TabsContent value={selected} className="mt-2 space-y-2">
          <p style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-secondary)" }}>{active.description}</p>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 13, padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)" }}>
            {active.reasoning}
          </div>

          {active.side !== "hold" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 4 }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)" }}>DIRECTION:</span>
              <span style={{
                fontFamily: "var(--font-data)", fontSize: 10, fontWeight: 600,
                color: overrideSide === "auto"
                  ? (active.side === "buy" ? "var(--accent)" : "var(--accent-secondary)")
                  : (overrideSide === "up" ? "var(--accent)" : "var(--accent-secondary)")
              }}>
                {overrideSide === "auto" ? (active.side === "buy" ? "UP" : "DOWN") : (overrideSide === "up" ? "UP" : "DOWN")}
              </span>
              {overrideSide !== "auto" && (
                <span style={{ fontFamily: "var(--font-data)", fontSize: 9, color: "var(--accent-warn)" }}>(override)</span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <button
                  onClick={() => setOverrideSide(overrideSide === "up" ? "auto" : "up")}
                  style={{
                    fontFamily: "var(--font-data)", fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                    background: overrideSide === "up" ? "rgba(34,197,94,0.15)" : "transparent",
                    border: `1px solid ${overrideSide === "up" ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                    color: overrideSide === "up" ? "var(--accent)" : "var(--text-tertiary)",
                  }}
                >
                  ↑ UP
                </button>
                <button
                  onClick={() => setOverrideSide(overrideSide === "down" ? "auto" : "down")}
                  style={{
                    fontFamily: "var(--font-data)", fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                    background: overrideSide === "down" ? "rgba(239,68,68,0.15)" : "transparent",
                    border: `1px solid ${overrideSide === "down" ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
                    color: overrideSide === "down" ? "var(--accent-secondary)" : "var(--text-tertiary)",
                  }}
                >
                  ↓ DOWN
                </button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {effectiveSide !== "hold" && active.side !== "hold" && !suppressTrade ? (
        <div style={{ marginTop: 10 }} className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Direction", value: effectiveSide === "buy" ? "UP" : "DOWN", color: effectiveSide === "buy" ? "var(--accent)" : "var(--accent-secondary)" },
              { label: "Entry", value: formatProb(active.maxEntryPrice) },
              { label: "Size", value: `${active.suggestedSize}` },
              { label: "Horizon", value: formatHorizon(active.suggestedHorizon) },
            ].map((item) => (
              <div key={item.label} style={{ padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6 }}>
                <div className="form-label" style={{ marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: item.color || "var(--text-primary)" }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6 }}>
              <div className="form-label" style={{ color: "var(--accent)" }}>Max Loss</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{formatProb(active.maxEntryPrice)}</div>
            </div>
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 6 }}>
              <div className="form-label" style={{ color: "var(--accent-secondary)" }}>Payout</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: "var(--accent-secondary)" }}>{formatProb(effectiveSide === "buy" ? 1 - active.maxEntryPrice : active.maxEntryPrice)}</div>
            </div>
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6 }}>
              <div className="form-label">Confidence</div>
              <Badge variant="outline" className="text-[9px] mt-0.5" style={{
                borderColor: active.confidence === "high" ? "var(--accent)" : "var(--accent-warn)",
                color: active.confidence === "high" ? "var(--accent)" : "var(--accent-warn)",
              }}>
                {active.confidence}
              </Badge>
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-data)", fontSize: 12, padding: "6px 10px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6 }}>
            <span style={{ color: "var(--text-primary)" }}>Temporal Thesis:</span> {active.reasoning}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6 }}>
              <div className="form-label">Signal Conf</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: trajectory.confidence > 0.5 ? "var(--accent)" : "var(--text-primary)" }}>
                {pctStr(trajectory.confidence, 0)}%
              </div>
            </div>
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6 }}>
              <div className="form-label">Rev Risk</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: trajectory.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)" }}>
                {pctStr(trajectory.reversalRisk, 0)}%
              </div>
            </div>
            <div style={{ padding: "6px 8px", textAlign: "center", background: actionability === "low" ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${actionability === "low" ? "rgba(239,68,68,0.15)" : "var(--border)"}`, borderRadius: 6 }}>
              <div className="form-label">Actionability</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: actionability === "high" ? "var(--accent)" : actionability === "low" ? "var(--accent-warn)" : "var(--text-primary)" }}>
                {actionability.toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ fontFamily: "var(--font-data)", fontSize: 9, padding: "4px 8px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 3 }}>
            Demo/Testnet Executor — transaction is not signed by your connected wallet.
          </div>

          {tradeResult && (
            <div style={{ fontFamily: "var(--font-data)", fontSize: 11, padding: "6px 8px", borderRadius: 3,
              background: tradeResult.ok ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${tradeResult.ok ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
              color: tradeResult.ok ? "var(--accent)" : "var(--accent-warn)",
            }}>
              {tradeResult.ok ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 600 }}>TRADE SUBMITTED</span>
                    <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>
                      {tradeResult.state?.toUpperCase()}
                    </span>
                  </div>
                  {tradeResult.hash && (
                    <a href={`https://shannon-explorer.somnia.network/tx/${tradeResult.hash}`} target="_blank" rel="noopener noreferrer" className="underline" style={{ fontSize: 10, color: "var(--accent)", wordBreak: "break-all" }}>
                      TX: {tradeResult.hash}
                    </a>
                  )}
                  {tradeResult.orderId && (
                    <div style={{ fontSize: 9, color: "var(--text-secondary)" }}>
                      Order ID: {tradeResult.orderId}
                    </div>
                  )}
                  {tradeResult.orderStatus && (
                    <div style={{ fontSize: 9, color: tradeResult.orderStatus === "filled" ? "var(--accent)" : "var(--text-secondary)" }}>
                      Fill Status: {tradeResult.orderStatus.toUpperCase()}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>TRADE FAILED</div>
                  <div style={{ fontSize: 10, color: "var(--accent-warn)" }}>{tradeResult.error}</div>
                  {tradeResult.errorCode && (
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>
                      CODE: {tradeResult.errorCode}
                    </div>
                  )}
                  {tradeResult.progress && tradeResult.progress.length > 0 && (
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 4 }}>
                      {tradeResult.progress.map((p: { state: string; message: string }, i: number) => (
                        <div key={i}>{p.state}: {p.message}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={executeTrade}
            disabled={executing}
            className="btn-primary"
            style={{
              width: "100%",
              height: 44,
              fontSize: 14,
              cursor: executing ? "wait" : "pointer",
              opacity: executing ? 0.7 : 1,
            }}
          >
            {executing
              ? "Executing Order..."
              : `Execute Trade · ${effectiveSide === "buy" ? "Buy Yes (Long)" : "Sell Yes (Short)"} @ ${formatProb(active.maxEntryPrice)}%`}
          </button>
        </div>
      ) : suppressTrade ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 3 }}>
              <div className="form-label" style={{ marginBottom: 2 }}>OBSERVED BIAS</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, color: effectiveSide === "buy" ? "var(--accent)" : effectiveSide === "sell" ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                {effectiveSide === "buy" ? "UP" : effectiveSide === "sell" ? "DOWN" : "NEUTRAL"}
              </div>
            </div>
            <div style={{ padding: "6px 8px", textAlign: "center", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 3 }}>
              <div className="form-label" style={{ marginBottom: 2 }}>ACTIONABILITY</div>
              <div style={{ fontFamily: "var(--font-data)", fontSize: 14, fontWeight: 700, color: "var(--accent-warn)" }}>
                {actionability.toUpperCase()}
              </div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            No high-confidence setup detected. Market conviction is conflicted.
            Execution remains available, but confidence is limited.
            {trajectory.confidence < 0.5 ? ` Signal confidence ${pctStr(trajectory.confidence, 0)}%.` : ""}
            {trajectory.reversalRisk > 0.5 ? ` Reversal risk ${pctStr(trajectory.reversalRisk, 0)}%.` : ""}
          </p>
        </div>
      ) : (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, marginTop: 12, color: "var(--text-secondary)" }}>No trade recommended for this strategy.</p>
      )}
    </SectionCard>
    </div>
  );
}



/* ═══════════════════════════════════════════════════════ */
/* CollapsibleOrderbook — toggle orderbook visibility       */
/* ═══════════════════════════════════════════════════════ */

function CollapsibleOrderbook({ asset }: { asset: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: open ? "rgba(255,255,255,0.02)" : "transparent",
          border: "none",
          cursor: "pointer",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
      >
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          Orderbook
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms ease" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: 0 }}>
          <OrderbookPanel symbol={asset} />
        </div>
      )}
    </div>
  );
}
