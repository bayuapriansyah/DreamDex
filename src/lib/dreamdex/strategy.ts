import type { TemporalTrajectory, MarketState, TemporalMetrics, HorizonProbability } from "./temporal";
import { sortByHorizon, BULLISH_THRESHOLD, BEARISH_THRESHOLD } from "./normalization";
import { pctStr } from "./formatting";

// ─────────────────────────────────────────────
// Strategy Types
// ─────────────────────────────────────────────

export type StrategyType = "conservative" | "balanced" | "aggressive";

// ─────────────────────────────────────────────
// Execution Cost Configuration
// ─────────────────────────────────────────────

/**
 * Execution cost configuration for expected edge computation.
 *
 * NOTE: DreamDEX SDK exposes getMarketFees(marketId) returning per-market
 * makerFeeBps/takerFeeBps/settlementFeeBps. These are currently NOT queried
 * by the project. feeRate defaults to 0 until live integration confirms
 * actual fee values. Do NOT hardcode assumed protocol fees.
 */
export interface ExecutionCostConfig {
  /** Taker fee rate (decimal, e.g. 0.001 = 10bps). Default 0 = unverified. */
  feeRate: number;
  /** Half of bid-ask spread (decimal). Computed from live orderbook. */
  halfSpread: number;
  /** Expected slippage for order (decimal). */
  expectedSlippage: number;
}

export const DEFAULT_EXECUTION_COSTS: ExecutionCostConfig = {
  feeRate: 0,
  halfSpread: 0,
  expectedSlippage: 0,
};

// ─────────────────────────────────────────────
// Strategy Risk Policy Configuration
// ─────────────────────────────────────────────

export interface StrategyConfig {
  riskTolerance: number;
  sizeMultiplier: number;
  profitTarget: number;
  stopDistance: number;
  /** Hard gate: block entry if conflictSeverity exceeds this. */
  hardConflictGate: number;
  /** Hard gate: block entry if reversalScore exceeds this. */
  hardReversalGate: number;
  /** Minimum expected edge (probability points) to allow entry. */
  minEdge: number;
  /** How much uncertainty reduces position size (0-1). */
  uncertaintyPenaltyScale: number;
}

const STRATEGY_CONFIGS: Record<StrategyType, StrategyConfig> = {
  conservative: {
    riskTolerance: 0.3,
    sizeMultiplier: 0.5,
    profitTarget: 0.05,
    stopDistance: 0.1,
    hardConflictGate: 0.5,
    hardReversalGate: 0.3,
    minEdge: 0.05,
    uncertaintyPenaltyScale: 0.7,
  },
  balanced: {
    riskTolerance: 0.5,
    sizeMultiplier: 1,
    profitTarget: 0.1,
    stopDistance: 0.15,
    hardConflictGate: 0.8,
    hardReversalGate: 0.6,
    minEdge: 0.02,
    uncertaintyPenaltyScale: 0.5,
  },
  aggressive: {
    riskTolerance: 0.8,
    sizeMultiplier: 2,
    profitTarget: 0.2,
    stopDistance: 0.2,
    hardConflictGate: 1.0,
    hardReversalGate: 0.9,
    minEdge: 0.02,
    uncertaintyPenaltyScale: 0.3,
  },
};

/** Maximum position size cap (risk budget). */
const MAX_POSITION_SIZE = 10;

// ─────────────────────────────────────────────
// Strategy Interface (backward-compatible)
// ─────────────────────────────────────────────

export interface Strategy {
  type: StrategyType;
  label: string;
  description: string;
  side: "buy" | "sell" | "hold";
  reasoning: string;
  suggestedHorizon: number;
  suggestedSize: number;
  maxEntryPrice: number;
  takeProfit: number;
  stopLoss: number;
  confidence: "high" | "medium" | "low";

  // ── New fields ──

  /** Whether this trade passes all risk gates and is executable. */
  isExecutable: boolean;
  /** Expected edge after costs (probability points). Directional. */
  expectedEdge: number;
  /** Gross edge before costs. */
  grossEdge: number;
  /** Total execution costs deducted. */
  totalCosts: number;
  /** Numeric confidence score (0-1). */
  confidenceScore: number;
  /** Conflict severity (0-1, heuristic — NOT a probability). */
  conflictSeverity: number;
  /** Reversal score (0-1, heuristic — NOT a probability). */
  reversalScore: number;
  /** Block reason if not executable. */
  blockReason: string | null;
}

