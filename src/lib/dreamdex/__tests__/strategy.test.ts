import { describe, it, expect } from "vitest";
import {
  composeStrategies,
  computeExpectedEdge,
  computeConflictSeverity,
  computeReversalScore,
  type ExecutionCostConfig,
} from "../strategy";
import type { TemporalTrajectory, HorizonProbability, TemporalMetrics } from "../temporal";

// ─────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────

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
    convictionDecay: 0.05,
    crossHorizonDivergence: 0.03,
    dataQuality: 0.8,
    directionStrength: 0.3,
    momentum: 0.01,
    liquidity: 0.5,
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
    metrics: makeMetrics(),
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

const ZERO_COSTS: ExecutionCostConfig = {
  feeRate: 0,
  halfSpread: 0,
  expectedSlippage: 0,
};

const COSTS_WITH_FEES: ExecutionCostConfig = {
  feeRate: 0.01,
  halfSpread: 0.015,
  expectedSlippage: 0.01,
};

// ─────────────────────────────────────────────
// Directional Expected Edge Tests
// ─────────────────────────────────────────────

describe("computeExpectedEdge", () => {
  it("BUY: positive when fair > entry (no costs)", () => {
    const edge = computeExpectedEdge("buy", 0.60, 0.55, ZERO_COSTS);
    expect(edge).toBeCloseTo(0.05, 4);
  });

  it("BUY: negative when fair < entry (no costs)", () => {
    const edge = computeExpectedEdge("buy", 0.50, 0.55, ZERO_COSTS);
    expect(edge).toBeCloseTo(-0.05, 4);
  });

  it("SELL: positive when entry > fair (no costs)", () => {
    const edge = computeExpectedEdge("sell", 0.40, 0.45, ZERO_COSTS);
    expect(edge).toBeCloseTo(0.05, 4);
  });

  it("SELL: negative when entry < fair (no costs)", () => {
    const edge = computeExpectedEdge("sell", 0.50, 0.45, ZERO_COSTS);
    expect(edge).toBeCloseTo(-0.05, 4);
  });

  it("edge becomes negative after costs", () => {
    const edge = computeExpectedEdge("buy", 0.55, 0.52, COSTS_WITH_FEES);
    // grossEdge = 0.03, totalCosts = 0.035
    expect(edge).toBeCloseTo(-0.005, 4);
  });

  it("edge remains positive when gross > costs", () => {
    const edge = computeExpectedEdge("buy", 0.60, 0.52, COSTS_WITH_FEES);
    // grossEdge = 0.08, totalCosts = 0.035
    expect(edge).toBeCloseTo(0.045, 4);
  });

  it("total costs are sum of feeRate + halfSpread + expectedSlippage", () => {
    const costs: ExecutionCostConfig = {
      feeRate: 0.02,
      halfSpread: 0.03,
      expectedSlippage: 0.04,
    };
    const edge = computeExpectedEdge("buy", 0.60, 0.50, costs);
    // grossEdge = 0.10, totalCosts = 0.09
    expect(edge).toBeCloseTo(0.01, 4);
  });

  it("BUY zero edge when fair == entry", () => {
    const edge = computeExpectedEdge("buy", 0.55, 0.55, ZERO_COSTS);
    expect(edge).toBeCloseTo(0, 4);
  });

  it("SELL zero edge when fair == entry", () => {
    const edge = computeExpectedEdge("sell", 0.55, 0.55, ZERO_COSTS);
    expect(edge).toBeCloseTo(0, 4);
  });
});

// ─────────────────────────────────────────────
// Conflict Severity Tests
// ─────────────────────────────────────────────

