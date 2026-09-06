// Position domain model — Event Contract positions, entry theses, and comparison
// All types use existing canonical types from types.ts
import type { Probability, HorizonMinutes } from "./types";

/* ═══════════════════════════════════════════════════════ */
/* Position                                               */
/* ═══════════════════════════════════════════════════════ */

export type PositionStatus =
  | "pending"        // Order placed, not yet filled
  | "open"           // Fully filled, position active
  | "partial"        // Partially filled
  | "locked"         // Market locked (pending resolution)
  | "resolved"       // Market resolved
  | "voided"         // Market voided
  | "redeemable"     // Settlement complete, tokens redeemable
  | "redeemed";      // Tokens redeemed

export interface Position {
  /** Unique position identifier */
  id: string;
  /** Connected wallet address */
  wallet: string;
  /** Market ID (hex) */
  marketId: string;
  /** Market address (pool) */
  marketAddress: string;
  /** Underlying asset (BTC, ETH, etc.) */
  asset: string;
  /** Contract duration (15m, 1h, etc.) */
  horizon: HorizonMinutes;
  /** Human-readable interval label */
  intervalLabel: string;
  /** Direction: "up" = BUY_YES, "down" = BUY_NO */
  direction: "up" | "down";
  /** Outcome index: 0 = YES, 1 = NO */
  outcomeIndex: number;
  /** Quantity in human units */
  quantity: number;
  /** Entry price (probability) */
  entryPrice: Probability;
  /** Entry timestamp (ISO) */
  entryTimestamp: string;
  /** Entry order ID */
  orderId: string;
  /** Entry transaction hash */
  transactionHash: string;
  /** Position status */
  status: PositionStatus;
  /** Current market status from SDK */
  marketStatus: string;
  /** Collateral decimals */
  quoteDecimals: number;
  /** Market expiry (ISO) */
  expiry: string;
  /** Last known price */
  lastPrice: Probability | null;
  /** Winning outcome (0 = YES, 1 = NO) null if unresolved */
  winningOutcome: number | null;
  /** Whether market is voided */
  voided: boolean;
}

/* ═══════════════════════════════════════════════════════ */
/* Entry Thesis                                           */
/* ═══════════════════════════════════════════════════════ */

export interface EntryThesis {
  /** Position ID this thesis belongs to */
  positionId: string;
  /** Market ID */
  marketId: string;
  /** Underlying asset */
  asset: string;
  /** Contract horizon */
  horizon: HorizonMinutes;
  /** Direction */
  direction: "up" | "down";
  /** Entry probability */
  entryProbability: Probability;
  /** Entry timestamp */
  entryTimestamp: string;
  /** Market regime at entry */
  regime: string;
  /** Signal strength at entry (0..1) */
  signalStrength: number;
  /** Signal confidence at entry (0..1) */
  signalConfidence: number;
  /** Reversal risk at entry (0..1) */
  reversalRisk: number;
  /** Cross-horizon divergence at entry (0..1) */
  divergence: number;
  /** Persistence at entry (0..1) */
  persistence: number;
  /** Velocity at entry (prob change per hour) */
  velocity: number;
  /** Data quality at entry (0..1) */
  dataQuality: number;
  /** Full analysis snapshot at entry */
  analysisSnapshot: string;
  /** Trajectory state label at entry */
  trajectoryState: string;
  /** Trajectory score at entry (0..1) */
  trajectoryScore: number;
}

/* ═══════════════════════════════════════════════════════ */
/* Current Thesis                                         */
/* ═══════════════════════════════════════════════════════ */

export interface CurrentThesis {
  /** Current probability */
  currentProbability: Probability | null;
  /** Current regime */
  regime: string;
  /** Current signal strength */
  signalStrength: number;
  /** Current signal confidence */
  signalConfidence: number;
  /** Current reversal risk */
  reversalRisk: number;
  /** Current divergence */
  divergence: number;
  /** Current persistence */
  persistence: number;
  /** Current velocity */
  velocity: number;
  /** Current data quality */
  dataQuality: number;
  /** Current trajectory state */
  trajectoryState: string;
  /** Current trajectory score */
  trajectoryScore: number;
  /** Timestamp of this analysis */
  timestamp: string;
  /** Whether data is stale (>5 minutes old) */
  stale: boolean;
}

