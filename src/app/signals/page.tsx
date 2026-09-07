"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  formatProb,
  formatHorizon,
  pctStr,
  formatVelocity,
} from "@/lib/dreamdex/formatting";
import {
  type SignalResult,
  type SignalFilter,
  type SortKey,
  type SignalGroup,
  classifyGroup,
  filterSignals,
  sortSignals,
  SIGNAL_GROUP_ORDER,
} from "@/lib/dreamdex/signal-engine";
import {
  isFollowing as checkIsFollowing,
  addFollow,
  removeFollow,
} from "@/lib/dreamdex/following";
import type { MarketState } from "@/lib/dreamdex/temporal";

const FILTER_OPTIONS: { value: SignalFilter; label: string }[] = [
  { value: "ALL", label: "ALL" },
  { value: "BULLISH", label: "BULLISH" },
  { value: "BEARISH", label: "BEARISH" },
  { value: "REVERSAL", label: "REVERSAL" },
  { value: "CONFLICT", label: "CONFLICT" },
  { value: "HIGH_CONFIDENCE", label: "HIGH CONF" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "strength", label: "Signal Strength" },
  { value: "confidence", label: "Confidence" },
  { value: "actionability", label: "Actionability" },
  { value: "freshness", label: "Freshness" },
];

const GROUP_LABELS: Record<SignalGroup, string> = {
  bullish: "BULLISH",
  bearish: "BEARISH",
  reversal: "REVERSAL WATCH",
  conflict: "CROSS-HORIZON CONFLICT",
  insufficient: "INSUFFICIENT DATA",
};

const GROUP_COLORS: Record<SignalGroup, string> = {
  bullish: "var(--accent)",
  bearish: "var(--accent-secondary)",
  reversal: "var(--accent-warn)",
  conflict: "var(--accent-ember)",
  insufficient: "var(--text-tertiary)",
};

function signalColor(state: string): string {
  if (state.startsWith("bullish")) return "var(--accent)";
  if (state.startsWith("bearish")) return "var(--accent-secondary)";
  if (state === "reversal-warning" || state === "cross-horizon-conflict")
    return "var(--accent-warn)";
  return "var(--text-secondary)";
}