describe("computeConflictSeverity", () => {
  it("returns 0 for no divergence", () => {
    expect(computeConflictSeverity(makeMetrics({ crossHorizonDivergence: 0 }))).toBe(0);
  });

  it("returns low for small divergence", () => {
    const severity = computeConflictSeverity(makeMetrics({ crossHorizonDivergence: 0.03 }));
    expect(severity).toBeCloseTo(0.15, 2);
  });

  it("returns medium for moderate divergence", () => {
    const severity = computeConflictSeverity(makeMetrics({ crossHorizonDivergence: 0.15 }));
    expect(severity).toBeCloseTo(0.75, 2);
  });

  it("returns 1.0 for maximum divergence", () => {
    const severity = computeConflictSeverity(makeMetrics({ crossHorizonDivergence: 0.5 }));
    expect(severity).toBe(1.0);
  });

  it("is capped at 1.0", () => {
    const severity = computeConflictSeverity(makeMetrics({ crossHorizonDivergence: 1.0 }));
    expect(severity).toBe(1.0);
  });
});

// ─────────────────────────────────────────────
// Reversal Score Tests
// ─────────────────────────────────────────────

describe("computeReversalScore", () => {
  it("returns low score for stable trajectory", () => {
    const trajectory = makeTrajectory({
      metrics: makeMetrics({ velocityPerHour: 0.01, crossHorizonDivergence: 0.02 }),
      horizons: [
        makeHorizon({ horizonMinutes: 15, midProbability: 0.60 }),
        makeHorizon({ horizonMinutes: 30, midProbability: 0.62 }),
        makeHorizon({ horizonMinutes: 60, midProbability: 0.64 }),
      ],
    });
    const score = computeReversalScore(trajectory.metrics, trajectory.horizons);
    expect(score).toBeLessThan(0.3);
  });

  it("returns higher score with reversal pattern", () => {
    const trajectory = makeTrajectory({
      metrics: makeMetrics({ velocityPerHour: 0.05, crossHorizonDivergence: 0.1 }),
      horizons: [
        makeHorizon({ horizonMinutes: 15, midProbability: 0.70 }),
        makeHorizon({ horizonMinutes: 30, midProbability: 0.55 }),
        makeHorizon({ horizonMinutes: 60, midProbability: 0.65 }),
      ],
    });
    const score = computeReversalScore(trajectory.metrics, trajectory.horizons);
    expect(score).toBeGreaterThan(0.3);
  });

  it("is capped at 1.0", () => {
    const trajectory = makeTrajectory({
      metrics: makeMetrics({ velocityPerHour: 0.2, crossHorizonDivergence: 0.5 }),
      horizons: [
        makeHorizon({ horizonMinutes: 15, midProbability: 0.80 }),
        makeHorizon({ horizonMinutes: 30, midProbability: 0.50 }),
        makeHorizon({ horizonMinutes: 60, midProbability: 0.20 }),
      ],
    });
    const score = computeReversalScore(trajectory.metrics, trajectory.horizons);
    expect(score).toBeLessThanOrEqual(1.0);
  });
});

// ─────────────────────────────────────────────
// composeStrategies Tests
// ─────────────────────────────────────────────

describe("composeStrategies", () => {
  it("returns 3 strategies", () => {
    const strategies = composeStrategies(makeTrajectory());
    expect(strategies).toHaveLength(3);
    expect(strategies.map((s) => s.type)).toEqual([
      "conservative",
      "balanced",
      "aggressive",
    ]);
  });

  it("each strategy has required fields", () => {
    const strategies = composeStrategies(makeTrajectory());
    for (const s of strategies) {
      expect(s.type).toBeDefined();
      expect(s.label).toBeDefined();
      expect(s.side).toBeDefined();
      expect(s.reasoning).toBeDefined();
      expect(typeof s.isExecutable).toBe("boolean");
      expect(typeof s.expectedEdge).toBe("number");
      expect(typeof s.conflictSeverity).toBe("number");
      expect(typeof s.reversalScore).toBe("number");
    }
  });
});

// ─────────────────────────────────────────────
// Data Gates
// ─────────────────────────────────────────────