/* ═══════════════════════════════════════════════════════ */
/* Thesis Comparison                                      */
/* ═══════════════════════════════════════════════════════ */

export type ThesisStatus =
  | "strengthening"   // Signal quality improved, direction aligned
  | "weakening"       // Confidence decreased or regime deteriorated
  | "invalidated"     // Core directional thesis no longer supported
  | "resolved"        // Market resolved
  | "unchanged"       // No significant change
  | "stale";          // Current data unavailable

export interface ThesisComparison {
  /** Position ID */
  positionId: string;
  /** Entry thesis */
  entry: EntryThesis;
  /** Current thesis */
  current: CurrentThesis;
  /** Probability delta (current - entry) */
  probabilityDelta: number;
  /** Confidence delta */
  confidenceDelta: number;
  /** Reversal risk delta */
  reversalRiskDelta: number;
  /** Regime change description */
  regimeChange: string;
  /** Signal strength delta */
  signalStrengthDelta: number;
  /** Divergence delta */
  divergenceDelta: number;
  /** Velocity delta */
  velocityDelta: number;
  /** Thesis status */
  status: ThesisStatus;
  /** Human-readable status summary */
  statusSummary: string;
  /** Timestamp of comparison */
  timestamp: string;
}

/* ═══════════════════════════════════════════════════════ */
/* Thesis Status Rules                                    */
/* ═══════════════════════════════════════════════════════ */

/** Thresholds for thesis status determination */
const THESIS_THRESHOLDS = {
  /** Probability change considered significant (pp) */
  probabilitySignificant: 5,
  /** Confidence drop considered weakening */
  confidenceDropThreshold: 0.15,
  /** Reversal risk increase considered weakening */
  reversalRiskIncreaseThreshold: 0.2,
  /** Divergence increase considered weakening */
  divergenceIncreaseThreshold: 0.15,
  /** Velocity sign change = potential invalidation */
  velocitySignChange: true,
  /** Minimum confidence for thesis to be valid */
  minConfidence: 0.2,
} as const;

/**
 * Determine thesis status from entry vs current.
 * Deterministic — no AI involved.
 */
