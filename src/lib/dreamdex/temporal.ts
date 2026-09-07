import { getExchange } from "./client";
import type { MarketData } from "./markets";
import { VALID_EC_MINUTES } from "./markets";
import {
  normalizeBookLevel,
  midFromBidAsk,
  sortByHorizon,
  BULLISH_THRESHOLD,
  BEARISH_THRESHOLD,
  DIVERGENCE_CONFLICT_THRESHOLD,
  VELOCITY_STRONG_THRESHOLD,
  DECAY_SIGNIFICANT_THRESHOLD,
  DATA_QUALITY_MINIMUM,
  LIQUIDITY_NORMALIZATION_BASE,
  TRAJECTORY_WEIGHTS,
} from "./normalization";
import { formatHorizon, pctStr, ppStr } from "./formatting";
import type { Probability, QuoteVolume, HorizonMinutes } from "./types";

export interface HorizonProbability {
  horizonMinutes: HorizonMinutes;
  marketId: string;
  yesProbability: Probability | null;
  bidProbability: Probability | null;
  askProbability: Probability | null;
  midProbability: Probability | null;
  spread: Probability | null;
  volume: QuoteVolume | null;
  secondsLeft: number;
  dataQuality: "high" | "medium" | "low" | "none";
  /** Per-market quote decimals used for normalization. */
  quoteDecimals: number;
  /** Market lifecycle status. */
  status: string;
}

export type MarketState =
  | "bullish-acceleration"
  | "bullish-persistence"
  | "bullish-decay"
  | "bearish-acceleration"
  | "bearish-persistence"
  | "bearish-decay"
  | "reversal-warning"
  | "cross-horizon-conflict"
  | "neutral"
  | "single-horizon"
  | "insufficient-data";

