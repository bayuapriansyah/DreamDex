import type { TemporalTrajectory, MarketState } from "./temporal";
import type { HourForecast } from "./forecast";
import type { Strategy, StrategyType } from "./strategy";
import { composeStrategies } from "./strategy";
import { mapNextHour } from "./forecast";
import { sortByHorizon } from "./normalization";
import { formatHorizon, pctStr } from "./formatting";

/**
 * Decision Context — unified pipeline output.
 *
 * Ties together every stage:
 *   Temporal Engine → Market Regime → Trajectory → What Changed
 *   → Evidence → Decision Context → MAP THE NEXT HOUR → Strategy → Trade
 */

export interface DecisionContext {
  /** Pipeline timestamp. */
  timestamp: string;
  /** Asset symbol. */
  asset: string;
  /** Full temporal trajectory. */
  trajectory: TemporalTrajectory;
  /** Market regime classification. */
  regime: MarketRegime;
  /** MAP THE NEXT HOUR forecast. */
  forecast: HourForecast;
  /** Decision quality composite score. */
  decisionQuality: DecisionQuality;
  /** Deterministic actionability rating. */
  actionability: "high" | "medium" | "low";
  /** All available strategies. */
  strategies: Strategy[];
  /** Recommended strategy type. */
  recommendedStrategy: StrategyType;
  /** Plain-language pipeline summary. */
  pipelineSummary: string;
  /** One-line verdict. */
  verdict: string;
}

export interface MarketRegime {
  /** Current state from temporal engine. */
  state: MarketState;
  /** Human-readable label. */
  label: string;
  /** Regime strength (0..1). */
  strength: number;
  /** Expected regime duration indicator. */
  durationHint: "fleeting" | "developing" | "established";
}

export interface DecisionQuality {
  /** Overall data quality (0..1). */
  dataQuality: number;
  /** Trajectory score (0..1). */
  trajectoryScore: number;
  /** Confidence in trajectory (0..1). */
  confidence: number;
  /** Reversal risk (0..1). */
  reversalRisk: number;
  /** Forecast confidence (0..1). */
  forecastConfidence: number;
  /** Composite decision score (0..1). */
  composite: number;
  /** Human-readable quality tier. */
  tier: "strong" | "moderate" | "weak" | "unusable";
}

export function buildDecisionContext(
  trajectory: TemporalTrajectory
): DecisionContext {
  const forecast = mapNextHour(
    trajectory.horizons,
    trajectory.metrics,
    trajectory.state
  );

  const regime = classifyRegime(trajectory);
  const decisionQuality = computeDecisionQuality(trajectory, forecast);
  const actionability = computeActionability(trajectory, decisionQuality);
  const strategies = composeStrategies(trajectory);
  const recommendedStrategy = recommendStrategy(
    trajectory,
    forecast,
    decisionQuality
  );
  const pipelineSummary = generatePipelineSummary(
    trajectory,
    regime,
    forecast,
    decisionQuality
  );
  const verdict = generateVerdict(
    trajectory,
    forecast,
    recommendedStrategy,
    decisionQuality
  );

  return {
    timestamp: new Date().toISOString(),
    asset: trajectory.asset,
    trajectory,
    regime,
    forecast,
    decisionQuality,
    actionability,
    strategies,
    recommendedStrategy,
    pipelineSummary,
    verdict,
  };
}

function classifyRegime(trajectory: TemporalTrajectory): MarketRegime {
  const { state, metrics } = trajectory;

  // Regime strength based on direction strength + persistence + consistency
  const strength = Math.min(
    metrics.directionStrength * 0.4 +
      metrics.persistence * 0.3 +
      (1 - metrics.crossHorizonDivergence) * 0.3,
    1
  );

  // Duration hint based on momentum, velocity, and decay
  let durationHint: MarketRegime["durationHint"] = "developing";

  if (
    Math.abs(metrics.momentum) < 0.02 &&
    Math.abs(metrics.velocityPerHour) < 0.03 &&
    metrics.persistence > 0.7
  ) {
    durationHint = "established";
  } else if (
    Math.abs(metrics.momentum) > 0.05 ||
    metrics.velocityPerHour > 0.08 ||
    metrics.velocityPerHour < -0.08
  ) {
    durationHint = "fleeting";
  }

  // Override for uncertain states
  if (state === "insufficient-data") {
    return {
      state,
      label: "Insufficient Data",
      strength: 0,
      durationHint: "fleeting",
    };
  }

  if (state === "cross-horizon-conflict") {
    return {
      state,
      label: "Cross-Horizon Conflict",
      strength: Math.min(metrics.crossHorizonDivergence * 5, 1),
      durationHint: "fleeting",
    };
  }

  if (state === "reversal-warning") {
    return {
      state,
      label: "Reversal Warning",
      strength: Math.min(Math.abs(metrics.velocityPerHour) * 10, 1),
      durationHint: "fleeting",
    };
  }

  const labelMap: Record<MarketState, string> = {
    "bullish-acceleration": "Bullish Acceleration",
    "bullish-persistence": "Bullish Persistence",
    "bullish-decay": "Bullish Decay",
    "bearish-acceleration": "Bearish Acceleration",
    "bearish-persistence": "Bearish Persistence",
    "bearish-decay": "Bearish Decay",
    "reversal-warning": "Reversal Warning",
    "cross-horizon-conflict": "Cross-Horizon Conflict",
    neutral: "Neutral",
    "single-horizon": "Single Horizon",
    "insufficient-data": "Insufficient Data",
  };

  return {
    state,
    label: labelMap[state] ?? state,
    strength,
    durationHint,
  };
}

