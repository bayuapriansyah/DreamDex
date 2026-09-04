"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { Strategy, StrategyType } from "@/lib/dreamdex/strategy";
import { TemporalTrajectoryChart } from "@/components/charts/TemporalTrajectoryChart";
import { StateTransition } from "@/components/temporal/StateTransition";

interface HorizonPoint {
  horizonMinutes: number;
  marketId: string;
  yesProbability: number;
  bidProbability: number | null;
  askProbability: number | null;
  midProbability: number;
  spread: number;
  volume: number;
  secondsLeft: number;
  dataQuality: string;
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
  state: string;
  stateLabel: string;
  stateDescription: string;
  trajectoryScore: number;
  confidence: number;
  reversalRisk: number;
  whatChanged: string;
  why: string;
  evidence: string[];
}

function stateColor(state: string): string {
  if (state.includes("bullish")) return "var(--accent-copper)";
  if (state.includes("bearish")) return "var(--accent-steel)";
  if (state === "reversal-warning") return "var(--accent-warn)";
  if (state === "cross-horizon-conflict") return "var(--accent-ember)";
  return "var(--muted-foreground)";
}

function probColor(p: number): string {
  if (p > 0.6) return "var(--accent-copper)";
  if (p < 0.4) return "var(--accent-steel)";
  return "var(--chalk)";
}

