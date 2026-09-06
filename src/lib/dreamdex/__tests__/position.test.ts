import { describe, it, expect } from "vitest";
import {
  mapPositionStatus,
  createPositionFromFill,
  createEntryThesis,
  determineThesisStatus,
  compareThesis,
} from "../position";
import type { Position, EntryThesis, CurrentThesis, FillData } from "../position";

describe("mapPositionStatus", () => {
  it("returns voided when market voided", () => {
    expect(mapPositionStatus("Trading", true, 10, 10, null, 0, true)).toBe("voided");
  });

  it("returns voided when status is Voided", () => {
    expect(mapPositionStatus("Voided", true, 10, 10, null, 0, false)).toBe("voided");
  });

  it("returns resolved when market resolved and outcome matches", () => {
    expect(mapPositionStatus("Resolved", true, 10, 10, 0, 0, false)).toBe("redeemable");
  });

  it("returns resolved when market resolved and outcome doesn't match", () => {
    expect(mapPositionStatus("Resolved", true, 10, 10, 1, 0, false)).toBe("resolved");
  });

  it("returns locked when market locked", () => {
    expect(mapPositionStatus("Locked", true, 10, 10, null, 0, false)).toBe("locked");
  });

  it("returns pending when no fill", () => {
    expect(mapPositionStatus("Trading", false, 0, 10, null, 0, false)).toBe("pending");
  });

  it("returns partial when partially filled", () => {
    expect(mapPositionStatus("Trading", true, 5, 10, null, 0, false)).toBe("partial");
  });

  it("returns open when fully filled", () => {
    expect(mapPositionStatus("Trading", true, 10, 10, null, 0, false)).toBe("open");
  });
});

describe("createPositionFromFill", () => {
  const fill: FillData = {
    marketId: "0xabc",
    marketAddress: "0x123",
    poolAddress: "0x456",
    asset: "BTC",
    horizon: 60,
    intervalLabel: "1h",
    direction: "up",
    outcomeIndex: 0,
    fillQuantity: 10,
    fillPrice: 0.65,
    orderId: "order-1",
    transactionHash: "0xdef",
    wallet: "0xwallet",
    marketStatus: "Trading",
    quoteDecimals: 6,
    expiry: "2026-09-10",
    winningOutcome: null,
    voided: false,
  };

  it("creates position with correct fields", () => {
    const pos = createPositionFromFill(fill);
    expect(pos.asset).toBe("BTC");
    expect(pos.direction).toBe("up");
    expect(pos.quantity).toBe(10);
    expect(pos.entryPrice).toBe(0.65);
    expect(pos.status).toBe("open");
    expect(pos.marketStatus).toBe("Trading");
  });

  it("sets status to open for fully filled", () => {
    const pos = createPositionFromFill(fill);
    expect(pos.status).toBe("open");
  });
});

describe("createEntryThesis", () => {
  const position: Position = {
    id: "pos-1",
    wallet: "0xwallet",
    marketId: "0xabc",
    marketAddress: "0x123",
    asset: "BTC",
    horizon: 60,
    intervalLabel: "1h",
    direction: "up",
    outcomeIndex: 0,
    quantity: 10,
    entryPrice: 0.65,
    entryTimestamp: "2026-09-05T00:00:00Z",
    orderId: "order-1",
    transactionHash: "0xdef",
    status: "open",
    marketStatus: "Trading",
    quoteDecimals: 6,
    expiry: "2026-09-10",
    lastPrice: 0.65,
    winningOutcome: null,
    voided: false,
  };

  it("creates thesis from position and analysis", () => {
    const thesis = createEntryThesis(position, {
      regime: "bullish-persistence",
      signalStrength: 0.7,
      signalConfidence: 0.8,
      reversalRisk: 0.2,
      divergence: 0.1,
      persistence: 0.85,
      velocity: 0.05,
      dataQuality: 0.9,
      trajectoryState: "bullish-persistence",
      trajectoryScore: 0.75,
    });
    expect(thesis.positionId).toBe("pos-1");
    expect(thesis.asset).toBe("BTC");
    expect(thesis.entryProbability).toBe(0.65);
    expect(thesis.regime).toBe("bullish-persistence");
    expect(thesis.signalConfidence).toBe(0.8);
  });
});

