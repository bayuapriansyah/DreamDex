import type { HorizonProbability, TemporalMetrics, MarketState } from "./temporal";
import { sortByHorizon, BULLISH_THRESHOLD, BEARISH_THRESHOLD } from "./normalization";
import { formatHorizon, pctStr } from "./formatting";

/**
 * MAP THE NEXT HOUR — projects the temporal trajectory forward.
 *
 * Uses velocity, momentum, persistence, and conviction decay
 * to project where probabilities are heading.
 *
 * This is NOT a prediction engine. It is a heuristic projection
 * of current market-implied trajectory into the near future.
 */

export interface HourForecast {
  /** Forecasted probability trajectory for the next 60 minutes. */
  projections: ForecastPoint[];
  /** Overall directional bias for the next hour. */
  direction: "bullish" | "bearish" | "neutral" | "uncertain";
  /** Confidence in the forecast (0..1). */
  confidence: number;
  /** Plain-language summary. */
  summary: string;
  /** Key assumptions behind the forecast. */
  assumptions: string[];
  /** Conditions that would invalidate the forecast. */
  invalidation: string[];
}

export interface ForecastPoint {
  /** Minutes from now. */
  offsetMinutes: number;
  /** Forecasted probability. */
  projectedProbability: number | null;
  /** Upper bound of forecast range. */
  upperBound: number;
  /** Lower bound of forecast range. */
  lowerBound: number;
  /** Confidence level for this point. */
  confidence: "high" | "medium" | "low";
}

const FORECAST_OFFSETS = [5, 10, 15, 20, 30, 45, 60];

export function mapNextHour(
  horizons: HorizonProbability[],
  metrics: TemporalMetrics,
  state: MarketState
): HourForecast {
  const sorted = sortByHorizon(horizons.filter((h) => h.midProbability !== null));

  if (sorted.length < 1) {
    return {
      projections: [],
      direction: "uncertain",
      confidence: 0,
      summary: "Insufficient data to forecast the next hour.",
      assumptions: [],
      invalidation: ["More horizon data needed for projection."],
    };
  }

  // Single horizon: project from that one data point using velocity
  if (sorted.length === 1) {
    const base = sorted[0].midProbability as number;
    const velocityPerMin = metrics.velocityPerHour / 60;
    const conf = computeForecastConfidence(metrics, 1, state) * 0.4;

    const projections: ForecastPoint[] = FORECAST_OFFSETS.map((offset) => {
      const raw = base + velocityPerMin * offset;
      const decay = 1 - offset / 120;
      const projected = Math.max(0.01, Math.min(0.99, base + (raw - base) * Math.max(decay, 0.3)));
      const spread = 0.02 + offset * 0.003;
      return {
        offsetMinutes: offset,
        projectedProbability: projected,
        upperBound: Math.min(0.99, projected + spread),
        lowerBound: Math.max(0.01, projected - spread),
        confidence: offset <= 15 ? "medium" : "low",
      };
    });

    return {
      projections,
      direction: classifyDirection(projections[projections.length - 1], state),
      confidence: conf,
      summary: `Single-horizon projection from ${formatHorizon(sorted[0].horizonMinutes)} data. Linear velocity extrapolation with decay dampening.`,
      assumptions: [
        `Current ${formatHorizon(sorted[0].horizonMinutes)} probability: ${pctStr(base, 1)}%`,
        `Velocity: ${pctStr(metrics.velocityPerHour, 2)}%/hour`,
        "Projection uses linear extrapolation with decay dampening.",
        "Single-horizon projection is inherently less reliable.",
      ],
      invalidation: [
        "Actual price movement contradicts velocity direction.",
        "Additional horizon data becomes available showing different trajectory.",
      ],
    };
  }

  const shortProb = sorted[0].midProbability as number;
  const longProb = sorted[sorted.length - 1].midProbability as number;

  // Current velocity (per minute)
  const timeSpan =
    sorted[sorted.length - 1].horizonMinutes - sorted[0].horizonMinutes;
  const rawVelocity =
    timeSpan > 0 ? (longProb - shortProb) / timeSpan : 0;

  // Adjust velocity based on momentum and persistence
  const momentumFactor = 1 + Math.min(Math.abs(metrics.momentum) * 3, 0.5);
  const persistenceFactor = 0.5 + metrics.persistence * 0.5;
  const adjustedVelocity = rawVelocity * momentumFactor * persistenceFactor;

  // Conviction decay reduces velocity over longer projections
  const decayRate = metrics.convictionDecay / (timeSpan || 60);

  // Base projection: where does the current trajectory point?
  const baseProjection = FORECAST_OFFSETS.map((offset) => {
    // Linear projection with decay dampening
    const decayDampening = Math.max(0, 1 - Math.abs(decayRate) * offset * 0.5);
    const projected = shortProb + adjustedVelocity * offset * decayDampening;

    // Uncertainty grows with time
    const uncertaintyGrowth = 0.02 * Math.sqrt(offset / 15);
    const qualityPenalty = (1 - metrics.dataQuality) * 0.05;
    const baseSpread = uncertaintyGrowth + qualityPenalty;

    // Divergence adds uncertainty
    const divergencePenalty = metrics.crossHorizonDivergence * 0.3;

    const totalSpread = baseSpread + divergencePenalty;
    const upper = Math.min(projected + totalSpread, 1);
    const lower = Math.max(projected - totalSpread, 0);

    const confidence: "high" | "medium" | "low" =
      offset <= 15 ? "high" : offset <= 30 ? "medium" : "low";

    return {
      offsetMinutes: offset,
      projectedProbability: Math.max(0, Math.min(1, projected)),
      upperBound: upper,
      lowerBound: lower,
      confidence,
    };
  });

  // Determine direction
  const finalProjection = baseProjection[baseProjection.length - 1];
  const direction = classifyDirection(finalProjection, state);

  // Forecast confidence
  const forecastConfidence = computeForecastConfidence(
    metrics,
    sorted.length,
    state
  );

  // Generate summary
  const summary = generateForecastSummary(
    direction,
    baseProjection,
    metrics,
    state
  );

  // Assumptions
  const assumptions = generateAssumptions(metrics, state);

  // Invalidation conditions
  const invalidation = generateInvalidationConditions(state, metrics);

  return {
    projections: baseProjection,
    direction,
    confidence: forecastConfidence,
    summary,
    assumptions,
    invalidation,
  };
}

