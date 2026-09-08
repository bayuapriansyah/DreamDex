import { describe, it, expect } from "vitest";
import { buildDecisionContext } from "../decision";
import type { TemporalTrajectory, HorizonProbability } from "../temporal";

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

function makeTrajectory(overrides: Partial<TemporalTrajectory> = {}): TemporalTrajectory {
  return {
    asset: "BTC",
    asOf: new Date().toISOString(),
    horizons: [
      makeHorizon({ horizonMinutes: 15, midProbability: 0.6 }),
      makeHorizon({ horizonMinutes: 30, midProbability: 0.62 }),
      makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
    ],
    metrics: {
      velocity: 0.001,
      velocityPerHour: 0.06,
      persistence: 0.8,
      convictionDecay: 0.05,
      crossHorizonDivergence: 0.03,
      dataQuality: 0.8,
      directionStrength: 0.3,
      momentum: 0.01,
      liquidity: 0.5,
    },
    state: "bullish-persistence",
    stateLabel: "Bullish Persistence",
    stateDescription: "Consistent bullish conviction across all horizons.",
    trajectoryScore: 0.6,
    confidence: 0.48,
    reversalRisk: 0.2,
    whatChanged: "Probability increases from 15m to 60m.",
    why: "Consistent bullish conviction.",
    evidence: ["Probability range: 60.0% → 65.0%"],
    conflictSeverity: 0.15,
    reversalScore: 0.05,
    ...overrides,
  };
}