// ─────────────────────────────────────────────
// Heuristic Score Computations
// ─────────────────────────────────────────────

/**
 * Compute conflict severity as a heuristic score 0-1.
 * NOT a probability of event occurrence.
 *
 * 0 = no conflict (horizons agree)
 * 1 = maximum disagreement between horizons
 */
export function computeConflictSeverity(metrics: TemporalMetrics): number {
  return Math.min(metrics.crossHorizonDivergence * 5, 1.0);
}

/**
 * Compute reversal score as a heuristic score 0-1.
 * NOT a probability of reversal occurring.
 *
 * 0 = no reversal signal
 * 1 = strong reversal signal
 */
export function computeReversalScore(
  metrics: TemporalMetrics,
  horizons: HorizonProbability[]
): number {
  let score = 0;

  // Reversal pattern detected across horizons
  if (horizons.length >= 3) {
    const sorted = sortByHorizon(horizons);
    const probs = sorted.map((h) => h.midProbability as number);
    const shortToMid = probs[1] - probs[0];
    const midToLong = probs[probs.length - 1] - probs[1];
    if (shortToMid * midToLong < 0 && Math.abs(metrics.velocityPerHour) > 0.01) {
      score += 0.4;
    }
  }

  // Velocity contribution
  score += Math.min(Math.abs(metrics.velocityPerHour) * 3, 0.3);

  // Cross-horizon divergence contribution
  score += metrics.crossHorizonDivergence * 0.3;

  return Math.min(score, 1.0);
}

// ─────────────────────────────────────────────
// Directional Expected Edge
// ─────────────────────────────────────────────

/**
 * Compute directional expected edge for a trade.
 *
 * BUY:  grossEdge = fairProbability - entryPrice
 *       (positive when fair value > entry price)
 * SELL: grossEdge = entryPrice - fairProbability
 *       (positive when entry price > fair value)
 *
 * expectedEdge = grossEdge - feeRate - halfSpread - expectedSlippage
 *
 * @param side - "buy" or "sell"
 * @param fairProbability - fair value estimate (0-1)
 * @param entryPrice - proposed entry price (0-1)
 * @param costs - execution cost configuration
 * @returns expected edge in probability points (positive = profitable after costs)
 */
export function computeExpectedEdge(
  side: "buy" | "sell",
  fairProbability: number,
  entryPrice: number,
  costs: ExecutionCostConfig
): number {
  const grossEdge =
    side === "buy"
      ? fairProbability - entryPrice
      : entryPrice - fairProbability;

  const totalCosts = costs.feeRate + costs.halfSpread + costs.expectedSlippage;

  return grossEdge - totalCosts;
}

// ─────────────────────────────────────────────
// Dynamic TP/SL
// ─────────────────────────────────────────────

/**
 * Compute volatility estimate from horizon metrics.
 * Returns a value in the same unit as probability (0-1 scale),
 * representing typical probability movement magnitude.
 */
function estimateVolatility(metrics: TemporalMetrics): number {
  // Use velocity and momentum as volatility proxies
  // velocity is per-minute, momentum is avg diff between halves
  const velocityComponent = Math.abs(metrics.velocityPerHour) * 0.5;
  const momentumComponent = Math.abs(metrics.momentum) * 0.3;
  const decayComponent = Math.abs(metrics.convictionDecay) * 0.2;
  return Math.min(velocityComponent + momentumComponent + decayComponent, 0.3);
}

/**
 * Compute dynamic take-profit and stop-loss levels.
 *
 * Adjusts base strategy targets by:
 * - realized volatility (from metrics)
 * - horizon duration
 * - market regime (state)
 */
