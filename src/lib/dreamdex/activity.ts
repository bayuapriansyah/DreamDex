import type { TemporalTrajectory, MarketState } from "./temporal";
import { formatProb, ppStr } from "./formatting";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityEventType =
  | "probability-shift"
  | "regime-change"
  | "divergence-change"
  | "reversal-risk-change"
  | "confidence-change"
  | "data-quality-change"
  | "lifecycle-change";

export interface TemporalActivity {
  id: string;
  asset: string;
  type: ActivityEventType;
  title: string;
  subtitle: string;
  severity: "info" | "warning" | "significant";
  timestamp: number;
  metrics?: {
    previous?: number;
    current?: number;
    delta?: number;
  };
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const PROB_SHIFT_THRESHOLD = 0.05;
const DIVERGENCE_THRESHOLD = 0.03;
const REVERSAL_RISK_THRESHOLD = 0.10;
const CONFIDENCE_THRESHOLD = 0.10;
const DEDUP_WINDOW_MS = 60_000;
const MAX_EVENTS = 50;

// ---------------------------------------------------------------------------
// Per-asset snapshot (last known state)
// ---------------------------------------------------------------------------

interface AssetSnapshot {
  probability: number | null;
  state: MarketState;
  crossHorizonDivergence: number;
  reversalRisk: number;
  confidence: number;
  dataQuality: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstValidHorizonProb(t: TemporalTrajectory): number | null {
  for (const h of t.horizons) {
    if (h.midProbability !== null) return h.midProbability;
  }
  return null;
}

function snapshotFromTrajectory(t: TemporalTrajectory): AssetSnapshot {
  return {
    probability: firstValidHorizonProb(t),
    state: t.state,
    crossHorizonDivergence: t.metrics.crossHorizonDivergence,
    reversalRisk: t.reversalRisk,
    confidence: t.confidence,
    dataQuality: t.metrics.dataQuality,
  };
}

function makeId(asset: string, type: ActivityEventType, ts: number): string {
  return `${asset}-${type}-${ts}`;
}

function severityFor(type: ActivityEventType, delta: number): "info" | "warning" | "significant" {
  switch (type) {
    case "regime-change":
      return "significant";
    case "probability-shift":
      return Math.abs(delta) >= 0.10 ? "significant" : "warning";
    case "reversal-risk-change":
      return Math.abs(delta) >= 0.20 ? "significant" : "warning";
    case "confidence-change":
      return Math.abs(delta) >= 0.20 ? "significant" : "warning";
    case "divergence-change":
      return Math.abs(delta) >= 0.06 ? "warning" : "info";
    case "data-quality-change":
      return "info";
    case "lifecycle-change":
      return "warning";
    default:
      return "info";
  }
}

// ---------------------------------------------------------------------------
// ActivityTracker
// ---------------------------------------------------------------------------

class ActivityTracker {
  private events: TemporalActivity[] = [];
  private snapshots = new Map<string, AssetSnapshot>();