export function determineThesisStatus(
  entry: EntryThesis,
  current: CurrentThesis,
  marketStatus: string
): { status: ThesisStatus; summary: string } {
  // 1. Market resolved
  if (marketStatus === "Resolved" || marketStatus === "Finalized") {
    return {
      status: "resolved",
      summary: `Market resolved. Outcome: ${entry.direction.toUpperCase()}.`,
    };
  }

  // 2. Market voided
  if (marketStatus === "Voided") {
    return {
      status: "invalidated",
      summary: "Market voided. Position is redeemable at par.",
    };
  }

  // 3. Stale data
  if (current.stale) {
    return {
      status: "stale",
      summary: "Current analysis data is stale. Thesis status uncertain.",
    };
  }

  // 4. Core directional thesis invalidation checks
  const directionAligned = isDirectionAligned(entry.direction, entry.regime, current.regime);
  const probabilityDelta = current.currentProbability !== null && entry.entryProbability !== null
    ? current.currentProbability - entry.entryProbability
    : 0;

  // Direction completely reversed
  if (entry.direction === "up" && probabilityDelta < -THESIS_THRESHOLDS.probabilitySignificant / 100) {
    if (current.regime.includes("bearish")) {
      return {
        status: "invalidated",
        summary: `Direction reversed. Entry was ${entry.direction.toUpperCase()} but regime is now ${current.regime}. Probability dropped ${(probabilityDelta * 100).toFixed(1)}pp.`,
      };
    }
  }
  if (entry.direction === "down" && probabilityDelta > THESIS_THRESHOLDS.probabilitySignificant / 100) {
    if (current.regime.includes("bullish")) {
      return {
        status: "invalidated",
        summary: `Direction reversed. Entry was ${entry.direction.toUpperCase()} but regime is now ${current.regime}. Probability rose ${(probabilityDelta * 100).toFixed(1)}pp.`,
      };
    }
  }

  // 5. Weakening checks
  const confidenceDelta = current.signalConfidence - entry.signalConfidence;
  const reversalRiskDelta = current.reversalRisk - entry.reversalRisk;
  const divergenceDelta = current.divergence - entry.divergence;

  const isWeakening =
    confidenceDelta < -THESIS_THRESHOLDS.confidenceDropThreshold ||
    reversalRiskDelta > THESIS_THRESHOLDS.reversalRiskIncreaseThreshold ||
    divergenceDelta > THESIS_THRESHOLDS.divergenceIncreaseThreshold ||
    (current.signalConfidence < THESIS_THRESHOLDS.minConfidence);

  if (isWeakening) {
    const reasons: string[] = [];
    if (confidenceDelta < -THESIS_THRESHOLDS.confidenceDropThreshold) {
      reasons.push(`confidence ${confidenceDelta > 0 ? "+" : ""}${(confidenceDelta * 100).toFixed(0)}%`);
    }
    if (reversalRiskDelta > THESIS_THRESHOLDS.reversalRiskIncreaseThreshold) {
      reasons.push(`reversal risk +${(reversalRiskDelta * 100).toFixed(0)}%`);
    }
    if (divergenceDelta > THESIS_THRESHOLDS.divergenceIncreaseThreshold) {
      reasons.push(`divergence +${(divergenceDelta * 100).toFixed(0)}%`);
    }
    if (current.signalConfidence < THESIS_THRESHOLDS.minConfidence) {
      reasons.push(`low confidence ${current.signalConfidence.toFixed(0)}`);
    }
    return {
      status: "weakening",
      summary: `Thesis weakening: ${reasons.join(", ")}.`,
    };
  }

  // 6. Strengthening checks
  const isStrengthening =
    directionAligned &&
    confidenceDelta > 0.05 &&
    current.signalConfidence > entry.signalConfidence;

  if (isStrengthening) {
    return {
      status: "strengthening",
      summary: `Thesis strengthening. Confidence +${(confidenceDelta * 100).toFixed(0)}%, regime: ${current.regime}.`,
    };
  }

  // 7. Default: unchanged
  return {
    status: "unchanged",
    summary: `Thesis status stable. Probability: ${((current.currentProbability ?? 0) * 100).toFixed(1)}% (entry ${(entry.entryProbability * 100).toFixed(1)}%).`,
  };
}

/**
 * Check if the current regime aligns with the entry direction.
 */
function isDirectionAligned(direction: "up" | "down", entryRegime: string, currentRegime: string): boolean {
  if (direction === "up") {
    return currentRegime.includes("bullish");
  }
  return currentRegime.includes("bearish");
}

/* ═══════════════════════════════════════════════════════ */
/* Comparison Engine                                      */
/* ═══════════════════════════════════════════════════════ */

/**
 * Compare entry thesis against current analysis.
 */