describe("buildDecisionContext", () => {
  it("returns a complete DecisionContext", () => {
    const trajectory = makeTrajectory();
    const ctx = buildDecisionContext(trajectory);

    expect(ctx.timestamp).toBeDefined();
    expect(ctx.asset).toBe("BTC");
    expect(ctx.trajectory).toBe(trajectory);
    expect(ctx.regime).toBeDefined();
    expect(ctx.forecast).toBeDefined();
    expect(ctx.decisionQuality).toBeDefined();
    expect(ctx.strategies).toHaveLength(3);
    expect(ctx.recommendedStrategy).toBeDefined();
    expect(ctx.pipelineSummary).toBeDefined();
    expect(ctx.verdict).toBeDefined();
  });

  it("classifies regime for bullish-persistence", () => {
    const trajectory = makeTrajectory();
    const ctx = buildDecisionContext(trajectory);

    expect(ctx.regime.state).toBe("bullish-persistence");
    expect(ctx.regime.label).toBe("Bullish Persistence");
    expect(ctx.regime.strength).toBeGreaterThan(0);
    expect(["fleeting", "developing", "established"]).toContain(ctx.regime.durationHint);
  });

  it("classifies regime for insufficient-data", () => {
    const trajectory = makeTrajectory({
      state: "insufficient-data",
      stateLabel: "Insufficient Data",
      metrics: {
        velocity: 0, velocityPerHour: 0, persistence: 0,
        convictionDecay: 0, crossHorizonDivergence: 0,
        dataQuality: 0, directionStrength: 0, momentum: 0, liquidity: 0,
      },
      confidence: 0,
      reversalRisk: 0,
      trajectoryScore: 0,
    });
    const ctx = buildDecisionContext(trajectory);

    expect(ctx.regime.state).toBe("insufficient-data");
    expect(ctx.regime.strength).toBe(0);
    expect(ctx.regime.durationHint).toBe("fleeting");
  });

  it("classifies regime for cross-horizon-conflict", () => {
    const trajectory = makeTrajectory({
      state: "cross-horizon-conflict",
      stateLabel: "Cross-Horizon Conflict",
      metrics: {
        velocity: 0, velocityPerHour: 0, persistence: 0.2,
        convictionDecay: 0, crossHorizonDivergence: 0.15,
        dataQuality: 0.6, directionStrength: 0.1, momentum: 0, liquidity: 0.3,
      },
    });
    const ctx = buildDecisionContext(trajectory);

    expect(ctx.regime.state).toBe("cross-horizon-conflict");
    expect(ctx.regime.strength).toBeGreaterThan(0);
    expect(ctx.regime.durationHint).toBe("fleeting");
  });

  it("computes decision quality", () => {
    const trajectory = makeTrajectory();
    const ctx = buildDecisionContext(trajectory);

    expect(ctx.decisionQuality.dataQuality).toBe(0.8);
    expect(ctx.decisionQuality.trajectoryScore).toBe(0.6);
    expect(ctx.decisionQuality.confidence).toBe(0.48);
    expect(ctx.decisionQuality.reversalRisk).toBe(0.2);
    expect(ctx.decisionQuality.composite).toBeGreaterThan(0);
    expect(ctx.decisionQuality.composite).toBeLessThanOrEqual(1);
    expect(["strong", "moderate", "weak", "unusable"]).toContain(ctx.decisionQuality.tier);
  });

  it("generates 3 strategies", () => {
    const trajectory = makeTrajectory();
    const ctx = buildDecisionContext(trajectory);

    expect(ctx.strategies).toHaveLength(3);
    const types = ctx.strategies.map((s) => s.type);
    expect(types).toContain("conservative");
    expect(types).toContain("balanced");
    expect(types).toContain("aggressive");
  });

  it("recommends conservative for unusable quality", () => {
    const trajectory = makeTrajectory({
      metrics: {
        velocity: 0, velocityPerHour: 0, persistence: 0,
        convictionDecay: 0, crossHorizonDivergence: 0,
        dataQuality: 0, directionStrength: 0, momentum: 0, liquidity: 0,
      },
      trajectoryScore: 0,
      confidence: 0,
    });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.recommendedStrategy).toBe("conservative");
  });

  it("recommends aggressive for strong acceleration with low risk", () => {
    const trajectory = makeTrajectory({
      state: "bullish-acceleration",
      stateLabel: "Bullish Acceleration",
      trajectoryScore: 0.8,
      confidence: 0.6,
      reversalRisk: 0.15,
    });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.recommendedStrategy).toBe("aggressive");
  });

  it("recommends conservative for high reversal risk", () => {
    const trajectory = makeTrajectory({
      reversalRisk: 0.75,
    });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.recommendedStrategy).toBe("conservative");
  });

  it("pipelineSummary includes asset name", () => {
    const trajectory = makeTrajectory({ asset: "ETH" });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.pipelineSummary).toContain("ETH");
  });

  it("verdict is non-empty", () => {
    const trajectory = makeTrajectory();
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.verdict.length).toBeGreaterThan(0);
  });

  it("verdict mentions INSUFFICIENT DATA for insufficient-data", () => {
    const trajectory = makeTrajectory({
      state: "insufficient-data",
      stateLabel: "Insufficient Data",
      metrics: {
        velocity: 0, velocityPerHour: 0, persistence: 0,
        convictionDecay: 0, crossHorizonDivergence: 0,
        dataQuality: 0, directionStrength: 0, momentum: 0, liquidity: 0,
      },
      confidence: 0,
      reversalRisk: 0,
      trajectoryScore: 0,
    });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.verdict).toContain("INSUFFICIENT DATA");
  });

  it("regime durationHint is established for stable metrics", () => {
    const trajectory = makeTrajectory({
      metrics: {
        velocity: 0.001,
        velocityPerHour: 0.01,
        persistence: 0.85,
        convictionDecay: 0.01,
        crossHorizonDivergence: 0.02,
        dataQuality: 0.9,
        directionStrength: 0.4,
        momentum: 0.005,
        liquidity: 0.6,
      },
    });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.regime.durationHint).toBe("established");
  });

  it("regime durationHint is fleeting for high momentum", () => {
    const trajectory = makeTrajectory({
      metrics: {
        velocity: 0.003,
        velocityPerHour: 0.18,
        persistence: 0.6,
        convictionDecay: 0.05,
        crossHorizonDivergence: 0.05,
        dataQuality: 0.7,
        directionStrength: 0.5,
        momentum: 0.08,
        liquidity: 0.4,
      },
    });
    const ctx = buildDecisionContext(trajectory);
    expect(ctx.regime.durationHint).toBe("fleeting");
  });
});