  update(asset: string, trajectory: TemporalTrajectory): TemporalActivity[] {
    const now = Date.now();
    const prev = this.snapshots.get(asset);
    const current = snapshotFromTrajectory(trajectory);
    this.snapshots.set(asset, current);

    if (!prev) return [];

    const newEvents: TemporalActivity[] = [];

    // --- Probability shift ---
    if (prev.probability !== null && current.probability !== null) {
      const delta = current.probability - prev.probability;
      if (Math.abs(delta) >= PROB_SHIFT_THRESHOLD) {
        newEvents.push({
          id: makeId(asset, "probability-shift", now),
          asset,
          type: "probability-shift",
          title: `${asset} · ${formatProb(prev.probability)} → ${formatProb(current.probability)}`,
          subtitle: `${ppStr(delta, 1)} conviction shift`,
          severity: severityFor("probability-shift", delta),
          timestamp: now,
          metrics: {
            previous: prev.probability,
            current: current.probability,
            delta,
          },
        });
      }
    }

    // --- Regime change ---
    if (prev.state !== current.state) {
      newEvents.push({
        id: makeId(asset, "regime-change", now),
        asset,
        type: "regime-change",
        title: `${asset} · ${stateLabel(prev.state)} → ${stateLabel(current.state)}`,
        subtitle: `Market regime shifted`,
        severity: severityFor("regime-change", 1),
        timestamp: now,
      });
    }

    // --- Divergence change ---
    const divDelta = current.crossHorizonDivergence - prev.crossHorizonDivergence;
    if (Math.abs(divDelta) >= DIVERGENCE_THRESHOLD) {
      newEvents.push({
        id: makeId(asset, "divergence-change", now),
        asset,
        type: "divergence-change",
        title: `${asset} · Divergence ${divDelta > 0 ? "expanded" : "contracted"}`,
        subtitle: `${ppStr(divDelta, 1)} cross-horizon divergence`,
        severity: severityFor("divergence-change", divDelta),
        timestamp: now,
        metrics: {
          previous: prev.crossHorizonDivergence,
          current: current.crossHorizonDivergence,
          delta: divDelta,
        },
      });
    }

    // --- Reversal risk change ---
    const rrDelta = current.reversalRisk - prev.reversalRisk;
    if (Math.abs(rrDelta) >= REVERSAL_RISK_THRESHOLD) {
      newEvents.push({
        id: makeId(asset, "reversal-risk-change", now),
        asset,
        type: "reversal-risk-change",
        title: `${asset} · Reversal risk ${rrDelta > 0 ? "increased" : "decreased"}`,
        subtitle: `Now at ${ppStr(current.reversalRisk, 1)}`,
        severity: severityFor("reversal-risk-change", rrDelta),
        timestamp: now,
        metrics: {
          previous: prev.reversalRisk,
          current: current.reversalRisk,
          delta: rrDelta,
        },
      });
    }

    // --- Confidence change ---
    const confDelta = current.confidence - prev.confidence;
    if (Math.abs(confDelta) >= CONFIDENCE_THRESHOLD) {
      newEvents.push({
        id: makeId(asset, "confidence-change", now),
        asset,
        type: "confidence-change",
        title: `${asset} · Confidence ${confDelta > 0 ? "increased" : "decreased"}`,
        subtitle: `Now at ${ppStr(current.confidence, 1)}`,
        severity: severityFor("confidence-change", confDelta),
        timestamp: now,
        metrics: {
          previous: prev.confidence,
          current: current.confidence,
          delta: confDelta,
        },
      });
    }

    // --- Data quality change ---
    const prevIsInsufficient = prev.dataQuality < 0.4;
    const currIsInsufficient = current.dataQuality < 0.4;
    if (prevIsInsufficient !== currIsInsufficient) {
      newEvents.push({
        id: makeId(asset, "data-quality-change", now),
        asset,
        type: "data-quality-change",
        title: currIsInsufficient
          ? `${asset} · Data quality degraded`
          : `${asset} · Data quality restored`,
        subtitle: currIsInsufficient
          ? "Market entered insufficient-data state"
          : "Market left insufficient-data state",
        severity: severityFor("data-quality-change", 1),
        timestamp: now,
      });
    }

    // --- Lifecycle change ---
    // Detect when status transitions to terminal states (locked/resolved)
    const hasTerminal = trajectory.horizons.some(
      (h) => h.status === "locked" || h.status === "resolved" || h.status === "voided"
    );
    const prevHadTerminal = this.snapshots.has(`${asset}__terminal`);
    if (hasTerminal && !prevHadTerminal) {
      newEvents.push({
        id: makeId(asset, "lifecycle-change", now),
        asset,
        type: "lifecycle-change",
        title: `${asset} · Market lifecycle changed`,
        subtitle: "Market entered locked/resolved state",
        severity: severityFor("lifecycle-change", 1),
        timestamp: now,
      });
    }
    if (hasTerminal) {
      this.snapshots.set(`${asset}__terminal`, current);
    }

    // --- Dedup and append ---
    const deduped = this.deduplicate(newEvents, now);
    this.events.push(...deduped);

    // FIFO cap
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(this.events.length - MAX_EVENTS);
    }

    return deduped;
  }

  getEvents(filter?: { asset?: string; type?: ActivityEventType }): TemporalActivity[] {
    let result = this.events;
    if (filter?.asset) {
      result = result.filter((e) => e.asset === filter.asset);
    }
    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type);
    }
    return [...result].sort((a, b) => b.timestamp - a.timestamp);
  }

  getRecent(asset?: string, count = 20): TemporalActivity[] {
    return this.getEvents(asset ? { asset } : undefined).slice(0, count);
  }

  private deduplicate(newEvents: TemporalActivity[], now: number): TemporalActivity[] {
    return newEvents.filter((ev) => {
      return !this.events.some(
        (existing) =>
          existing.asset === ev.asset &&
          existing.type === ev.type &&
          now - existing.timestamp < DEDUP_WINDOW_MS
      );
    });
  }
}

// ---------------------------------------------------------------------------
// State label mapping (consistent with temporal.ts MarketState)
// ---------------------------------------------------------------------------

function stateLabel(state: MarketState): string {
  switch (state) {
    case "bullish-acceleration":
      return "Bullish Acceleration";
    case "bullish-persistence":
      return "Bullish Persistence";
    case "bullish-decay":
      return "Bullish Decay";
    case "bearish-acceleration":
      return "Bearish Acceleration";
    case "bearish-persistence":
      return "Bearish Persistence";
    case "bearish-decay":
      return "Bearish Decay";
    case "reversal-warning":
      return "Reversal Warning";
    case "cross-horizon-conflict":
      return "Cross-Horizon Conflict";
    case "neutral":
      return "Neutral";
    case "single-horizon":
      return "Single Horizon";
    case "insufficient-data":
      return "Insufficient Data";
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const activityTracker = new ActivityTracker();