describe("determineThesisStatus", () => {
  const entry: EntryThesis = {
    positionId: "pos-1",
    marketId: "0xabc",
    asset: "BTC",
    horizon: 60,
    direction: "up",
    entryProbability: 0.65,
    entryTimestamp: "2026-09-05T00:00:00Z",
    regime: "bullish-persistence",
    signalStrength: 0.7,
    signalConfidence: 0.8,
    reversalRisk: 0.2,
    divergence: 0.1,
    persistence: 0.85,
    velocity: 0.05,
    dataQuality: 0.9,
    analysisSnapshot: "{}",
    trajectoryState: "bullish-persistence",
    trajectoryScore: 0.75,
  };

  it("returns resolved when market is Resolved", () => {
    const current: CurrentThesis = {
      currentProbability: 0.8,
      regime: "bullish-acceleration",
      signalStrength: 0.8,
      signalConfidence: 0.85,
      reversalRisk: 0.1,
      divergence: 0.05,
      persistence: 0.9,
      velocity: 0.1,
      dataQuality: 0.95,
      trajectoryState: "bullish-acceleration",
      trajectoryScore: 0.85,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const result = determineThesisStatus(entry, current, "Resolved");
    expect(result.status).toBe("resolved");
  });

  it("returns invalidated when market voided", () => {
    const current: CurrentThesis = {
      currentProbability: 0.5,
      regime: "neutral",
      signalStrength: 0.5,
      signalConfidence: 0.5,
      reversalRisk: 0.5,
      divergence: 0.3,
      persistence: 0.5,
      velocity: 0,
      dataQuality: 0.8,
      trajectoryState: "neutral",
      trajectoryScore: 0.5,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const result = determineThesisStatus(entry, current, "Voided");
    expect(result.status).toBe("invalidated");
  });

  it("returns stale when data is stale", () => {
    const current: CurrentThesis = {
      currentProbability: 0.7,
      regime: "bullish-persistence",
      signalStrength: 0.7,
      signalConfidence: 0.8,
      reversalRisk: 0.2,
      divergence: 0.1,
      persistence: 0.85,
      velocity: 0.05,
      dataQuality: 0.9,
      trajectoryState: "bullish-persistence",
      trajectoryScore: 0.75,
      timestamp: new Date().toISOString(),
      stale: true,
    };
    const result = determineThesisStatus(entry, current, "Trading");
    expect(result.status).toBe("stale");
  });

  it("returns weakening when confidence drops significantly", () => {
    const current: CurrentThesis = {
      currentProbability: 0.6,
      regime: "bullish-decay",
      signalStrength: 0.5,
      signalConfidence: 0.5, // dropped from 0.8
      reversalRisk: 0.5,     // increased from 0.2
      divergence: 0.3,
      persistence: 0.6,
      velocity: 0.01,
      dataQuality: 0.8,
      trajectoryState: "bullish-decay",
      trajectoryScore: 0.55,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const result = determineThesisStatus(entry, current, "Trading");
    expect(result.status).toBe("weakening");
  });

  it("returns strengthening when confidence improves", () => {
    const current: CurrentThesis = {
      currentProbability: 0.72,
      regime: "bullish-acceleration",
      signalStrength: 0.8,
      signalConfidence: 0.9,  // improved from 0.8
      reversalRisk: 0.15,     // decreased from 0.2
      divergence: 0.05,
      persistence: 0.9,
      velocity: 0.08,
      dataQuality: 0.95,
      trajectoryState: "bullish-acceleration",
      trajectoryScore: 0.85,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const result = determineThesisStatus(entry, current, "Trading");
    expect(result.status).toBe("strengthening");
  });

  it("returns unchanged when stable", () => {
    const current: CurrentThesis = {
      currentProbability: 0.66,
      regime: "bullish-persistence",
      signalStrength: 0.7,
      signalConfidence: 0.82,
      reversalRisk: 0.18,
      divergence: 0.12,
      persistence: 0.83,
      velocity: 0.04,
      dataQuality: 0.88,
      trajectoryState: "bullish-persistence",
      trajectoryScore: 0.74,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const result = determineThesisStatus(entry, current, "Trading");
    expect(result.status).toBe("unchanged");
  });
});

describe("compareThesis", () => {
  const entry: EntryThesis = {
    positionId: "pos-1",
    marketId: "0xabc",
    asset: "BTC",
    horizon: 60,
    direction: "up",
    entryProbability: 0.65,
    entryTimestamp: "2026-09-05T00:00:00Z",
    regime: "bullish-persistence",
    signalStrength: 0.7,
    signalConfidence: 0.8,
    reversalRisk: 0.2,
    divergence: 0.1,
    persistence: 0.85,
    velocity: 0.05,
    dataQuality: 0.9,
    analysisSnapshot: "{}",
    trajectoryState: "bullish-persistence",
    trajectoryScore: 0.75,
  };

  it("computes deltas correctly", () => {
    const current: CurrentThesis = {
      currentProbability: 0.72,
      regime: "bullish-acceleration",
      signalStrength: 0.8,
      signalConfidence: 0.9,  // improved from 0.8 (delta = 0.1)
      reversalRisk: 0.15,
      divergence: 0.05,
      persistence: 0.9,
      velocity: 0.08,
      dataQuality: 0.95,
      trajectoryState: "bullish-acceleration",
      trajectoryScore: 0.85,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const comparison = compareThesis(entry, current, "Trading");
    expect(comparison.probabilityDelta).toBeCloseTo(0.07, 2);
    expect(comparison.confidenceDelta).toBeCloseTo(0.1, 2);
    expect(comparison.reversalRiskDelta).toBeCloseTo(-0.05, 2);
    expect(comparison.regimeChange).toBe("bullish-persistence → bullish-acceleration");
    expect(comparison.status).toBe("strengthening");
  });

  it("detects invalidation on direction reversal", () => {
    const current: CurrentThesis = {
      currentProbability: 0.45,  // dropped significantly from 0.65
      regime: "bearish-persistence",
      signalStrength: 0.6,
      signalConfidence: 0.7,
      reversalRisk: 0.3,
      divergence: 0.2,
      persistence: 0.7,
      velocity: -0.1,
      dataQuality: 0.85,
      trajectoryState: "bearish-persistence",
      trajectoryScore: 0.65,
      timestamp: new Date().toISOString(),
      stale: false,
    };
    const comparison = compareThesis(entry, current, "Trading");
    expect(comparison.status).toBe("invalidated");
  });
});