function computeDynamicLevels(
  side: "buy" | "sell",
  entryPrice: number,
  config: StrategyConfig,
  metrics: TemporalMetrics,
  state: MarketState,
  horizonMinutes: number
): { takeProfit: number; stopLoss: number } {
  let baseTP = config.profitTarget;
  let baseSL = config.stopDistance;

  // Volatility adjustment: widen levels in high-vol environments
  const volatility = estimateVolatility(metrics);
  const volFactor = 1 + volatility;
  baseTP *= volFactor;
  baseSL *= volFactor;

  // Horizon adjustment: longer horizon → slightly wider targets
  const horizonFactor = Math.min(horizonMinutes / 60, 2);
  baseTP *= 0.8 + horizonFactor * 0.2;
  baseSL *= 0.8 + horizonFactor * 0.2;

  // Regime adjustment
  if (state.includes("acceleration")) {
    baseSL *= 0.8;
  } else if (state.includes("decay")) {
    baseTP *= 1.1;
    baseSL *= 0.9;
  } else if (state === "cross-horizon-conflict") {
    baseSL *= 1.2;
  } else if (state === "reversal-warning") {
    baseTP *= 0.8;
    baseSL *= 1.3;
  }

  if (side === "buy") {
    return {
      takeProfit: Math.min(entryPrice + baseTP, 0.99),
      stopLoss: Math.max(entryPrice - baseSL, 0.01),
    };
  } else {
    return {
      takeProfit: Math.max(entryPrice - baseTP, 0.01),
      stopLoss: Math.min(entryPrice + baseSL, 0.99),
    };
  }
}

// ─────────────────────────────────────────────
// Risk-Based Position Sizing
// ─────────────────────────────────────────────

/**
 * Compute position size using risk-based formula.
 *
 * size = baseRisk × policyMultiplier × edgeFactor × confidence × liquidity × uncertaintyPenalty
 *
 * Hard-capped at MAX_POSITION_SIZE.
 * May return 0 if edge or confidence is insufficient.
 */
function computePositionSize(
  config: StrategyConfig,
  expectedEdge: number,
  confidence: number,
  liquidity: number,
  conflictSeverity: number,
  reversalScore: number
): number {
  const baseRisk = 1;

  // Edge factor: scales with edge strength, capped at 2x
  const edgeFactor = config.minEdge > 0
    ? Math.min(Math.max(expectedEdge, 0) / config.minEdge, 2.0)
    : 0;

  // Uncertainty penalty: reduces size based on conflict and reversal
  const uncertaintyPenalty = Math.max(
    1 -
      conflictSeverity * config.uncertaintyPenaltyScale * 0.5 -
      reversalScore * config.uncertaintyPenaltyScale * 0.5,
    0
  );

  const rawSize =
    baseRisk *
    config.sizeMultiplier *
    edgeFactor *
    confidence *
    (0.3 + liquidity * 0.7) *
    uncertaintyPenalty;

  // Hard cap — may return 0 if insufficient edge/confidence
  return Math.max(0, Math.min(rawSize, MAX_POSITION_SIZE));
}

// ─────────────────────────────────────────────
// Confidence Computation
// ─────────────────────────────────────────────

/**
 * Compute strategy confidence including uncertainty/conflict penalties.
 */
function computeStrategyConfidence(
  dataQuality: number,
  trajectoryScore: number,
  conflictSeverity: number,
  reversalScore: number,
  type: StrategyType
): { level: "high" | "medium" | "low"; score: number } {
  const score =
    dataQuality * 0.3 +
    trajectoryScore * 0.4 -
    conflictSeverity * 0.2 -
    reversalScore * 0.1;

  const threshold =
    type === "conservative" ? 0.3 : type === "balanced" ? 0.2 : 0.1;

  let level: "high" | "medium" | "low";
  if (score > 0.7 - threshold) level = "high";
  else if (score > 0.4 - threshold) level = "medium";
  else level = "low";

  return { level, score: Math.max(0, Math.min(score, 1)) };
}

// ─────────────────────────────────────────────
// Fair Probability
// ─────────────────────────────────────────────

/**
 * Compute fair probability for a given horizon.
 *
 * Uses trajectory-adjusted fair value: current mid + expected move.
 * This represents where probability is expected to be based on trajectory,
 * not just the current market price.
 *
 * Priority:
 * 1. midProbability from orderbook + trajectory bias
 * 2. yesProbability + trajectory bias (fallback)
 * 3. 0.5 (last resort)
 *
 * In the future, calibratedProbability may be inserted between
 * modelProbability and fairProbability.
 */
