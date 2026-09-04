import { getExchange } from "./client";
import type { MarketData } from "./markets";

export interface HorizonProbability {
  horizonMinutes: number;
  marketId: string;
  yesProbability: number;
  bidProbability: number | null;
  askProbability: number | null;
  midProbability: number;
  spread: number;
  volume: number;
  secondsLeft: number;
  dataQuality: "high" | "medium" | "low" | "none";
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
    .filter((m) => m.asset === asset && m.secondsLeft > 60)
    .sort((a, b) => a.horizonMinutes - b.horizonMinutes);

  if (assetMarkets.length === 0) {
    return emptyTrajectory(asset, now);
  }

  await exchange.loadMarkets();

  const horizons: HorizonProbability[] = [];

  for (const m of assetMarkets) {
    try {
      const upSymbol = Object.keys(exchange.markets).find((s) => {
        const mkt = exchange.markets[s];
        if (!mkt) return false;
        const info = mkt.info as Record<string, unknown>;
        return info?.marketId === m.marketId;
      });

      if (!upSymbol) continue;

      const book = await exchange.fetchOrderBook(upSymbol, 5);
      const bestBid = book.bids[0]?.[0] ?? null;
      const bestAsk = book.asks[0]?.[0] ?? null;
      const spread =
        bestBid !== null && bestAsk !== null ? bestAsk - bestBid : 1;

      const midProbability =
        bestBid !== null && bestAsk !== null
          ? (bestBid + bestAsk) / 2
          : bestBid ?? bestAsk ?? null;

      const yesProbability =
        midProbability !== null ? midProbability : (m.lastPrice ?? 0.5);

      const dataQuality = classifyDataQuality(
        bestBid,
        bestAsk,
        m.volume ?? 0,
        m.secondsLeft
      );

      horizons.push({
        horizonMinutes: m.horizonMinutes,
        marketId: m.marketId,
        yesProbability: yesProbability ?? 0.5,
        bidProbability: bestBid,
        askProbability: bestAsk,
        midProbability: midProbability ?? 0.5,
        spread,
        volume: m.volume ?? 0,
        secondsLeft: m.secondsLeft,
        dataQuality,
      });
    } catch {
      continue;
    }
  }

  if (horizons.length < 2) {
    return emptyTrajectory(asset, now, horizons);
  }

  const metrics = computeMetrics(horizons);
  const { state, label, description } = classifyMarketState(metrics, horizons);
  const trajectoryScore = computeTrajectoryScore(metrics);
  const confidence = trajectoryScore * metrics.dataQuality;
  const reversalRisk = computeReversalRisk(metrics, horizons);
  const whatChanged = generateWhatChanged(horizons, metrics, state);
  const why = generateWhy(state, metrics, horizons);
  const evidence = generateEvidence(state, metrics, horizons, reversalRisk);

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
  const sorted = [...horizons].sort(
    (a, b) => a.horizonMinutes - b.horizonMinutes
  );
  const probs = sorted.map((h) => h.midProbability);

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
  const avgProb = probs.reduce((a, b) => a + b, 0) / (probs.length || 1);
  const directionStrength = Math.abs(avgProb - 0.5) * 2;

  // Momentum: rate of change of probability
  const momentum = computeMomentum(sorted);

  // Liquidity: average volume
  const avgVolume =
    horizons.reduce((a, h) => a + h.volume, 0) / (horizons.length || 1);
  const liquidity = Math.min(avgVolume / 100, 1);

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
  const shortProb = sorted[0].midProbability;
  const longProb = sorted[sorted.length - 1].midProbability;

  // Positive = conviction grows, Negative = conviction decays
  return longProb - shortProb;
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
    shortHorizons.reduce((a, h) => a + h.midProbability, 0) /
    (shortHorizons.length || 1);
  const longAvg =
    longHorizons.reduce((a, h) => a + h.midProbability, 0) /
    (longHorizons.length || 1);

  return Math.abs(shortAvg - longAvg);
}

function computeMomentum(sorted: HorizonProbability[]): number {
  if (sorted.length < 3) return 0;

  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid + 1);
  const secondHalf = sorted.slice(mid);

  const avgFirst =
    firstHalf.reduce((a, h) => a + h.midProbability, 0) /
    (firstHalf.length || 1);
  const avgSecond =
    secondHalf.reduce((a, h) => a + h.midProbability, 0) /
    (secondHalf.length || 1);

  return avgSecond - avgFirst;
}

