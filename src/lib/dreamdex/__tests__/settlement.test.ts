import { describe, it, expect } from "vitest";
import {
  isTradeable,
  isActive,
  isTerminal,
  isLocked,
  lifecyclePrecedes,
} from "../types";
import {
  mapPositionStatus,
  determineThesisStatus,
} from "../position";

/* ═══════════════════════════════════════════════════════ */
/* Market Lifecycle Helpers                                */
/* ═══════════════════════════════════════════════════════ */

describe("Market lifecycle helpers", () => {
  it("isTradeable only for Trading", () => {
    expect(isTradeable("Trading")).toBe(true);
    expect(isTradeable("Listed")).toBe(false);
    expect(isTradeable("Locked")).toBe(false);
    expect(isTradeable("Resolved")).toBe(false);
    expect(isTradeable("Voided")).toBe(false);
    expect(isTradeable("Finalized")).toBe(false);
    expect(isTradeable("Settling")).toBe(false);
  });

  it("isActive for Trading, Locked, Settling", () => {
    expect(isActive("Trading")).toBe(true);
    expect(isActive("Locked")).toBe(true);
    expect(isActive("Settling")).toBe(true);
    expect(isActive("Listed")).toBe(false);
    expect(isActive("Resolved")).toBe(false);
    expect(isActive("Voided")).toBe(false);
    expect(isActive("Finalized")).toBe(false);
  });

  it("isTerminal for Resolved, Voided, Finalized", () => {
    expect(isTerminal("Resolved")).toBe(true);
    expect(isTerminal("Voided")).toBe(true);
    expect(isTerminal("Finalized")).toBe(true);
    expect(isTerminal("Trading")).toBe(false);
    expect(isTerminal("Locked")).toBe(false);
    expect(isTerminal("Settling")).toBe(false);
    expect(isTerminal("Listed")).toBe(false);
  });

  it("isLocked for Locked, Settling", () => {
    expect(isLocked("Locked")).toBe(true);
    expect(isLocked("Settling")).toBe(true);
    expect(isLocked("Trading")).toBe(false);
    expect(isLocked("Resolved")).toBe(false);
  });

  it("lifecyclePrecedes order", () => {
    expect(lifecyclePrecedes("Listed", "Trading")).toBe(true);
    expect(lifecyclePrecedes("Trading", "Locked")).toBe(true);
    expect(lifecyclePrecedes("Locked", "Settling")).toBe(true);
    expect(lifecyclePrecedes("Settling", "Resolved")).toBe(true);
    expect(lifecyclePrecedes("Resolved", "Finalized")).toBe(true);
    expect(lifecyclePrecedes("Trading", "Trading")).toBe(false);
    expect(lifecyclePrecedes("Locked", "Trading")).toBe(false);
    expect(lifecyclePrecedes("Resolved", "Locked")).toBe(false);
  });

  it("Voided is same tier as Resolved", () => {
    expect(lifecyclePrecedes("Settling", "Voided")).toBe(true);
    expect(lifecyclePrecedes("Voided", "Finalized")).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════ */
/* Position Status Mapping                                */
/* ═══════════════════════════════════════════════════════ */

describe("mapPositionStatus", () => {
  it("returns voided when market voided", () => {
    expect(mapPositionStatus("Trading", true, 10, 10, null, 0, true)).toBe("voided");
    expect(mapPositionStatus("Voided", true, 10, 10, null, 0, false)).toBe("voided");
  });

  it("returns redeemable when resolved and winning outcome matches", () => {
    expect(mapPositionStatus("Resolved", true, 10, 10, 0, 0, false)).toBe("redeemable");
    expect(mapPositionStatus("Resolved", true, 10, 10, 1, 1, false)).toBe("redeemable");
    expect(mapPositionStatus("Finalized", true, 10, 10, 0, 0, false)).toBe("redeemable");
  });

  it("returns resolved when resolved but losing side", () => {
    expect(mapPositionStatus("Resolved", true, 10, 10, 0, 1, false)).toBe("resolved");
    expect(mapPositionStatus("Resolved", true, 10, 10, 1, 0, false)).toBe("resolved");
  });

  it("returns locked when market locked", () => {
    expect(mapPositionStatus("Locked", true, 10, 10, null, 0, false)).toBe("locked");
    expect(mapPositionStatus("Settling", true, 10, 10, null, 0, false)).toBe("locked");
  });

  it("returns open when fully filled and trading", () => {
    expect(mapPositionStatus("Trading", true, 10, 10, null, 0, false)).toBe("open");
  });

  it("returns pending when no fill", () => {
    expect(mapPositionStatus("Trading", false, 0, 10, null, 0, false)).toBe("pending");
  });

  it("returns partial when partially filled", () => {
    expect(mapPositionStatus("Trading", true, 5, 10, null, 0, false)).toBe("partial");
  });
});

/* ═══════════════════════════════════════════════════════ */
/* Thesis Status Rules                                    */
/* ═══════════════════════════════════════════════════════ */

describe("determineThesisStatus", () => {
  const baseEntry = {
    positionId: "test",
    marketId: "test-market",
    asset: "BTC",
    horizon: 60,
    direction: "up" as const,
    entryProbability: 0.6,
    entryTimestamp: "2026-01-01T00:00:00Z",
    regime: "bullish-persistence",
    signalStrength: 0.7,
    signalConfidence: 0.65,
    reversalRisk: 0.2,
    divergence: 0.1,
    persistence: 0.7,
    velocity: 0.05,
    dataQuality: 0.8,
    analysisSnapshot: "{}",
    trajectoryState: "bullish-persistence",
    trajectoryScore: 0.7,
    timestamp: "2026-09-05T00:00:00Z",
  };

  it("returns resolved for Resolved market", () => {
    const result = determineThesisStatus(baseEntry, { ...baseEntry, currentProbability: 0.8, stale: false }, "Resolved");
    expect(result.status).toBe("resolved");
  });

  it("returns resolved for Finalized market", () => {
    const result = determineThesisStatus(baseEntry, { ...baseEntry, currentProbability: 0.8, stale: false }, "Finalized");
    expect(result.status).toBe("resolved");
  });

  it("returns invalidated for Voided market", () => {
    const result = determineThesisStatus(baseEntry, { ...baseEntry, currentProbability: 0.5, stale: false }, "Voided");
    expect(result.status).toBe("invalidated");
  });

  it("returns stale when data is stale", () => {
    const result = determineThesisStatus(baseEntry, { ...baseEntry, currentProbability: 0.5, stale: true }, "Trading");
    expect(result.status).toBe("stale");
  });

  it("invalidates when direction reversed with opposing regime", () => {
    const current = {
      ...baseEntry,
      currentProbability: 0.5, // dropped from 0.6 by >5pp
      signalConfidence: 0.65,
      reversalRisk: 0.2,
      divergence: 0.1,
      regime: "bearish-persistence",
      stale: false,
    };
    const result = determineThesisStatus(baseEntry, current, "Trading");
    expect(result.status).toBe("invalidated");
  });

  it("weakens on confidence drop", () => {
    const current = {
      ...baseEntry,
      currentProbability: 0.6,
      signalConfidence: 0.4, // dropped >15pp from 0.65
      reversalRisk: 0.2,
      divergence: 0.1,
      regime: "bullish-persistence",
      stale: false,
    };
    const result = determineThesisStatus(baseEntry, current, "Trading");
    expect(result.status).toBe("weakening");
  });

  it("returns unchanged when stable", () => {
    const current = {
      ...baseEntry,
      currentProbability: 0.61,
      signalConfidence: 0.66,
      reversalRisk: 0.21,
      divergence: 0.11,
      regime: "bullish-persistence",
      stale: false,
    };
    const result = determineThesisStatus(baseEntry, current, "Trading");
    expect(result.status).toBe("unchanged");
  });
});