function computeFairProbability(
  horizon: HorizonProbability,
  metrics: TemporalMetrics
): number {
  const mid = horizon.midProbability ?? horizon.yesProbability ?? 0.5;
  // Trajectory-adjusted: where probability is expected to be at this horizon
  const expectedMove = metrics.velocityPerHour * (horizon.horizonMinutes / 60);
  return Math.max(0, Math.min(1, mid + expectedMove));
}

// ─────────────────────────────────────────────
// Compose Strategy
// ─────────────────────────────────────────────

export function composeStrategies(
  trajectory: TemporalTrajectory,
  costs: ExecutionCostConfig = DEFAULT_EXECUTION_COSTS
): Strategy[] {
  return [
    composeStrategy("conservative", trajectory, costs),
    composeStrategy("balanced", trajectory, costs),
    composeStrategy("aggressive", trajectory, costs),
  ];
}

function composeStrategy(
  type: StrategyType,
  trajectory: TemporalTrajectory,
  costs: ExecutionCostConfig
): Strategy {
  const config = STRATEGY_CONFIGS[type];
  const { metrics, state, horizons, confidence: trajConfidence } = trajectory;
  const sorted = sortByHorizon(horizons);
  const validHorizons = sorted.filter((h) => h.midProbability !== null);

  // ── Data Gates ──
  if (state === "insufficient-data" || state === "single-horizon") {
    return buildHoldStrategy(type, config, metrics, trajConfidence, state,
      state === "insufficient-data"
        ? "Insufficient data — no trade recommended."
        : "Single horizon — multi-horizon trajectory unavailable."
    );
  }

  // ── Compute heuristic scores ──
  const conflictSeverity = computeConflictSeverity(metrics);
  const reversalScore = computeReversalScore(metrics, horizons);

  // ── Determine side from state/metrics ──
  const avgProb =
    validHorizons.length > 0
      ? validHorizons.reduce((a, h) => a + (h.midProbability as number), 0) /
        validHorizons.length
      : 0.5;

  const sideResult = determineSide(state, metrics, avgProb, config, conflictSeverity, reversalScore);

  // If side is hold, return hold strategy
  if (sideResult.side === "hold") {
    return buildHoldStrategy(type, config, metrics, trajConfidence, state,
      sideResult.reasoning, conflictSeverity, reversalScore
    );
  }

  // ── Determine horizon and entry price ──
  const suggestedHorizon = determineHorizon(type, sorted, state);
  const targetHorizon = sorted.find((h) => h.horizonMinutes === suggestedHorizon) || sorted[0];
  const fairProb = targetHorizon ? computeFairProbability(targetHorizon, metrics) : 0.5;
  const entryPrice = determineEntryPrice(sideResult.side, config, sorted, suggestedHorizon);

  if (entryPrice <= 0) {
    return buildHoldStrategy(type, config, metrics, trajConfidence, state,
      "No valid entry price available.", conflictSeverity, reversalScore
    );
  }

  // ── Compute directional expected edge ──
  const expectedEdge = computeExpectedEdge(sideResult.side, fairProb, entryPrice, costs);
  const grossEdge =
    sideResult.side === "buy" ? fairProb - entryPrice : entryPrice - fairProb;
  const totalCosts = costs.feeRate + costs.halfSpread + costs.expectedSlippage;

  // ── Strategy-specific hard gates ──
  let blockReason: string | null = null;

  if (conflictSeverity > config.hardConflictGate) {
    blockReason = `Conflict severity ${conflictSeverity.toFixed(2)} exceeds threshold ${config.hardConflictGate}.`;
  } else if (reversalScore > config.hardReversalGate) {
    blockReason = `Reversal score ${reversalScore.toFixed(2)} exceeds threshold ${config.hardReversalGate}.`;
  } else if (expectedEdge < config.minEdge) {
    blockReason = `Expected edge ${(expectedEdge * 100).toFixed(1)}pp below minimum ${(config.minEdge * 100).toFixed(1)}pp.`;
  }

  if (blockReason) {
    return buildHoldStrategy(type, config, metrics, trajConfidence, state,
      blockReason, conflictSeverity, reversalScore, grossEdge, expectedEdge, totalCosts
    );
  }

  // ── Dynamic TP/SL ──
  const { takeProfit, stopLoss } = computeDynamicLevels(
    sideResult.side, entryPrice, config, metrics, state, suggestedHorizon
  );

  // ── Risk-based position sizing ──
  const confidenceResult = computeStrategyConfidence(
    metrics.dataQuality, trajConfidence, conflictSeverity, reversalScore, type
  );

  const positionSize = computePositionSize(
    config, expectedEdge, confidenceResult.score, metrics.liquidity,
    conflictSeverity, reversalScore
  );

  // If size too small to execute, treat as hold
  if (positionSize <= 0) {
    return buildHoldStrategy(type, config, metrics, trajConfidence, state,
      "Position size too small — insufficient edge/confidence for execution.",
      conflictSeverity, reversalScore, grossEdge, expectedEdge, totalCosts
    );
  }

  // ── Build final reasoning ──
  const strength = metrics.persistence > 0.7 ? "strong" : "moderate";
  const reasoning = [
    `${strength} ${sideResult.side === "buy" ? "bullish" : "bearish"} signal.`,
    sideResult.reasoning,
    `Expected edge: ${(expectedEdge * 100).toFixed(1)}pp after costs.`,
    `Conflict severity: ${conflictSeverity.toFixed(2)}, Reversal score: ${reversalScore.toFixed(2)}.`,
  ].join(" ");

  return {
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    description: getDescription(type),
    side: sideResult.side,
    reasoning,
    suggestedHorizon,
    suggestedSize: Math.round(positionSize * 100) / 100,
    maxEntryPrice: entryPrice,
    takeProfit,
    stopLoss,
    confidence: confidenceResult.level,

    isExecutable: true,
    expectedEdge,
    grossEdge,
    totalCosts,
    confidenceScore: confidenceResult.score,
    conflictSeverity,
    reversalScore,
    blockReason: null,
  };
}