export interface TemporalTrajectory {
  asset: string;
  asOf: string;
  horizons: HorizonProbability[];
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

export interface TemporalMetrics {
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

function classifyDataQuality(
  bestBid: number | null,
  bestAsk: number | null,
  volume: number,
  secondsLeft: number
): "high" | "medium" | "low" | "none" {
  if (bestBid === null && bestAsk === null) return "none";
  if (secondsLeft < 60) return "none";

  let score = 0;
  if (bestBid !== null && bestAsk !== null) score += 2;
  else score += 1;
  if (volume > 1) score += 1;
  if (volume > 10) score += 1;

  if (score >= 3) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function qualityToNumber(q: "high" | "medium" | "low" | "none"): number {
  switch (q) {
    case "high":
      return 1.0;
    case "medium":
      return 0.7;
    case "low":
      return 0.4;
    case "none":
      return 0;
  }
}

export async function computeTemporalTrajectory(
  asset: string,
  markets: MarketData[]
): Promise<TemporalTrajectory> {
  const exchange = getExchange();
  const now = Math.floor(Date.now() / 1000);

  const assetMarkets = markets
    .filter(
      (m) =>
        m.asset === asset &&
        m.secondsLeft > 60 &&
        VALID_EC_MINUTES.includes(m.horizonMinutes)
    )
    .sort((a, b) => a.horizonMinutes - b.horizonMinutes);

  if (assetMarkets.length === 0) {
    return emptyTrajectory(asset, now);
  }

  const horizons: HorizonProbability[] = [];

  for (const m of assetMarkets) {
    try {
      // Read orderbook from chain — no watch/tailing needed
      // Use per-market quoteDecimals (NOT global COLLATERAL_DECIMALS)
      const book = await exchange.client.getBinaryOrderBook(
        m.pool as `0x${string}`,
        { depth: 5, decimals: m.quoteDecimals }
      );

      // Use shared normalizeBookLevel with per-market decimals
      const yesBids = book.yesBids.map((lvl) =>
        normalizeBookLevel(lvl, m.quoteDecimals)
      );
      const yesAsks = book.yesAsks.map((lvl) =>
        normalizeBookLevel(lvl, m.quoteDecimals)
      );

      const bestBid = yesBids[0]?.price ?? null;
      const bestAsk = yesAsks[0]?.price ?? null;
      const spread =
        bestBid !== null && bestAsk !== null && bestBid <= bestAsk
          ? (bestAsk - bestBid)
          : null;

      const midProbability = midFromBidAsk(bestBid, bestAsk);

      // NO fabrication: midProbability is null if data unavailable
      // yesProbability falls back to lastPrice only (also normalized)
      // If both are null → null, NOT 0.5
      const yesProbability =
        midProbability !== null ? midProbability : m.lastPrice;

      const dataQuality = classifyDataQuality(
        bestBid,
        bestAsk,
        (m.volume as number) ?? 0,
        m.secondsLeft
      );

      horizons.push({
        horizonMinutes: m.horizonMinutes as HorizonMinutes,
        marketId: m.marketId,
        yesProbability,
        bidProbability: bestBid,
        askProbability: bestAsk,
        midProbability,
        spread,
        volume: m.volume ?? null,
        secondsLeft: m.secondsLeft,
        dataQuality,
        quoteDecimals: m.quoteDecimals,
        status: m.status,
      });
    } catch {
      continue;
    }
  }

  if (horizons.length < 1) {
    return emptyTrajectory(asset, now);
  }

  // Filter to horizons with valid midProbability for metric computation
  const validHorizons = horizons.filter((h) => h.midProbability !== null);

  if (validHorizons.length < 1) {
    return emptyTrajectory(asset, now, horizons);
  }

  // Single horizon: return partial trajectory (honest about limited data)
  if (validHorizons.length === 1) {
    const only = validHorizons[0];
    const prob = only.midProbability as number;
    const avgVolume = ((only.volume as number) ?? 0);
    const liquidity = Math.min(avgVolume / LIQUIDITY_NORMALIZATION_BASE, 1);
    const directionStrength = Math.abs(prob - 0.5) * 2;

    return {
      asset,
      asOf: new Date().toISOString(),
      horizons,
      metrics: {
        velocity: 0,
        velocityPerHour: 0,
        persistence: 0,
        convictionDecay: 0,
        crossHorizonDivergence: 0,
        dataQuality: qualityToNumber(only.dataQuality),
        directionStrength,
        momentum: 0,
        liquidity,
      },
      state: "single-horizon",
      stateLabel: "Single Horizon",
      stateDescription: `Only ${formatHorizon(only.horizonMinutes)} data available. Multi-horizon trajectory requires at least 2 horizons.`,
      trajectoryScore: directionStrength * 0.5,
      confidence: directionStrength * 0.5 * qualityToNumber(only.dataQuality),
      reversalRisk: 0,
      whatChanged: `${formatHorizon(only.horizonMinutes)}: ${pctStr(prob, 1)}% — single data point, no trajectory to compare.`,
      why: `Only one Event Contract horizon (${formatHorizon(only.horizonMinutes)}) is currently available for ${asset}. Temporal trajectory analysis requires multiple horizons to compare.`,
      evidence: [
        `Available horizon: ${formatHorizon(only.horizonMinutes)} at ${pctStr(prob, 1)}%`,
        `Data quality: ${only.dataQuality}`,
        `Volume: ${avgVolume.toFixed(1)} contracts`,
        "Multi-horizon comparison unavailable with single data point.",
      ],
    };
  }

  const metrics = computeMetrics(validHorizons);
  const { state, label, description } = classifyMarketState(metrics, validHorizons);
  const trajectoryScore = computeTrajectoryScore(metrics);
  const confidence = trajectoryScore * metrics.dataQuality;
  const reversalRisk = computeReversalRisk(metrics, validHorizons);
  const whatChanged = generateWhatChanged(validHorizons, metrics, state);
  const why = generateWhy(state, metrics, validHorizons);
  const evidence = generateEvidence(state, metrics, validHorizons, reversalRisk);

  return {
    asset,
    asOf: new Date().toISOString(),
    horizons,
    metrics,
    state,
    stateLabel: label,
    stateDescription: description,
    trajectoryScore,
    confidence,
    reversalRisk,
    whatChanged,
    why,
    evidence,
  };
}

function computeMetrics(horizons: HorizonProbability[]): TemporalMetrics {
  const sorted = sortByHorizon(horizons);
  const probs = sorted.map((h) => h.midProbability as number);

  // Probability velocity: change per minute
  const velocity =
    sorted.length >= 2
      ? (probs[probs.length - 1] - probs[0]) /
        (sorted[sorted.length - 1].horizonMinutes - sorted[0].horizonMinutes || 1)
      : 0;

  // Velocity per hour
  const velocityPerHour = velocity * 60;

  // Persistence: how consistently directional across horizons
  const directionalConsistency = computePersistence(probs);

  // Conviction decay: how much probability weakens from short→long
  const convictionDecay = computeConvictionDecay(sorted);

  // Cross-horizon divergence: disagreement between short and long
  const crossHorizonDivergence = computeCrossHorizonDivergence(sorted);

  // Data quality average
  const qualityScores = horizons.map((h) => qualityToNumber(h.dataQuality));
  const dataQuality =
    qualityScores.reduce((a, b) => a + b, 0) / (qualityScores.length || 1);

  // Direction strength: how far from 0.5 (neutral)
  // Dampen at extremes — 2% prob doesn't mean "very bullish", it means "almost certain NOT to happen"
  const avgProb = probs.reduce((a, b) => a + b, 0) / (probs.length || 1);
  const rawDirection = Math.abs(avgProb - 0.5) * 2;
  const extremePenalty = avgProb < 0.15 || avgProb > 0.85 ? 0.3 : 1.0;
  const directionStrength = rawDirection * extremePenalty;

  // Momentum: rate of change of probability
  const momentum = computeMomentum(sorted);

  // Liquidity: average volume (null volumes treated as 0 for liquidity calc)
  const avgVolume =
    horizons.reduce((a, h) => a + ((h.volume as number) ?? 0), 0) / (horizons.length || 1);
  const liquidity = Math.min(avgVolume / LIQUIDITY_NORMALIZATION_BASE, 1);

  return {
    velocity,
    velocityPerHour,
    persistence: directionalConsistency,
    convictionDecay,
    crossHorizonDivergence,
    dataQuality,
    directionStrength,
    momentum,
    liquidity,
  };
}

function computePersistence(probs: number[]): number {
  if (probs.length < 2) return 0;
  let consistent = 0;
  const direction = probs[probs.length - 1] > probs[0] ? 1 : -1;

  for (let i = 1; i < probs.length; i++) {
    const diff = probs[i] - probs[i - 1];
    if (direction > 0 && diff >= 0) consistent++;
    else if (direction < 0 && diff <= 0) consistent++;
  }

  return consistent / (probs.length - 1);
}

function computeConvictionDecay(sorted: HorizonProbability[]): number {
  if (sorted.length < 2) return 0;
  const shortProb = sorted[0].midProbability as number;
  const longProb = sorted[sorted.length - 1].midProbability as number;

  const rawDecay = longProb - shortProb;

  // At extreme probabilities, large raw differences are misleading
  // A jump from 1% to 70% is extreme cross-horizon disagreement, not bullish acceleration
  const avgProb = (shortProb + longProb) / 2;
  if (avgProb < 0.15 || avgProb > 0.85) {
    return rawDecay * 0.3;
  }
  return rawDecay;
}

function computeCrossHorizonDivergence(sorted: HorizonProbability[]): number {
  if (sorted.length < 2) return 0;

  const shortHorizons = sorted.filter(
    (h) => h.horizonMinutes <= sorted[0].horizonMinutes * 2
  );
  const longHorizons = sorted.filter(
    (h) =>
      h.horizonMinutes >=
      sorted[sorted.length - 1].horizonMinutes * 0.5
  );

  const shortAvg =
    shortHorizons.reduce((a, h) => a + (h.midProbability as number), 0) /
    (shortHorizons.length || 1);
  const longAvg =
    longHorizons.reduce((a, h) => a + (h.midProbability as number), 0) /
    (longHorizons.length || 1);

  return Math.abs(shortAvg - longAvg);
}

function computeMomentum(sorted: HorizonProbability[]): number {
  if (sorted.length < 3) return 0;

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid + 1);
  const secondHalf = sorted.slice(mid);

  const avgFirst =
    firstHalf.reduce((a, h) => a + (h.midProbability as number), 0) /
    (firstHalf.length || 1);
  const avgSecond =
    secondHalf.reduce((a, h) => a + (h.midProbability as number), 0) /
    (secondHalf.length || 1);

  return avgSecond - avgFirst;
}

function classifyMarketState(
  metrics: TemporalMetrics,
  horizons: HorizonProbability[]
): { state: MarketState; label: string; description: string } {
  if (metrics.dataQuality < DATA_QUALITY_MINIMUM || horizons.length < 2) {
    return {
      state: "insufficient-data",
      label: "Insufficient Data",
      description: "Not enough valid market data to determine trajectory.",
    };
  }

  const avgProb =
    horizons.reduce((a, h) => a + (h.midProbability as number), 0) / horizons.length;
  const isBullish = avgProb > BULLISH_THRESHOLD;
  const isBearish = avgProb < BEARISH_THRESHOLD;

  const hasConflict = metrics.crossHorizonDivergence > DIVERGENCE_CONFLICT_THRESHOLD;
  if (hasConflict) {
    return {
      state: "cross-horizon-conflict",
      label: "Cross-Horizon Conflict",
      description:
        "Short and long horizons show significantly different conviction levels.",
    };
  }

  const hasReversal = detectReversal(metrics, horizons);
  if (hasReversal) {
    return {
      state: "reversal-warning",
      label: "Reversal Warning",
      description:
        "Direction is reversing across time horizons — market conviction is shifting.",
    };
  }

  if (isBullish) {
    if (metrics.velocityPerHour > VELOCITY_STRONG_THRESHOLD) {
      return {
        state: "bullish-acceleration",
        label: "Bullish Acceleration",
        description:
          "Probability increases across horizons — market expects sustained upside.",
      };
    }
    if (metrics.convictionDecay < -DECAY_SIGNIFICANT_THRESHOLD) {
      return {
        state: "bullish-decay",
        label: "Bullish Decay",
        description:
          "Short-term is bullish but conviction weakens at longer horizons.",
      };
    }
    return {
      state: "bullish-persistence",
      label: "Bullish Persistence",
      description: "Consistent bullish conviction across all horizons.",
    };
  }

  if (isBearish) {
    if (metrics.velocityPerHour < -VELOCITY_STRONG_THRESHOLD) {
      return {
        state: "bearish-acceleration",
        label: "Bearish Acceleration",
        description:
          "Probability decreases across horizons — market expects sustained downside.",
      };
    }
    if (metrics.convictionDecay > DECAY_SIGNIFICANT_THRESHOLD) {
      return {
        state: "bearish-decay",
        label: "Bearish Decay",
        description:
          "Short-term is bearish but conviction weakens (less bearish) at longer horizons.",
      };
    }
    return {
      state: "bearish-persistence",
      label: "Bearish Persistence",
      description: "Consistent bearish conviction across all horizons.",
    };
  }

  return {
    state: "neutral",
    label: "Neutral",
    description: "No strong directional bias detected across horizons.",
  };
}

function detectReversal(
  metrics: TemporalMetrics,
  horizons: HorizonProbability[]
): boolean {
  if (horizons.length < 3) return false;

  const sorted = sortByHorizon(horizons);
  const short = sorted[0].midProbability as number;
  const mid = sorted[Math.floor(sorted.length / 2)].midProbability as number;
  const long = sorted[sorted.length - 1].midProbability as number;

  const shortToMid = mid - short;
  const midToLong = long - mid;

  return shortToMid * midToLong < 0 && Math.abs(metrics.velocityPerHour) > 0.01;
}

function computeTrajectoryScore(metrics: TemporalMetrics): number {
  const consistency = 1 - metrics.crossHorizonDivergence * 5;

  return (
    TRAJECTORY_WEIGHTS.direction * metrics.directionStrength +
    TRAJECTORY_WEIGHTS.momentum * Math.min(Math.abs(metrics.momentum) * 5, 1) +
    TRAJECTORY_WEIGHTS.persistence * metrics.persistence +
    TRAJECTORY_WEIGHTS.consistency * Math.max(consistency, 0) +
    TRAJECTORY_WEIGHTS.liquidity * metrics.liquidity
  );
}

function computeReversalRisk(
  metrics: TemporalMetrics,
  horizons: HorizonProbability[]
): number {
  let risk = 0;

  risk += Math.min(Math.abs(metrics.velocityPerHour) * 2, 0.3);
  risk += metrics.crossHorizonDivergence * 3;
  risk += (1 - metrics.dataQuality) * 0.2;

  const hasReversal = detectReversal(metrics, horizons);
  if (hasReversal) risk += 0.3;

  return Math.min(risk, 1);
}

function generateWhatChanged(
  horizons: HorizonProbability[],
  metrics: TemporalMetrics,
  state: MarketState
): string {
  if (state === "insufficient-data") return "Not enough data for analysis.";

  const sorted = sortByHorizon(horizons);
  const shortest = sorted[0];
  const longest = sorted[sorted.length - 1];

  const shortPct = pctStr(shortest.midProbability as number, 1);
  const longPct = pctStr(longest.midProbability as number, 1);

  const parts: string[] = [];

  parts.push(
    `${formatHorizon(shortest.horizonMinutes)}: ${shortPct}% → ${formatHorizon(longest.horizonMinutes)}: ${longPct}%`
  );

  const direction =
    (longest.midProbability as number) > (shortest.midProbability as number);
  const diff = Math.abs(
    (longest.midProbability as number) - (shortest.midProbability as number)
  );

  if (diff < 0.02) {
    parts.push("Flat trajectory — conviction stable across horizons.");
  } else if (direction) {
    parts.push(
      `Conviction increases by ${ppStr(diff, 1)} from shortest to longest horizon.`
    );
  } else {
    parts.push(
      `Conviction decreases by ${ppStr(diff, 1)} from shortest to longest horizon.`
    );
  }

  if (metrics.persistence > 0.8) {
    parts.push("High persistence — direction is consistent across all horizons.");
  } else if (metrics.persistence < 0.5) {
    parts.push(
      "Low persistence — direction varies across horizons, suggesting uncertainty."
    );
  }

  return parts.join(" ");
}

function generateWhy(
  state: MarketState,
  metrics: TemporalMetrics,
  horizons: HorizonProbability[]
): string {
  const sorted = sortByHorizon(horizons);
  if (sorted.length < 2) return "Insufficient data to explain trajectory.";

  const short = sorted[0];
  const long = sorted[sorted.length - 1];
  const avgProb =
    sorted.reduce((a, h) => a + (h.midProbability as number), 0) / sorted.length;

  const parts: string[] = [];

  if (state === "insufficient-data") {
    return "Not enough market data across multiple horizons to form a trajectory interpretation.";
  }

  if (state.includes("bullish")) {
    if (state === "bullish-acceleration") {
      parts.push(
        `The market is bullish and conviction INCREASES at longer horizons (${pctStr(short.midProbability as number, 1)}% at ${formatHorizon(short.horizonMinutes)} → ${pctStr(long.midProbability as number, 1)}% at ${formatHorizon(long.horizonMinutes)}).`
      );
      parts.push(
        `This suggests participants expect the upward move to SUSTAIN or ACCELERATE, not just be a short-term spike.`
      );
    } else if (state === "bullish-decay") {
      parts.push(
        `The market is bullish short-term (${pctStr(short.midProbability as number, 1)}%) but conviction WEAKENS at longer horizons (${pctStr(long.midProbability as number, 1)}%).`
      );
      parts.push(
        `This suggests participants expect the upside to FADE over time — the bullish move may not be sustained.`
      );
    } else {
      parts.push(
        `Consistent bullish conviction across all horizons (${pctStr(avgProb, 1)}% average).`
      );
      parts.push(
        `Direction is stable — no significant disagreement between short-term and long-term participants.`
      );
    }
  } else if (state.includes("bearish")) {
    if (state === "bearish-acceleration") {
      parts.push(
        `The market is bearish and conviction STRENGTHENS at longer horizons (${pctStr(short.midProbability as number, 1)}% at ${formatHorizon(short.horizonMinutes)} → ${pctStr(long.midProbability as number, 1)}% at ${formatHorizon(long.horizonMinutes)}).`
      );
      parts.push(
        `This suggests participants expect the downward move to SUSTAIN or deepen.`
      );
    } else if (state === "bearish-decay") {
      parts.push(
        `The market is bearish short-term (${pctStr(short.midProbability as number, 1)}%) but conviction WEAKENS at longer horizons (${pctStr(long.midProbability as number, 1)}%).`
      );
      parts.push(
        `This suggests participants expect the downside to FADE — a potential recovery or stabilization ahead.`
      );
    } else {
      parts.push(
        `Consistent bearish conviction across all horizons (${pctStr(avgProb, 1)}% average).`
      );
      parts.push(
        `Direction is stable — no significant disagreement between short-term and long-term participants.`
      );
    }
  } else if (state === "cross-horizon-conflict") {
    parts.push(
      `Short-term (${pctStr(short.midProbability as number, 1)}%) and long-term (${pctStr(long.midProbability as number, 1)}%) horizons disagree significantly.`
    );
    parts.push(
      `This divergence indicates uncertainty — different timeframes have different expectations.`
    );
  } else if (state === "reversal-warning") {
    parts.push(
      `Direction is FLIPPING across horizons — what looks bullish at one timeframe turns bearish at another (or vice versa).`
    );
    parts.push(
      `This is a classic reversal signal: the market is in transition.`
    );
  } else {
    parts.push(
      `Average probability is ${pctStr(avgProb, 1)}% — close to neutral. No strong directional bias.`
    );
  }

  if (metrics.persistence > 0.8) {
    parts.push(`High persistence (${pctStr(metrics.persistence, 0)}%) reinforces the signal.`);
  } else if (metrics.persistence < 0.4) {
    parts.push(`Low persistence (${pctStr(metrics.persistence, 0)}%) suggests the signal is noisy.`);
  }

  return parts.join(" ");
}

function generateEvidence(
  state: MarketState,
  metrics: TemporalMetrics,
  horizons: HorizonProbability[],
  reversalRisk?: number
): string[] {
  const evidence: string[] = [];
  const sorted = sortByHorizon(horizons);

  if (sorted.length === 0) return ["No market data available."];

  const short = sorted[0];
  const long = sorted[sorted.length - 1];

  evidence.push(
    `Probability range: ${pctStr(short.midProbability as number, 1)}% (${formatHorizon(short.horizonMinutes)}) → ${pctStr(long.midProbability as number, 1)}% (${formatHorizon(long.horizonMinutes)})`
  );

  const totalDecay =
    (long.midProbability as number) - (short.midProbability as number);
  evidence.push(
    `Conviction change: ${ppStr(totalDecay, 1)} across ${sorted.length} horizons`
  );

  evidence.push(
    `Velocity: ${pctStr(metrics.velocityPerHour, 2)}% per hour`
  );

  evidence.push(
    `Persistence: ${pctStr(metrics.persistence, 0)}% — ${
      metrics.persistence > 0.7
        ? "direction consistent"
        : metrics.persistence > 0.4
        ? "direction partially consistent"
        : "direction varies"
    }`
  );

  evidence.push(
    `Cross-horizon divergence: ${ppStr(metrics.crossHorizonDivergence, 1)} — ${
      metrics.crossHorizonDivergence < 0.03
        ? "minimal"
        : metrics.crossHorizonDivergence < 0.08
        ? "moderate"
        : "significant"
    }`
  );

  const avgVolume =
    horizons.reduce((a, h) => a + ((h.volume as number) ?? 0), 0) / (horizons.length || 1);
  evidence.push(
    `Average volume: ${avgVolume.toFixed(1)} contracts — ${
      avgVolume > 50
        ? "high liquidity"
        : avgVolume > 10
        ? "moderate liquidity"
        : "low liquidity"
    }`
  );

  const highQuality = horizons.filter((h) => h.dataQuality === "high").length;
  evidence.push(
    `Data quality: ${highQuality}/${horizons.length} horizons with high-quality orderbook data`
  );

  if (reversalRisk && reversalRisk > 0.5) {
    evidence.push(
      `Reversal risk elevated at ${pctStr(reversalRisk, 0)}% — potential direction change ahead`
    );
  }

  return evidence;
}

function emptyTrajectory(
  asset: string,
  _now: number,
  horizons: HorizonProbability[] = []
): TemporalTrajectory {
  return {
    asset,
    asOf: new Date().toISOString(),
    horizons,
    metrics: {
      velocity: 0,
      velocityPerHour: 0,
      persistence: 0,
      convictionDecay: 0,
      crossHorizonDivergence: 0,
      dataQuality: 0,
      directionStrength: 0,
      momentum: 0,
      liquidity: 0,
    },
    state: "insufficient-data",
    stateLabel: "Insufficient Data",
    stateDescription: "No active markets found for this asset.",
    trajectoryScore: 0,
    confidence: 0,
    reversalRisk: 0,
    whatChanged: "No data available.",
    why: "Not enough market data to form a trajectory interpretation.",
    evidence: ["No market data available."],
  };
}