export function compareThesis(
  entry: EntryThesis,
  current: CurrentThesis,
  marketStatus: string
): ThesisComparison {
  const probabilityDelta = (current.currentProbability ?? 0) - entry.entryProbability;
  const confidenceDelta = current.signalConfidence - entry.signalConfidence;
  const reversalRiskDelta = current.reversalRisk - entry.reversalRisk;
  const signalStrengthDelta = current.signalStrength - entry.signalStrength;
  const divergenceDelta = current.divergence - entry.divergence;
  const velocityDelta = current.velocity - entry.velocity;

  const regimeChange = entry.regime === current.regime
    ? "No change"
    : `${entry.regime} → ${current.regime}`;

  const { status, summary } = determineThesisStatus(entry, current, marketStatus);

  return {
    positionId: entry.positionId,
    entry,
    current,
    probabilityDelta,
    confidenceDelta,
    reversalRiskDelta,
    regimeChange,
    signalStrengthDelta,
    divergenceDelta,
    velocityDelta,
    status,
    statusSummary: summary,
    timestamp: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════ */
/* Position Status Mapping                                */
/* ═══════════════════════════════════════════════════════ */

/**
 * Map SDK market status + order state to PositionStatus.
 */
export function mapPositionStatus(
  marketStatus: string,
  hasFill: boolean,
  fillQuantity: number,
  requestedQuantity: number,
  winningOutcome: number | null,
  outcomeIndex: number,
  voided: boolean
): PositionStatus {
  // Market voided
  if (voided || marketStatus === "Voided") return "voided";

  // Market resolved
  if (marketStatus === "Resolved" || marketStatus === "Finalized") {
    // Check if this position won
    if (winningOutcome !== null && winningOutcome === outcomeIndex) {
      return "redeemable";
    }
    return "resolved";
  }

  // Market locked
  if (marketStatus === "Locked" || marketStatus === "Settling") return "locked";

  // No fill at all
  if (!hasFill || fillQuantity <= 0) return "pending";

  // Partial fill
  if (fillQuantity < requestedQuantity * 0.99) return "partial";

  // Fully filled, market still trading
  return "open";
}

/* ═══════════════════════════════════════════════════════ */
/* Create Position from Fill                              */
/* ═══════════════════════════════════════════════════════ */

export interface FillData {
  marketId: string;
  marketAddress: string;
  poolAddress: string;
  asset: string;
  horizon: HorizonMinutes;
  intervalLabel: string;
  direction: "up" | "down";
  outcomeIndex: number;
  fillQuantity: number;
  fillPrice: number;
  orderId: string;
  transactionHash: string;
  wallet: string;
  marketStatus: string;
  quoteDecimals: number;
  expiry: string;
  winningOutcome: number | null;
  voided: boolean;
}

/**
 * Create a Position from verified fill data.
 */
export function createPositionFromFill(fill: FillData): Position {
  const status = mapPositionStatus(
    fill.marketStatus,
    true,
    fill.fillQuantity,
    fill.fillQuantity, // For initial creation, requested = filled
    fill.winningOutcome,
    fill.outcomeIndex,
    fill.voided
  );

  return {
    id: `pos-${fill.transactionHash}-${fill.outcomeIndex}`,
    wallet: fill.wallet,
    marketId: fill.marketId,
    marketAddress: fill.marketAddress,
    asset: fill.asset,
    horizon: fill.horizon,
    intervalLabel: fill.intervalLabel,
    direction: fill.direction,
    outcomeIndex: fill.outcomeIndex,
    quantity: fill.fillQuantity,
    entryPrice: fill.fillPrice,
    entryTimestamp: new Date().toISOString(),
    orderId: fill.orderId,
    transactionHash: fill.transactionHash,
    status,
    marketStatus: fill.marketStatus,
    quoteDecimals: fill.quoteDecimals,
    expiry: fill.expiry,
    lastPrice: fill.fillPrice,
    winningOutcome: fill.winningOutcome,
    voided: fill.voided,
  };
}

/**
 * Create an EntryThesis from a position and its analysis snapshot.
 */
export function createEntryThesis(
  position: Position,
  analysis: {
    regime: string;
    signalStrength: number;
    signalConfidence: number;
    reversalRisk: number;
    divergence: number;
    persistence: number;
    velocity: number;
    dataQuality: number;
    trajectoryState: string;
    trajectoryScore: number;
  }
): EntryThesis {
  return {
    positionId: position.id,
    marketId: position.marketId,
    asset: position.asset,
    horizon: position.horizon,
    direction: position.direction,
    entryProbability: position.entryPrice,
    entryTimestamp: position.entryTimestamp,
    regime: analysis.regime,
    signalStrength: analysis.signalStrength,
    signalConfidence: analysis.signalConfidence,
    reversalRisk: analysis.reversalRisk,
    divergence: analysis.divergence,
    persistence: analysis.persistence,
    velocity: analysis.velocity,
    dataQuality: analysis.dataQuality,
    analysisSnapshot: JSON.stringify(analysis),
    trajectoryState: analysis.trajectoryState,
    trajectoryScore: analysis.trajectoryScore,
  };
}