function buildHoldStrategy(
  type: StrategyType,
  config: StrategyConfig,
  metrics: TemporalMetrics,
  trajConfidence: number,
  state: MarketState,
  reasoning: string,
  conflictSeverity?: number,
  reversalScore?: number,
  grossEdge?: number,
  expectedEdge?: number,
  totalCosts?: number
): Strategy {
  const cs = conflictSeverity ?? computeConflictSeverity(metrics);
  const rs = reversalScore ?? computeReversalScore(metrics, []);
  const confidenceResult = computeStrategyConfidence(
    metrics.dataQuality, trajConfidence, cs, rs, type
  );

  return {
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    description: getDescription(type),
    side: "hold",
    reasoning,
    suggestedHorizon: 0,
    suggestedSize: 0,
    maxEntryPrice: 0,
    takeProfit: 0,
    stopLoss: 0,
    confidence: confidenceResult.level,

    isExecutable: false,
    expectedEdge: expectedEdge ?? 0,
    grossEdge: grossEdge ?? 0,
    totalCosts: totalCosts ?? 0,
    confidenceScore: confidenceResult.score,
    conflictSeverity: cs,
    reversalScore: rs,
    blockReason: state === "insufficient-data" || state === "single-horizon"
      ? reasoning
      : reasoning,
  };
}

// ─────────────────────────────────────────────
// Side Determination
// ─────────────────────────────────────────────

