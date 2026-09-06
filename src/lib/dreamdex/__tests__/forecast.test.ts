import { describe, it, expect } from "vitest";
import { mapNextHour } from "../forecast";
import type { HorizonProbability, TemporalMetrics } from "../temporal";

function makeHorizon(overrides: Partial<HorizonProbability>): HorizonProbability {
  return {
    horizonMinutes: 15,
    marketId: "test-market",
    yesProbability: 0.6,
    bidProbability: 0.59,
    askProbability: 0.61,
    midProbability: 0.6,
    spread: 0.02,
    volume: 10,
    secondsLeft: 3600,
    dataQuality: "high",
    quoteDecimals: 6,
    status: "Trading",
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<TemporalMetrics> = {}): TemporalMetrics {
  return {
    velocity: 0.001,
    velocityPerHour: 0.06,
    persistence: 0.8,
    convictionDecay: -0.02,
    crossHorizonDivergence: 0.03,
    dataQuality: 0.8,
    directionStrength: 0.3,
    momentum: 0.01,
    liquidity: 0.5,
    ...overrides,
  };
}

describe("mapNextHour", () => {
  it("returns insufficient-data for empty horizons", () => {
    const result = mapNextHour([], makeMetrics(), "insufficient-data");
    expect(result.direction).toBe("uncertain");
    expect(result.confidence).toBe(0);
    expect(result.projections).toHaveLength(0);
    expect(result.summary).toContain("Insufficient data");
  });

  it("returns single-horizon projection for single horizon", () => {
    const horizons = [makeHorizon({ midProbability: 0.6 })];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-persistence");
    expect(result.projections).toHaveLength(7);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.summary).toContain("Single-horizon");
  });

  it("projects bullish direction for bullish state", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-persistence");
    expect(result.direction).toBe("bullish");
    expect(result.projections.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("projects bearish direction for bearish state", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.35 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.3 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bearish-persistence");
    expect(result.direction).toBe("bearish");
    expect(result.projections.length).toBeGreaterThan(0);
  });

  it("returns uncertain for cross-horizon-conflict", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.7 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.3 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "cross-horizon-conflict");
    expect(result.direction).toBe("uncertain");
  });

  it("returns uncertain for reversal-warning", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 30, midProbability: 0.4 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.55 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "reversal-warning");
    expect(result.direction).toBe("uncertain");
  });

  it("has 7 forecast offsets (5, 10, 15, 20, 30, 45, 60)", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-persistence");
    expect(result.projections).toHaveLength(7);
    expect(result.projections.map((p) => p.offsetMinutes)).toEqual([
      5, 10, 15, 20, 30, 45, 60,
    ]);
  });

  it("forecasts stay within [0, 1]", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.95 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.98 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-acceleration");
    for (const p of result.projections) {
      if (p.projectedProbability !== null) {
        expect(p.projectedProbability).toBeGreaterThanOrEqual(0);
        expect(p.projectedProbability).toBeLessThanOrEqual(1);
      }
      expect(p.upperBound).toBeGreaterThanOrEqual(p.lowerBound);
      expect(p.lowerBound).toBeGreaterThanOrEqual(0);
      expect(p.upperBound).toBeLessThanOrEqual(1);
    }
  });

  it("earlier forecasts have higher confidence", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-persistence");
    const first = result.projections[0];
    const last = result.projections[result.projections.length - 1];
    expect(first.confidence).toBe("high");
    expect(last.confidence).toBe("low");
  });

  it("includes assumptions and invalidation", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-persistence");
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.invalidation.length).toBeGreaterThan(0);
  });

  it("generates a non-empty summary", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const result = mapNextHour(horizons, makeMetrics(), "bullish-persistence");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("reduces confidence with low data quality", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const highQ = mapNextHour(
      horizons,
      makeMetrics({ dataQuality: 1.0 }),
      "bullish-persistence"
    );
    const lowQ = mapNextHour(
      horizons,
      makeMetrics({ dataQuality: 0.2 }),
      "bullish-persistence"
    );
    expect(lowQ.confidence).toBeLessThan(highQ.confidence);
  });

  it("reduces confidence with high divergence", () => {
    const horizons = [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ];
    const lowDiv = mapNextHour(
      horizons,
      makeMetrics({ crossHorizonDivergence: 0.01 }),
      "bullish-persistence"
    );
    const highDiv = mapNextHour(
      horizons,
      makeMetrics({ crossHorizonDivergence: 0.15 }),
      "bullish-persistence"
    );
    expect(highDiv.confidence).toBeLessThan(lowDiv.confidence);
  });
});