describe("data gates", () => {
  it("insufficient-data → all HOLD", () => {
    const trajectory = makeTrajectory({
      state: "insufficient-data",
      stateLabel: "Insufficient Data",
      metrics: makeMetrics({ dataQuality: 0 }),
      conflictSeverity: 0,
      reversalScore: 0,
    });
    const strategies = composeStrategies(trajectory);
    expect(strategies.every((s) => s.side === "hold")).toBe(true);
    expect(strategies.every((s) => s.isExecutable === false)).toBe(true);
  });

  it("single-horizon → all HOLD", () => {
    const trajectory = makeTrajectory({
      state: "single-horizon",
      stateLabel: "Single Horizon",
      conflictSeverity: 0,
      reversalScore: 0,
    });
    const strategies = composeStrategies(trajectory);
    expect(strategies.every((s) => s.side === "hold")).toBe(true);
    expect(strategies.every((s) => s.isExecutable === false)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Conflict Severity Tests
// ─────────────────────────────────────────────

describe("conflict severity in strategies", () => {
  it("low conflict → normal execution", () => {
    const trajectory = makeTrajectory({
      state: "bullish-persistence",
      conflictSeverity: 0.1,
      reversalScore: 0.05,
    });
    const strategies = composeStrategies(trajectory);
    const balanced = strategies.find((s) => s.type === "balanced")!;
    expect(balanced.isExecutable).toBe(true);
  });

  it("medium conflict → reduced size for balanced", () => {
    const normalTrajectory = makeTrajectory({
      state: "bullish-persistence",
      conflictSeverity: 0.1,
      reversalScore: 0.05,
    });
    const conflictTrajectory = makeTrajectory({
      state: "cross-horizon-conflict",
      conflictSeverity: 0.5,
      reversalScore: 0.1,
    });
    const normalSize = composeStrategies(normalTrajectory).find(
      (s) => s.type === "balanced"
    )!.suggestedSize;
    const conflictSize = composeStrategies(conflictTrajectory).find(
      (s) => s.type === "balanced"
    )!.suggestedSize;
    expect(conflictSize).toBeLessThanOrEqual(normalSize);
  });

  it("high conflict → Conservative HOLD, Aggressive may enter", () => {
    const trajectory = makeTrajectory({
      state: "cross-horizon-conflict",
      conflictSeverity: 0.7,
      reversalScore: 0.2,
    });
    const strategies = composeStrategies(trajectory);
    const conservative = strategies.find((s) => s.type === "conservative")!;
    // Conservative hard gate is 0.5, aggressive is 1.0
    expect(conservative.isExecutable).toBe(false);
    // Aggressive may or may not be executable depending on edge
  });
});

// ─────────────────────────────────────────────
// Reversal Score Tests
// ─────────────────────────────────────────────

describe("reversal score in strategies", () => {
  it("low reversal → normal", () => {
    const trajectory = makeTrajectory({
      state: "bullish-persistence",
      conflictSeverity: 0.1,
      reversalScore: 0.05,
    });
    const strategies = composeStrategies(trajectory);
    const balanced = strategies.find((s) => s.type === "balanced")!;
    expect(balanced.isExecutable).toBe(true);
  });

  it("medium reversal → reduced size", () => {
    const normalTrajectory = makeTrajectory({
      state: "bullish-persistence",
      conflictSeverity: 0.1,
      reversalScore: 0.05,
    });
    const reversalTrajectory = makeTrajectory({
      state: "reversal-warning",
      conflictSeverity: 0.1,
      reversalScore: 0.4,
    });
    const normalSize = composeStrategies(normalTrajectory).find(
      (s) => s.type === "balanced"
    )!.suggestedSize;
    const reversalSize = composeStrategies(reversalTrajectory).find(
      (s) => s.type === "balanced"
    )!.suggestedSize;
    expect(reversalSize).toBeLessThanOrEqual(normalSize);
  });

  it("high reversal → Conservative/Balanced HOLD", () => {
    const trajectory = makeTrajectory({
      state: "reversal-warning",
      conflictSeverity: 0.1,
      reversalScore: 0.7,
    });
    const strategies = composeStrategies(trajectory);
    const conservative = strategies.find((s) => s.type === "conservative")!;
    const balanced = strategies.find((s) => s.type === "balanced")!;
    // Conservative hard gate is 0.3, balanced is 0.6
    expect(conservative.isExecutable).toBe(false);
    expect(balanced.isExecutable).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Cost Sensitivity Tests
// ─────────────────────────────────────────────

describe("cost sensitivity", () => {
  it("profitable before costs → HOLD after costs when edge eliminated", () => {
    // Construct a trajectory where the edge is small
    const trajectory = makeTrajectory({
      horizons: [
        makeHorizon({ horizonMinutes: 15, midProbability: 0.55 }),
        makeHorizon({ horizonMinutes: 30, midProbability: 0.57 }),
        makeHorizon({ horizonMinutes: 60, midProbability: 0.59 }),
      ],
      state: "bullish-persistence",
      conflictSeverity: 0.1,
      reversalScore: 0.05,
    });
    const costs: ExecutionCostConfig = {
      feeRate: 0.02,
      halfSpread: 0.02,
      expectedSlippage: 0.01,
    };
    const strategies = composeStrategies(trajectory, costs);
    const balanced = strategies.find((s) => s.type === "balanced")!;
    // If edge was small, costs may push it below minEdge
    if (balanced.expectedEdge < 0.03) {
      expect(balanced.isExecutable).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────
// Strategy Differentiation Tests
// ─────────────────────────────────────────────

describe("strategy differentiation", () => {
  it("conservative has smaller size than aggressive", () => {
    const strategies = composeStrategies(makeTrajectory());
    const conservative = strategies.find((s) => s.type === "conservative")!;
    const aggressive = strategies.find((s) => s.type === "aggressive")!;
    if (conservative.isExecutable && aggressive.isExecutable) {
      expect(conservative.suggestedSize).toBeLessThanOrEqual(aggressive.suggestedSize);
    }
  });

  it("conservative has tighter stops than aggressive", () => {
    const strategies = composeStrategies(makeTrajectory());
    const conservative = strategies.find((s) => s.type === "conservative")!;
    const aggressive = strategies.find((s) => s.type === "aggressive")!;
    if (conservative.isExecutable && aggressive.isExecutable) {
      const conservativeStop = Math.abs(conservative.maxEntryPrice - conservative.stopLoss);
      const aggressiveStop = Math.abs(aggressive.maxEntryPrice - aggressive.stopLoss);
      expect(conservativeStop).toBeLessThanOrEqual(aggressiveStop);
    }
  });

  it("conservative requires higher minEdge than aggressive", () => {
    // Conservative minEdge=0.05, balanced=0.03, aggressive=0.02
    const strategies = composeStrategies(makeTrajectory());
    const conservative = strategies.find((s) => s.type === "conservative")!;
    const aggressive = strategies.find((s) => s.type === "aggressive")!;
    // If conservative is executable, aggressive should also be (lower threshold)
    if (conservative.isExecutable) {
      expect(aggressive.isExecutable).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// Position Size Cap Tests
// ─────────────────────────────────────────────

describe("position size cap", () => {
  it("position size does not exceed maximum", () => {
    // Very strong trajectory
    const trajectory = makeTrajectory({
      metrics: makeMetrics({
        dataQuality: 1.0,
        liquidity: 1.0,
        persistence: 1.0,
        directionStrength: 0.8,
        velocityPerHour: 0.05,
      }),
      trajectoryScore: 0.9,
      confidence: 0.9,
      conflictSeverity: 0,
      reversalScore: 0,
    });
    const strategies = composeStrategies(trajectory);
    for (const s of strategies) {
      expect(s.suggestedSize).toBeLessThanOrEqual(10);
    }
  });
});

// ─────────────────────────────────────────────
// Block Reason Tests
// ─────────────────────────────────────────────

describe("block reasons", () => {
  it("has blockReason when not executable", () => {
    const trajectory = makeTrajectory({
      state: "insufficient-data",
      conflictSeverity: 0,
      reversalScore: 0,
    });
    const strategies = composeStrategies(trajectory);
    for (const s of strategies) {
      if (!s.isExecutable) {
        expect(s.blockReason).toBeDefined();
        expect(s.blockReason!.length).toBeGreaterThan(0);
      }
    }
  });

  it("no blockReason when executable", () => {
    const strategies = composeStrategies(makeTrajectory());
    for (const s of strategies) {
      if (s.isExecutable) {
        expect(s.blockReason).toBeNull();
      }
    }
  });
});