function determineSide(
  state: MarketState,
  metrics: TemporalMetrics,
  avgProb: number,
  config: StrategyConfig,
  conflictSeverity: number,
  reversalScore: number
): { side: "buy" | "sell" | "hold"; reasoning: string } {
  const isBullish =
    state.includes("bullish") ||
    (avgProb > BULLISH_THRESHOLD && metrics.directionStrength > 0.2);
  const isBearish =
    state.includes("bearish") ||
    (avgProb < BEARISH_THRESHOLD && metrics.directionStrength > 0.2);

  // ── Cross-horizon conflict ──
  if (state === "cross-horizon-conflict") {
    if (conflictSeverity > config.hardConflictGate) {
      return {
        side: "hold",
        reasoning: `Cross-horizon conflict severity ${conflictSeverity.toFixed(2)} exceeds threshold.`,
      };
    }
    return {
      side: avgProb > 0.5 ? "buy" : "sell",
      reasoning: `Conflict detected (severity ${conflictSeverity.toFixed(2)}) but within risk tolerance. Lean ${avgProb > 0.5 ? "long" : "short"} based on average probability.`,
    };
  }

  // ── Reversal warning ──
  if (state === "reversal-warning") {
    if (reversalScore > config.hardReversalGate) {
      return {
        side: "hold",
        reasoning: `Reversal score ${reversalScore.toFixed(2)} exceeds threshold. Wait for direction to stabilize.`,
      };
    }
    if (config.riskTolerance > 0.6) {
      return {
        side: avgProb > 0.5 ? "sell" : "buy",
        reasoning: `Reversal warning — aggressive strategy fades the reversal.`,
      };
    }
    return {
      side: "hold",
      reasoning: "Reversal warning — wait for direction to stabilize.",
    };
  }

  // ── Bullish states ──
  if (isBullish) {
    if (state === "bullish-decay" && config.riskTolerance < 0.5) {
      return {
        side: "hold",
        reasoning: "Bullish but conviction decays — conservative approach waits for stronger signal.",
      };
    }
    const strength = metrics.persistence > 0.7 ? "strong" : "moderate";
    return {
      side: "buy",
      reasoning: `${strength} bullish. Velocity ${pctStr(metrics.velocityPerHour, 2)}%/hr, persistence ${pctStr(metrics.persistence, 0)}%.`,
    };
  }

  // ── Bearish states ──
  if (isBearish) {
    if (state === "bearish-decay" && config.riskTolerance < 0.5) {
      return {
        side: "hold",
        reasoning: "Bearish but conviction decays — conservative approach waits for confirmation.",
      };
    }
    const strength = metrics.persistence > 0.7 ? "strong" : "moderate";
    return {
      side: "sell",
      reasoning: `${strength} bearish. Velocity ${pctStr(metrics.velocityPerHour, 2)}%/hr, persistence ${pctStr(metrics.persistence, 0)}%.`,
    };
  }

  // ── Neutral ──
  return {
    side: "hold",
    reasoning: "No clear directional bias. Hold and wait for stronger signal.",
  };
}

// ─────────────────────────────────────────────
// Horizon Selection
// ─────────────────────────────────────────────

function determineHorizon(
  type: StrategyType,
  sorted: { horizonMinutes: number; dataQuality: string }[],
  state: MarketState
): number {
  if (sorted.length === 0) return 60;

  const validHorizons = sorted.filter(
    (h) => h.dataQuality !== "none" && h.dataQuality !== "low"
  );
  if (validHorizons.length === 0) return sorted[0].horizonMinutes;

  switch (type) {
    case "conservative":
      return validHorizons[Math.min(1, validHorizons.length - 1)].horizonMinutes;
    case "balanced":
      return validHorizons[Math.floor(validHorizons.length / 2)].horizonMinutes;
    case "aggressive":
      if (state.includes("acceleration")) {
        return validHorizons[0].horizonMinutes;
      }
      return validHorizons[Math.floor(validHorizons.length / 2)].horizonMinutes;
  }
}

// ─────────────────────────────────────────────
// Entry Price
// ─────────────────────────────────────────────

function determineEntryPrice(
  side: "buy" | "sell",
  config: StrategyConfig,
  sorted: {
    horizonMinutes: number;
    midProbability: number | null;
    askProbability: number | null;
    bidProbability: number | null;
  }[],
  suggestedHorizon: number
): number {
  const target =
    sorted.find((h) => h.horizonMinutes === suggestedHorizon) || sorted[0];

  if (!target) return 0.5;

  const slippage = config.riskTolerance * 0.03;

  if (side === "buy") {
    const maxAsk = target.askProbability ?? target.midProbability ?? 0.5;
    return Math.min(maxAsk + slippage, 0.99);
  } else {
    const maxBid = target.bidProbability ?? target.midProbability ?? 0.5;
    return Math.max(maxBid - slippage, 0.01);
  }
}

// ─────────────────────────────────────────────
// Description
// ─────────────────────────────────────────────

function getDescription(type: StrategyType): string {
  switch (type) {
    case "conservative":
      return "Smaller size, tighter stops. Prioritizes capital preservation. Best for uncertain or volatile markets.";
    case "balanced":
      return "Standard size with moderate risk/reward. Balanced approach suitable for most market conditions.";
    case "aggressive":
      return "Larger size, wider targets. Higher risk/reward. Best for strong conviction signals.";
  }
}
