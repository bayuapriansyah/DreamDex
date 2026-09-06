import type { TemporalTrajectory, MarketState } from "./temporal";
import { sortByHorizon, BULLISH_THRESHOLD, BEARISH_THRESHOLD } from "./normalization";
import { pctStr } from "./formatting";

export type StrategyType = "conservative" | "balanced" | "aggressive";

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
}

const STRATEGY_CONFIGS: Record<
  StrategyType,
  {
    riskTolerance: number;
    sizeMultiplier: number;
    profitTarget: number;
    stopDistance: number;
  }
> = {
  conservative: {
    riskTolerance: 0.3,
    sizeMultiplier: 0.5,
    profitTarget: 0.05,
    stopDistance: 0.1,
  },
  balanced: {
    riskTolerance: 0.5,
    sizeMultiplier: 1,
    profitTarget: 0.1,
    stopDistance: 0.15,
  },
  aggressive: {
    riskTolerance: 0.8,
    sizeMultiplier: 2,
    profitTarget: 0.2,
    stopDistance: 0.2,
  },
};

export function composeStrategies(
  trajectory: TemporalTrajectory
): Strategy[] {
  return [
    composeStrategy("conservative", trajectory),
    composeStrategy("balanced", trajectory),
    composeStrategy("aggressive", trajectory),
  ];
}

function composeStrategy(
  type: StrategyType,
  trajectory: TemporalTrajectory
): Strategy {
  const config = STRATEGY_CONFIGS[type];
  const { metrics, state, horizons, confidence } = trajectory;
  const sorted = sortByHorizon(horizons);
  const validHorizons = sorted.filter((h) => h.midProbability !== null);

  const avgProb =
    validHorizons.length > 0
      ? validHorizons.reduce((a, h) => a + (h.midProbability as number), 0) / validHorizons.length
      : 0.5;

  const { side, reasoning } = determineSide(state, metrics, avgProb, config);
  const suggestedHorizon = determineHorizon(type, sorted, state);
  const maxEntryPrice = determineEntryPrice(
    side,
    avgProb,
    config,
    sorted,
    suggestedHorizon
  );
  const { takeProfit, stopLoss } = determineLevels(
    side,
    maxEntryPrice,
    config
  );

  const suggestedSize = calculateSize(type, metrics, confidence);

  const confidenceLevel = determineConfidence(
    metrics.dataQuality,
    confidence,
    type
  );

  return {
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    description: getDescription(type),
    side,
    reasoning,
    suggestedHorizon,
    suggestedSize,
    maxEntryPrice,
    takeProfit,
    stopLoss,
    confidence: confidenceLevel,
  };
}

function determineSide(
  state: MarketState,
  metrics: { velocityPerHour: number; directionStrength: number; persistence: number },
  avgProb: number,
  config: { riskTolerance: number }
): { side: "buy" | "sell" | "hold"; reasoning: string } {
  if (state === "insufficient-data") {
    return { side: "hold", reasoning: "Insufficient data — no trade recommended." };
  }

  if (state === "single-horizon") {
    return { side: "hold", reasoning: "Single horizon — multi-horizon trajectory unavailable." };
  }

  if (state === "cross-horizon-conflict") {
    if (config.riskTolerance < 0.5) {
      return {
        side: "hold",
        reasoning: "Cross-horizon conflict detected. Conservative approach avoids trading during uncertainty.",
      };
    }
    return {
      side: avgProb > 0.5 ? "buy" : "sell",
      reasoning: `Conflict detected but risk tolerance allows entry. Lean ${avgProb > 0.5 ? "long" : "short"} based on average probability.`,
    };
  }

  if (state === "reversal-warning") {
    if (config.riskTolerance > 0.6) {
      return {
        side: avgProb > 0.5 ? "sell" : "buy",
        reasoning: "Reversal warning — aggressive strategy fades the reversal to capture the counter-move.",
      };
    }
    return { side: "hold", reasoning: "Reversal warning — wait for direction to stabilize." };
  }

  const isBullish =
    state.includes("bullish") || (avgProb > BULLISH_THRESHOLD && metrics.directionStrength > 0.2);
  const isBearish =
    state.includes("bearish") || (avgProb < BEARISH_THRESHOLD && metrics.directionStrength > 0.2);

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
      reasoning: `${strength} bullish signal. Velocity ${pctStr(metrics.velocityPerHour, 2)}%/hr, persistence ${pctStr(metrics.persistence, 0)}%.`,
    };
  }

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
      reasoning: `${strength} bearish signal. Velocity ${pctStr(metrics.velocityPerHour, 2)}%/hr, persistence ${pctStr(metrics.persistence, 0)}%.`,
    };
  }

  return {
    side: "hold",
    reasoning: "No clear directional bias. Hold and wait for stronger signal.",
  };
}

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

function determineEntryPrice(
  side: "buy" | "sell" | "hold",
  avgProb: number,
  config: { riskTolerance: number },
  sorted: { horizonMinutes: number; midProbability: number | null; askProbability: number | null; bidProbability: number | null }[],
  suggestedHorizon: number
): number {
  if (side === "hold") return 0;

  const target = sorted.find(
    (h) => h.horizonMinutes === suggestedHorizon
  ) || sorted[0];

  if (!target) return 0.5;

  if (side === "buy") {
    const maxAsk = target.askProbability ?? target.midProbability ?? 0.5;
    const slippage = config.riskTolerance * 0.03;
    return Math.min(maxAsk + slippage, 0.99);
  } else {
    const maxBid = target.bidProbability ?? target.midProbability ?? 0.5;
    const slippage = config.riskTolerance * 0.03;
    return Math.max(maxBid - slippage, 0.01);
  }
}

function determineLevels(
  side: "buy" | "sell" | "hold",
  entry: number,
  config: { profitTarget: number; stopDistance: number }
): { takeProfit: number; stopLoss: number } {
  if (side === "hold") return { takeProfit: 0, stopLoss: 0 };

  if (side === "buy") {
    return {
      takeProfit: Math.min(entry + config.profitTarget, 0.99),
      stopLoss: Math.max(entry - config.stopDistance, 0.01),
    };
  } else {
    return {
      takeProfit: Math.max(entry - config.profitTarget, 0.01),
      stopLoss: Math.min(entry + config.stopDistance, 0.99),
    };
  }
}

function calculateSize(
  type: StrategyType,
  metrics: { dataQuality: number; liquidity: number },
  confidence: number
): number {
  const base = 1;
  const config = STRATEGY_CONFIGS[type];
  const size =
    base *
    config.sizeMultiplier *
    (0.5 + metrics.dataQuality * 0.3 + metrics.liquidity * 0.2) *
    confidence;
  return Math.max(1, Math.round(size));
}

function determineConfidence(
  dataQuality: number,
  trajectoryScore: number,
  type: StrategyType
): "high" | "medium" | "low" {
  const score = dataQuality * 0.4 + trajectoryScore * 0.6;
  const threshold =
    type === "conservative" ? 0.3 : type === "balanced" ? 0.2 : 0.1;

  if (score > 0.7 - threshold) return "high";
  if (score > 0.4 - threshold) return "medium";
  return "low";
}

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