function formatHorizon(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(0)}h`;
  return `${(mins / 1440).toFixed(0)}d`;
}

function probBarBg(p: number): string {
  if (p > 0.6) return "var(--accent-copper)";
  if (p < 0.4) return "var(--accent-steel)";
  return "var(--muted-foreground)";
}

export default function AnalyzePage() {
  const params = useParams();
  const asset = (params.asset as string)?.toUpperCase() || "BTC";
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

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
      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <div className="h-6 w-32 skeleton rounded" />
        <div className="h-12 skeleton rounded" />
        <div className="h-64 skeleton rounded" />
        <div className="h-48 skeleton rounded" />
      </div>
    );
  }

  if (error && !trajectory) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-4 text-center space-y-3">
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!trajectory) return null;

  const { horizons, metrics, state, stateLabel, stateDescription } = trajectory;
  const sorted = [...horizons].sort((a, b) => a.horizonMinutes - b.horizonMinutes);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold font-mono" style={{ color: "var(--tape)" }}>{trajectory.asset}</h1>
          <span className="text-sm font-semibold" style={{ color: stateColor(state) }}>{stateLabel}</span>
          <span className="text-[10px] font-mono" style={{ color: "var(--muted-foreground)" }}>
            Updated {new Date(trajectory.asOf).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => window.location.reload()}>
            Refresh
          </Button>
          <Link href="/markets">
            <Button variant="outline" size="sm" className="text-[10px] h-6">Markets</Button>
          </Link>
        </div>
      </div>

      {/* ── Metrics Strip ── */}
      <div style={{ borderRadius: 6, border: `1px solid ${stateColor(state)}40`, background: `${stateColor(state)}12`, padding: 12 }}>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--chalk)" }}>{stateDescription}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Velocity", value: `${metrics.velocityPerHour > 0 ? "+" : ""}${(metrics.velocityPerHour * 100).toFixed(2)}%/hr`, color: metrics.velocityPerHour > 0 ? "var(--accent-copper)" : metrics.velocityPerHour < 0 ? "var(--accent-steel)" : "var(--chalk)" },
            { label: "Persistence", value: `${(metrics.persistence * 100).toFixed(0)}%` },
            { label: "Rev Risk", value: `${(trajectory.reversalRisk * 100).toFixed(0)}%`, color: trajectory.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--chalk)" },
            { label: "Divergence", value: `${(metrics.crossHorizonDivergence * 100).toFixed(1)}pp` },
            { label: "Score", value: `${(trajectory.trajectoryScore * 100).toFixed(0)}%` },
            { label: "Confidence", value: `${(trajectory.confidence * 100).toFixed(0)}%` },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>{m.label}</div>
              <div className="text-sm font-mono font-bold tabular-nums" style={{ color: m.color || "var(--chalk)" }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trajectory Chart ── */}
      <section>
        <div className="section-heading">Probability Trajectory</div>
        {sorted.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: "var(--muted-foreground)" }}>No active horizons</p>
        ) : (
          <TemporalTrajectoryChart
            horizons={sorted.map((h) => ({
              horizonMinutes: h.horizonMinutes,
              midProbability: h.midProbability,
              bestBid: h.bidProbability,
              bestAsk: h.askProbability,
              volume: h.volume,
              dataQuality: h.dataQuality,
            }))}
            state={trajectory.state}
          />
        )}
      </section>

      {/* ── Horizons Table ── */}
      {sorted.length > 0 && (
        <section>
          <div className="section-heading">Horizons</div>
          <div style={{ border: "1px solid rgba(239,230,214,0.08)", borderRadius: 6, overflow: "hidden" }}>
            <div className="grid grid-cols-[60px_1fr_80px_80px_60px_50px] gap-2 px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider border-b" style={{ background: "rgba(239,230,214,0.02)", borderColor: "rgba(239,230,214,0.08)", color: "var(--muted-foreground)" }}>
              <span>Time</span>
              <span>Probability</span>
              <span>Bid</span>
              <span>Ask</span>
              <span className="text-right">Spread</span>
              <span className="text-right">Quality</span>
            </div>
            {sorted.map((h) => (
              <div
                key={h.marketId}
                className="grid grid-cols-[60px_1fr_80px_80px_60px_50px] gap-2 items-center px-3 py-2 horizon-row border-b last:border-b-0"
                style={{ borderColor: "rgba(239,230,214,0.06)" }}
              >
                <span className="text-xs font-mono font-bold" style={{ color: "var(--tape)" }}>{formatHorizon(h.horizonMinutes)}</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(239,230,214,0.06)" }}>
                    <div
                      className="h-full rounded-full metric-fill"
                      style={{ width: `${h.midProbability * 100}%`, background: probBarBg(h.midProbability) }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold tabular-nums min-w-[3rem] text-right" style={{ color: probColor(h.midProbability) }}>
                    {(h.midProbability * 100).toFixed(1)}%
                  </span>
                </div>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                  {h.bidProbability !== null ? `${(h.bidProbability * 100).toFixed(1)}%` : "—"}
                </span>
                <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                  {h.askProbability !== null ? `${(h.askProbability * 100).toFixed(1)}%` : "—"}
                </span>
                <span className="text-[10px] font-mono tabular-nums text-right" style={{ color: "var(--muted-foreground)" }}>
                  {(h.spread * 100).toFixed(1)}pp
                </span>
                <span className="text-right">
                  <Badge variant="outline" className="text-[8px] px-1 py-0" style={{
                    borderColor: h.dataQuality === "high" ? "var(--accent-copper)" : h.dataQuality === "medium" ? "var(--accent-warn)" : "var(--accent-steel)",
                    color: h.dataQuality === "high" ? "var(--accent-copper)" : h.dataQuality === "medium" ? "var(--accent-warn)" : "var(--accent-steel)",
                  }}>
                    {h.dataQuality}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Metrics Detail ── */}
      <section>
        <div className="section-heading">Metrics</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
          {[
            { label: "Direction Strength", value: metrics.directionStrength, color: "var(--accent-steel)" },
            { label: "Momentum", value: Math.abs(metrics.momentum), color: metrics.momentum > 0 ? "var(--accent-copper)" : "var(--accent-steel)" },
            { label: "Persistence", value: metrics.persistence, color: "var(--accent-ember)" },
            { label: "Conviction Decay", value: Math.abs(metrics.convictionDecay), color: metrics.convictionDecay < 0 ? "var(--accent-warn)" : "var(--accent-copper)" },
            { label: "Data Quality", value: metrics.dataQuality, color: "var(--accent-steel)" },
            { label: "Liquidity", value: metrics.liquidity, color: "var(--accent-copper)" },
          ].map((m) => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-[10px]">
                <span style={{ color: "var(--muted-foreground)" }}>{m.label}</span>
                <span className="font-mono tabular-nums" style={{ color: "var(--chalk)" }}>{(m.value * 100).toFixed(1)}%</span>
              </div>
              <Progress value={m.value * 100} className="h-1">
                <div className="h-full rounded-full" style={{ width: `${m.value * 100}%`, background: m.color }} />
              </Progress>
            </div>
          ))}
        </div>
      </section>

      {/* ── What Changed ── */}
      <section className="section-divider pt-4">
        <div className="section-heading">What Changed</div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--chalk)" }}>{trajectory.whatChanged}</p>
      </section>

      {/* ── Why ── */}
      <section className="section-divider pt-4">
        <div className="section-heading">Why</div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--chalk)" }}>{trajectory.why}</p>
      </section>

      {/* ── Evidence ── */}
      <section className="section-divider pt-4">
        <div className="section-heading">Evidence</div>
        <ul className="space-y-1.5">
          {trajectory.evidence.map((e, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <span style={{ color: "var(--muted-foreground)" }} className="mt-0.5">•</span>
              <span className="leading-relaxed" style={{ color: "var(--chalk)" }}>{e}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Scenarios ── */}
      <ScenarioView trajectory={trajectory} />

      {/* ── Strategy ── */}
      <StrategyComposer trajectory={trajectory} asset={asset} />

      {/* ── AI ── */}
      <AIExplanation asset={asset} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ScenarioView                                           */
/* ═══════════════════════════════════════════════════════ */

function ScenarioView({ trajectory }: { trajectory: Trajectory }) {
  const { horizons, metrics, state } = trajectory;
  const sorted = [...horizons].sort((a, b) => a.horizonMinutes - b.horizonMinutes);
  if (sorted.length < 2) return null;

  const current = sorted[0].midProbability;
  const longTerm = sorted[sorted.length - 1].midProbability;
  const velocity = metrics.velocityPerHour;

  const scenarios = [
    {
      label: "Continuation",
      probability: Math.min(Math.max(longTerm + velocity * 2, 0.01), 0.99),
      description:
        velocity > 0.01 ? "If current momentum persists, probability continues rising."
        : velocity < -0.01 ? "If current momentum persists, probability continues falling."
        : "If current trend persists, probability stays near current level.",
    },
    {
      label: "Reversal",
      probability: Math.min(Math.max(1 - longTerm + (1 - longTerm - 0.5) * 0.5, 0.01), 0.99),
      description: "If the market reverses conviction, probability moves toward the opposite extreme.",
    },
    {
      label: "Convergence",
      probability: (current + longTerm) / 2,
      description: "If short-term and long-term probabilities converge to the mean.",
    },
  ];

  return (
    <section className="section-divider pt-4">
      <div className="section-heading">MAP THE NEXT HOUR</div>
      <p className="text-[10px] mb-3" style={{ color: "var(--muted-foreground)" }}>
        Scenario projections based on current trajectory. NOT predictions — show what happens IF trends continue, reverse, or converge.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map((s) => (
          <div key={s.label} style={{ padding: 12, borderRadius: 6, border: "1px solid rgba(239,230,214,0.08)", background: "rgba(239,230,214,0.035)" }}>
            <div className="text-[9px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
            <div className="text-xl font-mono font-bold tabular-nums mb-1" style={{ color: "var(--tape)" }}>
              {(s.probability * 100).toFixed(1)}%
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{s.description}</p>
            <Progress value={s.probability * 100} className="h-1 mt-2">
              <div className="h-full rounded-full" style={{ width: `${s.probability * 100}%`, background: probBarBg(s.probability) }} />
            </Progress>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 6, background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
        <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <strong>Key insight:</strong>{" "}
          {state.includes("decay")
            ? "Conviction is decaying — continuation scenario may be less likely than convergence."
            : state.includes("acceleration")
            ? "Conviction is accelerating — continuation scenario is more likely than reversal."
            : state === "cross-horizon-conflict"
            ? "Horizons disagree — convergence scenario is most likely as markets resolve uncertainty."
            : state === "reversal-warning"
            ? "Reversal detected — the reversal scenario has elevated probability."
            : "Market is stable — scenarios depend on upcoming catalysts."}
        </p>
      </div>

      <div className="mt-3">
        <StateTransition
          currentState={state}
          velocityPerHour={metrics.velocityPerHour}
          momentum={metrics.momentum}
          crossHorizonDivergence={metrics.crossHorizonDivergence}
          reversalRisk={trajectory.reversalRisk}
        />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* StrategyComposer                                       */
/* ═══════════════════════════════════════════════════════ */

function StrategyComposer({
  trajectory,
  asset,
}: {
  trajectory: Trajectory;
  asset: string;
}) {
  const [selected, setSelected] = useState<StrategyType>("balanced");
  const [executing, setExecuting] = useState(false);
  const [tradeResult, setTradeResult] = useState<{ ok: boolean; hash?: string; error?: string } | null>(null);

  const strategies = useMemo(() => {
    const sortedHorizons = [...trajectory.horizons].sort((a, b) => a.horizonMinutes - b.horizonMinutes);
    const avgProb = sortedHorizons.length > 0
      ? sortedHorizons.reduce((a, h) => a + h.midProbability, 0) / sortedHorizons.length
      : 0.5;

    const configs: Record<StrategyType, { risk: number; mult: number; tp: number; sl: number }> = {
      conservative: { risk: 0.3, mult: 0.5, tp: 0.05, sl: 0.1 },
      balanced: { risk: 0.5, mult: 1, tp: 0.1, sl: 0.15 },
      aggressive: { risk: 0.8, mult: 2, tp: 0.2, sl: 0.2 },
    };

    const state = trajectory.state as string;
    const m = trajectory.metrics;

    return (["conservative", "balanced", "aggressive"] as StrategyType[]).map((type) => {
      const cfg = configs[type];
      let side: "buy" | "sell" | "hold" = "hold";
      let reasoning = "No clear signal.";

      if (state.includes("bullish")) {
        if (state === "bullish-decay" && cfg.risk < 0.5) {
          reasoning = "Bullish but decaying — waiting for confirmation.";
        } else {
          side = "buy";
          reasoning = `${m.persistence > 0.7 ? "Strong" : "Moderate"} bullish signal. Velocity ${(m.velocityPerHour * 100).toFixed(2)}%/hr.`;
        }
      } else if (state.includes("bearish")) {
        if (state === "bearish-decay" && cfg.risk < 0.5) {
          reasoning = "Bearish but decaying — waiting for confirmation.";
        } else {
          side = "sell";
          reasoning = `${m.persistence > 0.7 ? "Strong" : "Moderate"} bearish signal. Velocity ${(m.velocityPerHour * 100).toFixed(2)}%/hr.`;
        }
      } else if (state === "cross-horizon-conflict" && cfg.risk >= 0.5) {
        side = avgProb > 0.5 ? "buy" : "sell";
        reasoning = `Conflicted but entering lean ${avgProb > 0.5 ? "long" : "short"}.`;
      } else if (state === "reversal-warning" && cfg.risk > 0.6) {
        side = avgProb > 0.5 ? "sell" : "buy";
        reasoning = "Fading the reversal.";
      } else if (state === "neutral") {
        reasoning = "Neutral — no trade recommended.";
      } else if (state === "insufficient-data") {
        reasoning = "Insufficient data.";
      }

      const horizon = sortedHorizons[
        type === "conservative" ? Math.min(1, sortedHorizons.length - 1)
        : type === "aggressive" ? 0
        : Math.floor(sortedHorizons.length / 2)
      ]?.horizonMinutes || 60;

      const entry = side === "buy"
        ? Math.min(sortedHorizons.find((h) => h.horizonMinutes === horizon)?.askProbability ?? avgProb + cfg.risk * 0.03, 0.99)
        : side === "sell"
        ? Math.max(sortedHorizons.find((h) => h.horizonMinutes === horizon)?.bidProbability ?? avgProb - cfg.risk * 0.03, 0.01)
        : 0.5;

      const tp = side === "buy" ? Math.min(entry + cfg.tp, 0.99) : side === "sell" ? Math.max(entry - cfg.tp, 0.01) : 0;
      const sl = side === "buy" ? Math.max(entry - cfg.sl, 0.01) : side === "sell" ? Math.min(entry + cfg.sl, 0.99) : 0;

      const score = m.dataQuality * 0.4 + trajectory.trajectoryScore * 0.6;
      const conf = score > 0.5 - cfg.risk * 0.2 ? "high" : score > 0.3 - cfg.risk * 0.1 ? "medium" : "low";

      const strat: Strategy = {
        type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        description: type === "conservative" ? "Smaller size, tighter stops."
          : type === "balanced" ? "Standard approach."
          : "Larger size, wider targets.",
        side,
        reasoning,
        suggestedHorizon: horizon,
        suggestedSize: Math.max(1, Math.round(cfg.mult * (0.5 + m.dataQuality * 0.3 + m.liquidity * 0.2) * trajectory.confidence)),
        maxEntryPrice: entry,
        takeProfit: tp,
        stopLoss: sl,
        confidence: conf as "high" | "medium" | "low",
      };
      return strat;
    });
  }, [trajectory]);

  const active = strategies.find((s) => s.type === selected) ?? strategies[1];

  async function executeTrade() {
    if (active.side === "hold") return;
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
          symbol: targetHorizon.marketId,
          side: active.side,
          amount: active.suggestedSize,
          price: active.maxEntryPrice,
          type: "limit",
        }),
      });
      const data = await res.json();
      setTradeResult(data);
      if (data.ok) {
        const thesis = {
          id: `thesis-${Date.now()}`,
          asset,
          side: active.side as "up" | "down",
          horizon: active.suggestedHorizon,
          entryProbability: active.maxEntryPrice,
          thesis: active.reasoning,
          state: trajectory.state,
          stateLabel: trajectory.stateLabel,
          createdAt: new Date().toISOString(),
        };
        const stored = localStorage.getItem("dreamdex-theses");
        const theses = stored ? JSON.parse(stored) : [];
        theses.push(thesis);
        localStorage.setItem("dreamdex-theses", JSON.stringify(theses));
      }
    } catch (e: unknown) {
      setTradeResult({ ok: false, error: e instanceof Error ? e.message : "Trade failed" });
    } finally {
      setExecuting(false);
    }
  }

  return (
    <section className="section-divider pt-4">
      <div className="section-heading">Strategy Composer</div>

      <Tabs value={selected} onValueChange={(v) => setSelected(v as StrategyType)}>
        <TabsList className="h-8">
          <TabsTrigger value="conservative" className="text-[10px] h-6">Conservative</TabsTrigger>
          <TabsTrigger value="balanced" className="text-[10px] h-6">Balanced</TabsTrigger>
          <TabsTrigger value="aggressive" className="text-[10px] h-6">Aggressive</TabsTrigger>
        </TabsList>

        <TabsContent value={selected} className="mt-3 space-y-3">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{active.description}</p>
          <div className="text-xs p-2 rounded" style={{ background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
            {active.reasoning}
          </div>
        </TabsContent>
      </Tabs>

      {/* Trade Preview */}
      {active.side !== "hold" ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Side", value: active.side.toUpperCase(), color: active.side === "buy" ? "var(--accent-copper)" : "var(--accent-steel)" },
              { label: "Entry", value: `${(active.maxEntryPrice * 100).toFixed(1)}%` },
              { label: "Size", value: `${active.suggestedSize}` },
              { label: "Horizon", value: formatHorizon(active.suggestedHorizon) },
            ].map((item) => (
              <div key={item.label} className="p-2 rounded text-center" style={{ background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{item.label}</div>
                <div className="text-sm font-mono font-bold" style={{ color: item.color || "var(--chalk)" }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded text-center" style={{ background: "rgba(232,160,96,0.12)", border: "1px solid rgba(232,160,96,0.3)" }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--accent-copper)" }}>Take Profit</div>
              <div className="text-sm font-mono font-bold" style={{ color: "var(--accent-copper)" }}>{(active.takeProfit * 100).toFixed(1)}%</div>
            </div>
            <div className="p-2 rounded text-center" style={{ background: "rgba(143,192,222,0.12)", border: "1px solid rgba(143,192,222,0.3)" }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--accent-steel)" }}>Stop Loss</div>
              <div className="text-sm font-mono font-bold" style={{ color: "var(--accent-steel)" }}>{(active.stopLoss * 100).toFixed(1)}%</div>
            </div>
            <div className="p-2 rounded text-center" style={{ background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Confidence</div>
              <Badge variant="outline" className="text-[9px] mt-0.5" style={{
                borderColor: active.confidence === "high" ? "var(--accent-copper)" : active.confidence === "medium" ? "var(--accent-warn)" : "var(--accent-steel)",
                color: active.confidence === "high" ? "var(--accent-copper)" : active.confidence === "medium" ? "var(--accent-warn)" : "var(--accent-steel)",
              }}>
                {active.confidence}
              </Badge>
            </div>
          </div>

          <div className="text-[10px] p-2 rounded" style={{ color: "var(--muted-foreground)", background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
            Demo/Testnet Executor — transaction is not signed by your connected wallet.
          </div>

          {tradeResult && (
            <div className="text-xs p-2 rounded" style={{
              background: tradeResult.ok ? "rgba(232,160,96,0.12)" : "rgba(196,92,58,0.12)",
              border: `1px solid ${tradeResult.ok ? "rgba(232,160,96,0.3)" : "rgba(196,92,58,0.3)"}`,
              color: tradeResult.ok ? "var(--accent-copper)" : "var(--accent-warn)",
            }}>
              {tradeResult.ok ? (
                <div>
                  <span className="font-medium">Trade Executed</span>
                  {tradeResult.hash && (
                    <a href={`https://shannon-explorer.somnia.network/tx/${tradeResult.hash}`} target="_blank" rel="noopener noreferrer" className="underline ml-2">
                      TX: {tradeResult.hash.slice(0, 16)}...
                    </a>
                  )}
                </div>
              ) : (
                tradeResult.error
              )}
            </div>
          )}

          <Button className="w-full h-8" onClick={executeTrade} disabled={executing}>
            {executing ? "Executing..." : `${active.side.toUpperCase()} ${active.suggestedSize} @ ${(active.maxEntryPrice * 100).toFixed(1)}%`}
          </Button>
        </div>
      ) : (
        <p className="text-xs mt-3" style={{ color: "var(--muted-foreground)" }}>No trade recommended for this strategy.</p>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* AIExplanation — compact, bottom                        */
/* ═══════════════════════════════════════════════════════ */

function AIExplanation({ asset }: { asset: string }) {
  const [explanation, setExplanation] = useState<{
    summary: string;
    keyEvidence: string[];
    uncertainty: string;
    invalidation: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        const res = await fetch(`/api/dreamdex/explain?asset=${asset}`);
        const data = await res.json();
        if (!fetchedRef.current && data.ok && data.explanation) {
          setExplanation(data.explanation);
        }
      } catch {
        // silent
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    return () => { fetchedRef.current = true; };
  }, [asset]);

  return (
    <section className="section-divider pt-4">
      <div className="section-heading flex items-center justify-between">
        <span>Temporal Copilot</span>
        <span className="text-[8px] normal-case tracking-normal" style={{ color: "var(--muted-foreground)" }}>
          {loading ? "Loading..." : explanation ? "Gemini Flash" : "Deterministic"}
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 rounded skeleton w-3/4" style={{ background: "rgba(239,230,214,0.06)" }} />
          <div className="h-3 rounded skeleton w-1/2" style={{ background: "rgba(239,230,214,0.06)" }} />
        </div>
      ) : explanation ? (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed" style={{ color: "var(--chalk)" }}>{explanation.summary}</p>
          <ul className="space-y-1">
            {explanation.keyEvidence.map((e, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <span style={{ color: "var(--muted-foreground)" }}>•</span>
                <span className="leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{e}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 rounded" style={{ background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>Uncertainty</div>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{explanation.uncertainty}</p>
            </div>
            <div className="p-2 rounded" style={{ background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)" }}>
              <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>Invalidation</div>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{explanation.invalidation}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>AI unavailable. See deterministic analysis above.</p>
      )}
    </section>
  );
}