function classifyMarketState(
  metrics: TemporalMetrics,
  horizons: HorizonProbability[]
): { state: MarketState; label: string; description: string } {
  if (metrics.dataQuality < 0.3 || horizons.length < 2) {
    return {
      state: "insufficient-data",
      label: "Insufficient Data",
      description: "Not enough valid market data to determine trajectory.",
    };
  }

  const avgProb =
    horizons.reduce((a, h) => a + h.midProbability, 0) / horizons.length;
  const isBullish = avgProb > 0.52;
  const isBearish = avgProb < 0.48;

  const hasConflict = metrics.crossHorizonDivergence > 0.1;
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
    if (metrics.velocityPerHour > 0.02) {
      return {
        state: "bullish-acceleration",
        label: "Bullish Acceleration",
        description:
          "Probability increases across horizons — market expects sustained upside.",
      };
    }
    if (metrics.convictionDecay < -0.03) {
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
    if (metrics.velocityPerHour < -0.02) {
      return {
        state: "bearish-acceleration",
        label: "Bearish Acceleration",
        description:
          "Probability decreases across horizons — market expects sustained downside.",
      };
    }
    if (metrics.convictionDecay > 0.03) {
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

  const sorted = [...horizons].sort(
    (a, b) => a.horizonMinutes - b.horizonMinutes
  );
  const short = sorted[0].midProbability;
  const mid = sorted[Math.floor(sorted.length / 2)].midProbability;
  const long = sorted[sorted.length - 1].midProbability;

  const shortToMid = mid - short;
  const midToLong = long - mid;

  return shortToMid * midToLong < 0 && Math.abs(metrics.velocityPerHour) > 0.01;
}

function computeTrajectoryScore(metrics: TemporalMetrics): number {
  const weights = {
    direction: 0.3,
    momentum: 0.25,
    persistence: 0.2,
    consistency: 0.15,
    liquidity: 0.1,
  };

  const consistency = 1 - metrics.crossHorizonDivergence * 5;

  return (
    weights.direction * metrics.directionStrength +
    weights.momentum * Math.min(Math.abs(metrics.momentum) * 5, 1) +
    weights.persistence * metrics.persistence +
    weights.consistency * Math.max(consistency, 0) +
    weights.liquidity * metrics.liquidity
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

  const sorted = [...horizons].sort(
    (a, b) => a.horizonMinutes - b.horizonMinutes
  );
  const shortest = sorted[0];
  const longest = sorted[sorted.length - 1];

  const shortPct = (shortest.midProbability * 100).toFixed(1);
  const longPct = (longest.midProbability * 100).toFixed(1);

  const parts: string[] = [];

  parts.push(
    `${shortest.horizonMinutes}m: ${shortPct}% → ${longest.horizonMinutes}m: ${longPct}%`
  );

  const direction = longest.midProbability > shortest.midProbability;
  const diff = Math.abs(longest.midProbability - shortest.midProbability);

  if (diff < 0.02) {
    parts.push("Flat trajectory — conviction stable across horizons.");
  } else if (direction) {
    parts.push(
      `Conviction increases by ${(diff * 100).toFixed(1)}pp from shortest to longest horizon.`
    );
  } else {
    parts.push(
      `Conviction decreases by ${(diff * 100).toFixed(1)}pp from shortest to longest horizon.`
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
  const sorted = [...horizons].sort(
    (a, b) => a.horizonMinutes - b.horizonMinutes
  );
  if (sorted.length < 2) return "Insufficient data to explain trajectory.";

  const short = sorted[0];
  const long = sorted[sorted.length - 1];
  const avgProb =
    sorted.reduce((a, h) => a + h.midProbability, 0) / sorted.length;

  const parts: string[] = [];

  if (state === "insufficient-data") {
    return "Not enough market data across multiple horizons to form a trajectory interpretation.";
  }

  if (state.includes("bullish")) {
    if (state === "bullish-acceleration") {
      parts.push(
        `The market is bullish and conviction INCREASES at longer horizons (${(short.midProbability * 100).toFixed(1)}% at ${short.horizonMinutes}m → ${(long.midProbability * 100).toFixed(1)}% at ${long.horizonMinutes}m).`
      );
      parts.push(
        `This suggests participants expect the upward move to SUSTAIN or ACCELERATE, not just be a short-term spike.`
      );
    } else if (state === "bullish-decay") {
      parts.push(
        `The market is bullish short-term (${(short.midProbability * 100).toFixed(1)}%) but conviction WEAKENS at longer horizons (${(long.midProbability * 100).toFixed(1)}%).`
      );
      parts.push(
        `This suggests participants expect the upside to FADE over time — the bullish move may not be sustained.`
      );
    } else {
      parts.push(
        `Consistent bullish conviction across all horizons (${(avgProb * 100).toFixed(1)}% average).`
      );
      parts.push(
        `Direction is stable — no significant disagreement between short-term and long-term participants.`
      );
    }
  } else if (state.includes("bearish")) {
    if (state === "bearish-acceleration") {
      parts.push(
        `The market is bearish and conviction STRENGTHENS at longer horizons (${(short.midProbability * 100).toFixed(1)}% at ${short.horizonMinutes}m → ${(long.midProbability * 100).toFixed(1)}% at ${long.horizonMinutes}m).`
      );
      parts.push(
        `This suggests participants expect the downward move to SUSTAIN or deepen.`
      );
    } else if (state === "bearish-decay") {
      parts.push(
        `The market is bearish short-term (${(short.midProbability * 100).toFixed(1)}%) but conviction WEAKENS at longer horizons (${(long.midProbability * 100).toFixed(1)}%).`
      );
      parts.push(
        `This suggests participants expect the downside to FADE — a potential recovery or stabilization ahead.`
      );
    } else {
      parts.push(
        `Consistent bearish conviction across all horizons (${(avgProb * 100).toFixed(1)}% average).`
      );
      parts.push(
        `Direction is stable — no significant disagreement between short-term and long-term participants.`
      );
    }
  } else if (state === "cross-horizon-conflict") {
    parts.push(
      `Short-term (${(short.midProbability * 100).toFixed(1)}%) and long-term (${(long.midProbability * 100).toFixed(1)}%) horizons disagree significantly.`
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
      `Average probability is ${(avgProb * 100).toFixed(1)}% — close to neutral. No strong directional bias.`
    );
  }

  if (metrics.persistence > 0.8) {
    parts.push(`High persistence (${(metrics.persistence * 100).toFixed(0)}%) reinforces the signal.`);
  } else if (metrics.persistence < 0.4) {
    parts.push(`Low persistence (${(metrics.persistence * 100).toFixed(0)}%) suggests the signal is noisy.`);
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
  const sorted = [...horizons].sort(
    (a, b) => a.horizonMinutes - b.horizonMinutes
  );

  if (sorted.length === 0) return ["No market data available."];

  const short = sorted[0];
  const long = sorted[sorted.length - 1];

  evidence.push(
    `Probability range: ${(short.midProbability * 100).toFixed(1)}% (${short.horizonMinutes}m) → ${(long.midProbability * 100).toFixed(1)}% (${long.horizonMinutes}m)`
  );

  const totalDecay = long.midProbability - short.midProbability;
  evidence.push(
    `Conviction change: ${totalDecay > 0 ? "+" : ""}${(totalDecay * 100).toFixed(1)}pp across ${sorted.length} horizons`
  );

  evidence.push(
    `Velocity: ${(metrics.velocityPerHour * 100).toFixed(2)}% per hour`
  );

  evidence.push(
    `Persistence: ${(metrics.persistence * 100).toFixed(0)}% — ${
      metrics.persistence > 0.7
        ? "direction consistent"
        : metrics.persistence > 0.4
        ? "direction partially consistent"
        : "direction varies"
    }`
  );

  evidence.push(
    `Cross-horizon divergence: ${(metrics.crossHorizonDivergence * 100).toFixed(1)}pp — ${
      metrics.crossHorizonDivergence < 0.03
        ? "minimal"
        : metrics.crossHorizonDivergence < 0.08
        ? "moderate"
        : "significant"
    }`
  );

  const avgVolume =
    horizons.reduce((a, h) => a + h.volume, 0) / (horizons.length || 1);
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
      `⚠ Reversal risk elevated at ${(reversalRisk * 100).toFixed(0)}% — potential direction change ahead`
    );
  }

  return evidence;
}

function emptyTrajectory(
  asset: string,
  now: number,
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
