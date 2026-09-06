import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectMaterialChange,
  deriveFollowStatus,
  type FollowedSignal,
} from "../following";

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: mockLocalStorage });
  vi.stubGlobal("localStorage", mockLocalStorage);
  mockLocalStorage.clear();
});

function makeFollow(overrides: Partial<FollowedSignal> = {}): FollowedSignal {
  return {
    id: "BTC-60",
    marketId: "market-1",
    asset: "BTC",
    horizonMinutes: 60,
    baselineProbability: 0.7,
    baselineRegime: "bullish-acceleration",
    baselineRegimeLabel: "Bullish Acceleration",
    baselineConfidence: 0.8,
    baselineReversalRisk: 0.15,
    baselineDivergence: 0.05,
    baselineVelocity: 0.04,
    baselineActionability: "high",
    followedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    status: "active",
    ...overrides,
  };
}

describe("detectMaterialChange", () => {
  it("detects probability shift above threshold", () => {
    const follow = makeFollow();
    const { changed, changes } = detectMaterialChange(follow, {
      probability: 0.8,
      state: "bullish-acceleration",
      confidence: 0.8,
      reversalRisk: 0.15,
      divergence: 0.05,
      velocity: 0.04,
      actionability: "high",
    });
    expect(changed).toBe(true);
    const probChange = changes.find((c) => c.field === "probability");
    expect(probChange?.material).toBe(true);
    expect(probChange?.delta).toBeCloseTo(0.1);
  });

  it("does not detect small probability shift", () => {
    const follow = makeFollow();
    const { changed } = detectMaterialChange(follow, {
      probability: 0.72,
      state: "bullish-acceleration",
      confidence: 0.8,
      reversalRisk: 0.15,
      divergence: 0.05,
      velocity: 0.04,
      actionability: "high",
    });
    expect(changed).toBe(false);
  });

  it("detects regime change", () => {
    const follow = makeFollow();
    const { changed, changes } = detectMaterialChange(follow, {
      probability: 0.7,
      state: "bearish-persistence",
      confidence: 0.8,
      reversalRisk: 0.15,
      divergence: 0.05,
      velocity: 0.04,
      actionability: "high",
    });
    expect(changed).toBe(true);
    const regimeChange = changes.find((c) => c.field === "regime");
    expect(regimeChange?.material).toBe(true);
  });

  it("detects confidence change above threshold", () => {
    const follow = makeFollow({ baselineConfidence: 0.8 });
    const { changed, changes } = detectMaterialChange(follow, {
      probability: 0.7,
      state: "bullish-acceleration",
      confidence: 0.65,
      reversalRisk: 0.15,
      divergence: 0.05,
      velocity: 0.04,
      actionability: "high",
    });
    expect(changed).toBe(true);
    const confChange = changes.find((c) => c.field === "confidence");
    expect(confChange?.material).toBe(true);
  });

  it("detects reversal risk change above threshold", () => {
    const follow = makeFollow({ baselineReversalRisk: 0.15 });
    const { changed, changes } = detectMaterialChange(follow, {
      probability: 0.7,
      state: "bullish-acceleration",
      confidence: 0.8,
      reversalRisk: 0.35,
      divergence: 0.05,
      velocity: 0.04,
      actionability: "high",
    });
    expect(changed).toBe(true);
    const riskChange = changes.find((c) => c.field === "reversalRisk");
    expect(riskChange?.material).toBe(true);
  });

  it("detects actionability change", () => {
    const follow = makeFollow({ baselineActionability: "high" });
    const { changed, changes } = detectMaterialChange(follow, {
      probability: 0.7,
      state: "bullish-acceleration",
      confidence: 0.8,
      reversalRisk: 0.15,
      divergence: 0.05,
      velocity: 0.04,
      actionability: "low",
    });
    expect(changed).toBe(true);
    const actChange = changes.find((c) => c.field === "actionability");
    expect(actChange?.material).toBe(true);
  });

  it("does not spam when nothing changes materially", () => {
    const follow = makeFollow();
    const { changed } = detectMaterialChange(follow, {
      probability: 0.71,
      state: "bullish-acceleration",
      confidence: 0.81,
      reversalRisk: 0.16,
      divergence: 0.06,
      velocity: 0.045,
      actionability: "high",
    });
    expect(changed).toBe(false);
  });
});

describe("deriveFollowStatus", () => {
  it("returns STRENGTHENING when probability increases significantly", () => {
    const follow = makeFollow({ baselineProbability: 0.6 });
    const result = deriveFollowStatus(follow, {
      probability: 0.7,
      state: "bullish-acceleration",
      confidence: 0.8,
      reversalRisk: 0.15,
    });
    expect(result.status).toBe("STRENGTHENING");
    expect(result.delta).toBe(10);
  });

  it("returns WEAKENING when probability decreases significantly", () => {
    const follow = makeFollow({ baselineProbability: 0.7 });
    const result = deriveFollowStatus(follow, {
      probability: 0.6,
      state: "bearish-persistence",
      confidence: 0.6,
      reversalRisk: 0.3,
    });
    expect(result.status).toBe("WEAKENING");
    expect(result.delta).toBe(-10);
  });

  it("returns UNCHANGED for small changes", () => {
    const follow = makeFollow({ baselineProbability: 0.7 });
    const result = deriveFollowStatus(follow, {
      probability: 0.71,
      state: "bullish-acceleration",
      confidence: 0.8,
      reversalRisk: 0.15,
    });
    expect(result.status).toBe("UNCHANGED");
    expect(result.delta).toBe(1);
  });

  it("returns INVALIDATED for insufficient data", () => {
    const follow = makeFollow();
    const result = deriveFollowStatus(follow, {
      probability: 0.5,
      state: "insufficient-data",
      confidence: 0.3,
      reversalRisk: 0.5,
    });
    expect(result.status).toBe("INVALIDATED");
  });
});