function classifyDirection(
  final: ForecastPoint,
  state: MarketState
): "bullish" | "bearish" | "neutral" | "uncertain" {
  if (state === "insufficient-data" || state === "cross-horizon-conflict" || state === "single-horizon") {
    return "uncertain";
  }

  if (state === "reversal-warning") {
    return "uncertain";
  }

  const prob = final.projectedProbability;
  if (prob === null) return "uncertain";

  if (prob > BULLISH_THRESHOLD + 0.05) return "bullish";
  if (prob < BEARISH_THRESHOLD - 0.05) return "bearish";
  return "neutral";
}

function computeForecastConfidence(
  metrics: TemporalMetrics,
  horizonCount: number,
  state: MarketState
): number {
  let conf = 0;

  // Data quality contribution
  conf += metrics.dataQuality * 0.3;

  // Persistence reduces uncertainty
  conf += metrics.persistence * 0.2;

  // More horizons = more confidence
  conf += Math.min(horizonCount / 5, 1) * 0.2;

  // Direction strength adds confidence
  conf += metrics.directionStrength * 0.2;

  // Low divergence adds confidence
  conf += Math.max(0, 1 - metrics.crossHorizonDivergence * 5) * 0.1;

  // Penalty for uncertain states
  if (state === "cross-horizon-conflict") conf *= 0.5;
  if (state === "reversal-warning") conf *= 0.6;
  if (state === "insufficient-data") conf = 0;
  if (state === "single-horizon") conf *= 0.4;

  return Math.max(0, Math.min(1, conf));
}

function generateForecastSummary(
  direction: "bullish" | "bearish" | "neutral" | "uncertain",
  projections: ForecastPoint[],
  metrics: TemporalMetrics,
  state: MarketState
): string {
  if (direction === "uncertain") {
    return "LOW-CONFIDENCE SCENARIO: No reliable directional projection is favored because observed signals conflict across horizons. Projection is approximately flat — this is expected when the market lacks consensus across timeframes.";
  }

  const current = projections[0]?.projectedProbability;
  const future = projections[projections.length - 1]?.projectedProbability;

  if (current === null || future === null) {
    return "Unable to generate forecast — probability data unavailable.";
  }

  const change = future - current;
  const changeStr =
    Math.abs(change) < 0.01
      ? "relatively stable"
      : change > 0
      ? `increasing (~${pctStr(Math.abs(change), 1)}pp over 60min)`
      : `decreasing (~${pctStr(Math.abs(change), 1)}pp over 60min)`;

  const velocityStr =
    Math.abs(metrics.velocityPerHour) > 0.02
      ? `with ${Math.abs(metrics.velocityPerHour) > 0.05 ? "strong" : "moderate"} velocity`
      : "with low velocity";

  const stateContext =
    state === "reversal-warning"
      ? " Note: reversal detected — forecast may be unreliable."
      : state === "cross-horizon-conflict"
      ? " Note: horizon conflict detected — uncertainty elevated."
      : "";

  return `${direction} trajectory projected — probability ${changeStr} ${velocityStr}. Current: ${pctStr(current, 1)}% → Forecast: ${pctStr(future, 1)}% (60min).${stateContext}`;
}

function generateAssumptions(
  metrics: TemporalMetrics,
  state: MarketState
): string[] {
  const assumptions: string[] = [
    "Forecast assumes current market dynamics persist.",
    "Based on orderbook-implied probabilities, not external data.",
    `Velocity per hour: ${pctStr(metrics.velocityPerHour, 2)}%.`,
  ];

  if (metrics.persistence > 0.7) {
    assumptions.push("High persistence supports directional continuation.");
  } else if (metrics.persistence < 0.4) {
    assumptions.push("Low persistence suggests the direction may not hold.");
  }

  if (state === "reversal-warning") {
    assumptions.push("Reversal detected — forecast may be unreliable.");
  }

  if (metrics.dataQuality < 0.5) {
    assumptions.push("Data quality is limited — forecast has wider uncertainty.");
  }

  return assumptions;
}

function generateInvalidationConditions(
  state: MarketState,
  metrics: TemporalMetrics
): string[] {
  const conditions: string[] = [];

  conditions.push("A significant shift in the underlying asset price.");
  conditions.push("A large new order entering the orderbook.");

  if (metrics.crossHorizonDivergence > 0.08) {
    conditions.push("Current cross-horizon divergence may indicate imminent change.");
  }

  if (state === "bullish-acceleration" || state === "bearish-acceleration") {
    conditions.push("Acceleration states are more likely to revert than persistence states.");
  }

  if (metrics.dataQuality < 0.5) {
    conditions.push("Low data quality — the forecast may shift as more data arrives.");
  }

  return conditions;
}