function computeActionability(
  trajectory: TemporalTrajectory,
  quality: DecisionQuality
): "high" | "medium" | "low" {
  const { confidence, reversalRisk, trajectoryScore } = trajectory;

  // Average probability from valid horizons
  const valid = trajectory.horizons.filter((h) => h.midProbability !== null);
  let avgProb = 0.5;
  if (valid.length > 0) {
    avgProb = valid.reduce((a, h) => a + (h.midProbability as number), 0) / valid.length;
  }

  // Penalize extreme probabilities — trades at 1-15% or 85-99% have poor risk/reward
  const probPenalty = avgProb < 0.15 || avgProb > 0.85 ? 0.3 : 1.0;

  // Horizon agreement
  let horizonAgreement = 0;
  if (valid.length >= 2) {
    const sorted = valid.sort((a, b) => a.horizonMinutes - b.horizonMinutes);
    const range = Math.abs(
      (sorted[sorted.length - 1].midProbability as number) -
        (sorted[0].midProbability as number)
    );
    horizonAgreement = range < 0.05 ? 1 : range < 0.15 ? 0.5 : 0;
  }

  // Composite actionability score
  const score =
    confidence * 0.25 +
    (1 - reversalRisk) * 0.25 +
    trajectoryScore * 0.2 * probPenalty +
    horizonAgreement * 0.15 +
    quality.dataQuality * 0.15;

  if (score > 0.6) return "high";
  if (score > 0.35) return "medium";
  return "low";
}

function computeDecisionQuality(
  trajectory: TemporalTrajectory,
  forecast: HourForecast
): DecisionQuality {
  const { metrics, confidence, reversalRisk, trajectoryScore } = trajectory;
  const forecastConfidence = forecast.confidence;

  // Composite: weighted average
  const composite =
    trajectoryScore * 0.3 +
    confidence * 0.25 +
    metrics.dataQuality * 0.2 +
    forecastConfidence * 0.15 +
    (1 - reversalRisk) * 0.1;

  let tier: DecisionQuality["tier"];
  if (composite > 0.7) tier = "strong";
  else if (composite > 0.45) tier = "moderate";
  else if (composite > 0.2) tier = "weak";
  else tier = "unusable";

  return {
    dataQuality: metrics.dataQuality,
    trajectoryScore,
    confidence,
    reversalRisk,
    forecastConfidence,
    composite,
    tier,
  };
}

function recommendStrategy(
  trajectory: TemporalTrajectory,
  forecast: HourForecast,
  quality: DecisionQuality
): StrategyType {
  // Unusable → conservative (or hold)
  if (quality.tier === "unusable") return "conservative";

  // High reversal risk → conservative
  if (quality.reversalRisk > 0.6) return "conservative";

  // Strong quality with clear direction → can be aggressive
  if (quality.tier === "strong") {
    if (
      trajectory.state.includes("acceleration") &&
      quality.reversalRisk < 0.3
    ) {
      return "aggressive";
    }
    return "balanced";
  }

  // Moderate → balanced
  if (quality.tier === "moderate") return "balanced";

  // Weak → conservative
  return "conservative";
}

function generatePipelineSummary(
  trajectory: TemporalTrajectory,
  regime: MarketRegime,
  forecast: HourForecast,
  quality: DecisionQuality
): string {
  const parts: string[] = [];

  parts.push(`[${regime.label}] ${trajectory.asset}`);

  if (quality.tier === "unusable") {
    parts.push("Insufficient data quality for actionable analysis.");
    return parts.join(" — ");
  }

  parts.push(
    `Decision quality: ${quality.tier} (${pctStr(quality.composite, 0)}%)`
  );

  if (trajectory.horizons.length > 0) {
    const sorted = sortByHorizon(
      trajectory.horizons.filter((h) => h.midProbability !== null)
    );
    if (sorted.length > 0) {
      const short = sorted[0];
      const long = sorted[sorted.length - 1];
      parts.push(
        `Probability: ${pctStr(short.midProbability as number, 1)}% (${formatHorizon(short.horizonMinutes)}) → ${pctStr(long.midProbability as number, 1)}% (${formatHorizon(long.horizonMinutes)})`
      );
    }
  }

  if (forecast.direction !== "uncertain") {
    parts.push(
      `Forecast: ${forecast.direction} over next hour (confidence: ${pctStr(forecast.confidence, 0)}%)`
    );
  }

  return parts.join(" — ");
}

function generateVerdict(
  trajectory: TemporalTrajectory,
  forecast: HourForecast,
  strategy: StrategyType,
  quality: DecisionQuality
): string {
  if (quality.tier === "unusable") {
    return "INSUFFICIENT DATA — No actionable signal. Wait for more horizon data.";
  }

  if (quality.reversalRisk > 0.7) {
    return `REVERSAL RISK HIGH — ${trajectory.stateLabel}. Recommend holding until direction stabilizes.`;
  }

  if (forecast.direction === "uncertain") {
    return "UNCERTAIN — Conflicting signals. No clear directional bias for the next hour.";
  }

  const probStr =
    trajectory.horizons.length > 0
      ? (() => {
          const sorted = sortByHorizon(
            trajectory.horizons.filter((h) => h.midProbability !== null)
          );
          const avg =
            sorted.reduce(
              (a, h) => a + (h.midProbability as number),
              0
            ) / sorted.length;
          return `Avg ${pctStr(avg, 1)}%`;
        })()
      : "";

  const strategyLabel =
    strategy === "conservative"
      ? "CONSERVATIVE"
      : strategy === "balanced"
      ? "BALANCED"
      : "AGGRESSIVE";

  return `${trajectory.stateLabel.toUpperCase()} — ${probStr} → ${forecast.direction} forecast. Recommend ${strategyLabel} approach.`;
}