function freshnessLabel(asOf: string): string {
  const diff = Date.now() - new Date(asOf).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function freshnessClass(asOf: string): "live" | "recent" | "stale" {
  const age = Date.now() - new Date(asOf).getTime();
  if (age < 15_000) return "live";
  if (age < 60_000) return "recent";
  return "stale";
}

const FRESHNESS_STYLES: Record<string, { color: string; label: string }> = {
  live: { color: "var(--accent-success)", label: "LIVE" },
  recent: { color: "var(--accent)", label: "RECENT" },
  stale: { color: "var(--accent-warn)", label: "STALE" },
};

export default function SignalsPage() {
  const { address } = useAccount();
  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SignalFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("strength");
  const [groupView, setGroupView] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const fetchedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async () => {
    try {
      // Dynamic asset discovery
      let assets: string[] = ["BTC", "ETH"];
      try {
        const marketsRes = await fetch("/api/dreamdex/markets");
        if (marketsRes.ok) {
          const marketsData = await marketsRes.json();
          if (marketsData.ok && Object.keys(marketsData.grouped || {}).length > 0) {
            assets = Object.keys(marketsData.grouped);
          }
        }
      } catch { /* fallback to BTC, ETH */ }

      const results: SignalResult[] = [];
      for (const asset of assets) {
        const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!fetchedRef.current && data.ok && data.trajectory) {
          results.push({
            asset,
            trajectory: data.trajectory,
            decisionContext: data.decisionContext,
          });
        }
      }
      return results;
    } catch (e) {
      if (!fetchedRef.current) {
        setError(
          e instanceof Error ? e.message : "Failed to load signals"
        );
      }
      return [];
    }
  }, []);

  useEffect(() => {
    fetchedRef.current = false;
    let mounted = true;

    async function init() {
      const results = await fetchSignals();
      if (!mounted) return;
      setSignals(results);
      setLastUpdated(new Date().toLocaleTimeString());
      if (results.length === 0) {
        setError("No signals available. Market data is being fetched.");
      }
      setLoading(false);
    }

    void init();

    intervalRef.current = setInterval(async () => {
      if (!mounted) return;
      const results = await fetchSignals();
      if (!mounted) return;
      setSignals(results);
      setLastUpdated(new Date().toLocaleTimeString());
      if (results.length === 0) {
        setError("No signals available. Market data is being fetched.");
      }
    }, 30000);

    return () => {
      mounted = false;
      fetchedRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSignals]);

  const filtered = sortSignals(filterSignals(signals, filter), sortBy);

  const groups = groupView
    ? (() => {
        const sorted = sortSignals(signals, sortBy);
        return SIGNAL_GROUP_ORDER
          .map((g) => ({
            group: g,
            label: GROUP_LABELS[g],
            color: GROUP_COLORS[g],
            signals: sorted.filter(
              (s) => classifyGroup(s.trajectory.state) === g
            ),
          }))
          .filter((g) => g.signals.length > 0);
      })()
    : [];

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
            Temporal Signals
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 0,
            }}
          >
            Real-time market conviction trajectories
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

      {/* Controls: Filter + Sort + Group Toggle */}
      <div
        className="flex flex-wrap items-center gap-3 mb-8 animate-fade-up"
        style={{ animationDelay: "0.05s" }}
      >
        {/* Filter buttons */}
        <div className="flex items-center gap-1.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={active ? "btn-primary" : "btn-secondary"}
                style={{
                  height: 32,
                  padding: "5px 14px",
                  fontSize: 11,
                  fontFamily: "var(--font-data)",
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
          }}
        />

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{
            height: 32,
            padding: "0 28px 0 10px",
            fontSize: 11,
            fontFamily: "var(--font-data)",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            cursor: "pointer",
            appearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2371717a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
          }}
        />

        {/* Group toggle */}
        <button
          onClick={() => setGroupView(!groupView)}
          className={groupView ? "btn-primary" : "btn-secondary"}
          style={{
            height: 32,
            padding: "5px 14px",
            fontSize: 11,
            fontFamily: "var(--font-data)",
            fontWeight: groupView ? 600 : 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {groupView ? "UNGROUP" : "GROUP"}
        </button>

        {/* Signal count */}
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-data)",
            color: "var(--text-tertiary)",
            marginLeft: "auto",
          }}
        >
          {filtered.length} signal{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading */}
      {loading && signals.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="card" style={{ padding: 32 }}>
              <div className="flex gap-4">
                <div className="skeleton" style={{ width: 64, height: 28 }} />
                <div className="flex-1 space-y-4">
                  <div className="skeleton" style={{ height: 18, width: 120 }} />
                  <div className="skeleton" style={{ height: 40, width: "100%" }} />
                  <div className="skeleton" style={{ height: 14, width: 80 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && signals.length === 0 && (
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

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && signals.length > 0 && (
        <div className="card text-center" style={{ padding: 64 }}>
          <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
            No signals match this filter.
          </p>
        </div>
      )}
      {!loading && !error && signals.length === 0 && (
        <div className="card text-center" style={{ padding: 64 }}>
          <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
            No signals available. Market data is being fetched.
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

      {/* Grouped View */}
      {groupView && groups.length > 0 && (
        <div className="space-y-8">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="status-pill"
                  style={{
                    color: g.color,
                    background: `${g.color}18`,
                    border: `1px solid ${g.color}30`,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                  }}
                >
                  {g.label}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-data)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {g.signals.length} market{g.signals.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {g.signals.map((signal, idx) => (
                  <SignalCard
                    key={signal.asset}
                    signal={signal}
                    idx={idx}
                    wallet={address}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flat View */}
      {!groupView && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((signal, idx) => (
            <SignalCard
              key={signal.asset}
              signal={signal}
              idx={idx}
              wallet={address}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* Signal Card                                             */
/* ═══════════════════════════════════════════════════════ */

function SignalCard({
  signal,
  idx,
  wallet,
  onFollowChange,
}: {
  signal: SignalResult;
  idx: number;
  wallet: string | undefined;
  onFollowChange?: () => void;
}) {
  const firstValidHorizon = signal.trajectory.horizons.find(
    (h) => h.midProbability !== null
  );
  const currentProb = firstValidHorizon?.midProbability ?? null;
  const color = signalColor(signal.trajectory.state);
  const asOf = signal.trajectory.asOf;
  const validHorizons = signal.trajectory.horizons.filter(
    (h) => h.midProbability !== null
  ).length;
  const totalHorizons = signal.trajectory.horizons.length;
  const freshness = freshnessClass(asOf);
  const freshStyle = FRESHNESS_STYLES[freshness];

  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    setFollowing(
      checkIsFollowing(wallet, signal.asset, firstValidHorizon?.horizonMinutes ?? 60)
    );
  }, [wallet, signal.asset, firstValidHorizon]);

  function handleFollow() {
    if (!wallet || !firstValidHorizon) return;
    if (following) {
      removeFollow(wallet, `${signal.asset}-${firstValidHorizon.horizonMinutes}`);
      setFollowing(false);
    } else {
      const current = signal.trajectory;
      addFollow(wallet, {
        marketId: firstValidHorizon.marketId ?? "",
        asset: signal.asset,
        horizonMinutes: firstValidHorizon.horizonMinutes,
        baselineProbability: currentProb ?? 0.5,
        baselineRegime: current.state as MarketState,
        baselineRegimeLabel: current.stateLabel,
        baselineConfidence: current.confidence,
        baselineReversalRisk: current.reversalRisk,
        baselineDivergence: current.metrics.crossHorizonDivergence,
        baselineVelocity: current.metrics.velocityPerHour,
        baselineActionability: signal.decisionContext?.actionability ?? "low",
      });
      setFollowing(true);
    }
    onFollowChange?.();
  }

  return (
    <div
      className="card card-interactive animate-fade-up"
      style={{
        padding: 28,
        animationDelay: `${0.1 + idx * 0.08}s`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* Top row: asset + freshness */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 26,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {signal.asset} / USD
          </span>
        </div>
        <div className="flex items-center gap-2">
          {freshStyle && (
            <span
              className="status-pill"
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: freshStyle.color,
                background: `${freshStyle.color}18`,
                border: `1px solid ${freshStyle.color}30`,
                padding: "2px 8px",
              }}
            >
              {freshStyle.label}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
            }}
          >
            {freshnessLabel(asOf)}
          </span>
        </div>
      </div>

      {/* Signal Label */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="status-pill"
          style={{
            color,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {signal.trajectory.stateLabel}
        </span>
      </div>

      {/* Current Probability */}
      <div className="mb-5">
        <span className="form-label" style={{ marginBottom: 4 }}>
          CURRENT PROB
        </span>
        <div
          className="tabular-nums"
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 40,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {formatProb(currentProb)}
        </div>
      </div>

      {/* Metrics Grid */}
      <div
        className="grid grid-cols-4 gap-4 mb-5"
        style={{
          padding: "14px 0",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Confidence */}
        <div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: 4,
            }}
          >
            Confidence
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
            {pctStr(signal.trajectory.confidence, 0)}%
          </span>
        </div>
        {/* Reversal Risk */}
        <div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: 4,
            }}
          >
            Reversal Risk
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: 18,
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              color:
                signal.trajectory.reversalRisk > 0.5
                  ? "var(--accent-warn)"
                  : "var(--text-primary)",
            }}
          >
            {pctStr(signal.trajectory.reversalRisk, 0)}%
          </span>
        </div>
        {/* Velocity */}
        <div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: 4,
            }}
          >
            Velocity
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: 15,
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              color:
                signal.trajectory.metrics.velocityPerHour > 0
                  ? "var(--accent)"
                  : signal.trajectory.metrics.velocityPerHour < 0
                    ? "var(--accent-secondary)"
                    : "var(--text-primary)",
            }}
          >
            {formatVelocity(signal.trajectory.metrics.velocityPerHour)}
          </span>
        </div>
        {/* Actionability */}
        <div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              display: "block",
              marginBottom: 4,
            }}
          >
            Actionability
          </span>
          <span
            style={{
              fontSize: 14,
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              color:
                signal.decisionContext?.actionability === "high"
                  ? "var(--accent)"
                  : signal.decisionContext?.actionability === "medium"
                    ? "var(--accent-secondary)"
                    : "var(--text-secondary)",
              textTransform: "capitalize",
            }}
          >
            {signal.decisionContext?.actionability ?? "—"}
          </span>
        </div>
      </div>

      {/* Horizon summary */}
      <div className="flex items-center gap-3 mb-4">
        {signal.trajectory.horizons
          .slice()
          .sort((a, b) => a.horizonMinutes - b.horizonMinutes)
          .map((h) => (
            <div key={h.horizonMinutes} className="flex-1 text-center">
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-data)",
                  color: "var(--text-tertiary)",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {formatHorizon(h.horizonMinutes)}
              </div>
              <span
                className="tabular-nums"
                style={{
                  fontSize: 15,
                  fontFamily: "var(--font-data)",
                  fontWeight: 600,
                  color:
                    h.midProbability !== null
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                }}
              >
                {h.midProbability !== null
                  ? `${pctStr(h.midProbability, 0)}%`
                  : "—"}
              </span>
            </div>
          ))}
      </div>

      {/* Horizon count */}
      <div
        className="flex items-center justify-between mb-5"
        style={{
          fontSize: 11,
          fontFamily: "var(--font-data)",
          color: "var(--text-tertiary)",
        }}
      >
        <span>
          {validHorizons} / {totalHorizons} horizons
        </span>
        <span>
          Score {pctStr(signal.trajectory.trajectoryScore, 0)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link
          href={`/analyze/${signal.asset}`}
          className="flex-1 flex items-center justify-center gap-2"
          style={{
            height: 38,
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
          Analyze {signal.asset}
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
        {wallet && firstValidHorizon && (
          <button
            onClick={handleFollow}
            style={{
              height: 38,
              padding: "0 16px",
              borderRadius: "var(--radius-full)",
              background: following ? `${color}20` : "var(--surface-2)",
              border: `1px solid ${following ? `${color}40` : "var(--border)"}`,
              color: following ? color : "var(--text-secondary)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              transition: "all var(--duration-normal) var(--ease-out)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {following ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Following
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Follow
              </>
            )}
          </button>
        )}
        <Link
          href={`/signals/compare?a=${signal.asset}`}
          style={{
            height: 38,
            width: 38,
            borderRadius: "var(--radius-full)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            transition: "all var(--duration-normal) var(--ease-out)",
          }}
          title="Compare"
        >
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
            <path d="M16 3h5v5" />
            <path d="M8 3H3v5" />
            <path d="M21 3l-7 7" />
            <path d="M3 3l7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
