import { describe, it, expect } from "vitest";
import {
  classifyGroup,
  groupByState,
  filterByGroup,
  filterSignals,
  sortSignals,
  type SignalResult,
  type SignalGroup,
} from "../signal-engine";

function makeSignal(overrides: Partial<SignalResult> = {}): SignalResult {
  return {
    asset: "BTC",
    trajectory: {
      state: "bullish-acceleration",
      stateLabel: "Bullish Acceleration",
      confidence: 0.8,
      reversalRisk: 0.2,
      trajectoryScore: 0.75,
      asOf: new Date().toISOString(),
      horizons: [
        { horizonMinutes: 5, midProbability: 0.65 },
        { horizonMinutes: 60, midProbability: 0.7 },
        { horizonMinutes: 240, midProbability: 0.72 },
      ],
      metrics: {
        velocityPerHour: 0.04,
        crossHorizonDivergence: 0.05,
        persistence: 0.8,
        directionStrength: 0.7,
      },
    },
    decisionContext: { actionability: "high" },
    ...overrides,
  };
}

describe("classifyGroup", () => {
  it("classifies bullish states", () => {
    expect(classifyGroup("bullish-acceleration")).toBe("bullish");
    expect(classifyGroup("bullish-persistence")).toBe("bullish");
    expect(classifyGroup("bullish-decay")).toBe("bullish");
  });

  it("classifies bearish states", () => {
    expect(classifyGroup("bearish-acceleration")).toBe("bearish");
    expect(classifyGroup("bearish-persistence")).toBe("bearish");
    expect(classifyGroup("bearish-decay")).toBe("bearish");
  });

  it("classifies reversal warning", () => {
    expect(classifyGroup("reversal-warning")).toBe("reversal");
  });

  it("classifies cross-horizon conflict", () => {
    expect(classifyGroup("cross-horizon-conflict")).toBe("conflict");
  });

  it("classifies insufficient data", () => {
    expect(classifyGroup("insufficient-data")).toBe("insufficient");
    expect(classifyGroup("single-horizon")).toBe("insufficient");
    expect(classifyGroup("neutral")).toBe("insufficient");
  });
});

describe("groupByState", () => {
  it("groups signals by regime category", () => {
    const signals = [
      makeSignal({ asset: "BTC", trajectory: { ...makeSignal().trajectory, state: "bullish-acceleration", stateLabel: "Bullish Acceleration" } }),
      makeSignal({ asset: "ETH", trajectory: { ...makeSignal().trajectory, state: "bearish-persistence", stateLabel: "Bearish Persistence" } }),
      makeSignal({ asset: "SOL", trajectory: { ...makeSignal().trajectory, state: "reversal-warning", stateLabel: "Reversal Warning" } }),
    ];
    const groups = groupByState(signals);
    expect(groups.length).toBe(3);
    expect(groups.find((g) => g.group === "bullish")?.count).toBe(1);
    expect(groups.find((g) => g.group === "bearish")?.count).toBe(1);
    expect(groups.find((g) => g.group === "reversal")?.count).toBe(1);
  });

  it("returns empty array for empty input", () => {
    const groups = groupByState([]);
    expect(groups.length).toBe(0);
  });

  it("only includes groups with signals", () => {
    const signals = [
      makeSignal({ trajectory: { ...makeSignal().trajectory, state: "bullish-acceleration", stateLabel: "Bullish Acceleration" } }),
    ];
    const groups = groupByState(signals);
    expect(groups.length).toBe(1);
    expect(groups[0].group).toBe("bullish");
  });
});

describe("filterByGroup", () => {
  it("filters by bullish group", () => {
    const signals = [
      makeSignal({ trajectory: { ...makeSignal().trajectory, state: "bullish-acceleration", stateLabel: "Bullish Acceleration" } }),
      makeSignal({ trajectory: { ...makeSignal().trajectory, state: "bearish-persistence", stateLabel: "Bearish Persistence" } }),
    ];
    const filtered = filterByGroup(signals, "bullish");
    expect(filtered.length).toBe(1);
    expect(filtered[0].asset).toBe("BTC");
  });
});

describe("filterSignals", () => {
  const signals = [
    makeSignal({ trajectory: { ...makeSignal().trajectory, state: "bullish-acceleration", stateLabel: "Bullish Acceleration" } }),
    makeSignal({ asset: "ETH", trajectory: { ...makeSignal().trajectory, state: "bearish-decay", stateLabel: "Bearish Decay" } }),
    makeSignal({ asset: "SOL", trajectory: { ...makeSignal().trajectory, state: "reversal-warning", stateLabel: "Reversal Warning" } }),
    makeSignal({ asset: "DOGE", trajectory: { ...makeSignal().trajectory, state: "cross-horizon-conflict", stateLabel: "Cross-Horizon Conflict" } }),
  ];

  it("ALL returns all signals", () => {
    expect(filterSignals(signals, "ALL").length).toBe(4);
  });

  it("BULLISH filters correctly", () => {
    const result = filterSignals(signals, "BULLISH");
    expect(result.length).toBe(1);
    expect(result[0].asset).toBe("BTC");
  });

  it("BEARISH filters correctly", () => {
    const result = filterSignals(signals, "BEARISH");
    expect(result.length).toBe(1);
    expect(result[0].asset).toBe("ETH");
  });

  it("REVERSAL filters correctly", () => {
    const result = filterSignals(signals, "REVERSAL");
    expect(result.length).toBe(1);
    expect(result[0].asset).toBe("SOL");
  });

  it("CONFLICT filters correctly", () => {
    const result = filterSignals(signals, "CONFLICT");
    expect(result.length).toBe(1);
    expect(result[0].asset).toBe("DOGE");
  });

  it("HIGH_CONFIDENCE filters correctly", () => {
    const highConf = makeSignal({ trajectory: { ...makeSignal().trajectory, confidence: 0.85, state: "bullish-acceleration", stateLabel: "Bullish Acceleration" } });
    const lowConf = makeSignal({ asset: "ETH", trajectory: { ...makeSignal().trajectory, confidence: 0.4, state: "bearish-decay", stateLabel: "Bearish Decay" } });
    const result = filterSignals([highConf, lowConf], "HIGH_CONFIDENCE");
    expect(result.length).toBe(1);
    expect(result[0].asset).toBe("BTC");
  });
});

describe("sortSignals", () => {
  const signals = [
    makeSignal({ trajectory: { ...makeSignal().trajectory, trajectoryScore: 0.6, confidence: 0.5, state: "bullish-acceleration", stateLabel: "Bullish Acceleration", asOf: new Date(Date.now() - 60000).toISOString() } }),
    makeSignal({ asset: "ETH", trajectory: { ...makeSignal().trajectory, trajectoryScore: 0.9, confidence: 0.8, state: "bullish-acceleration", stateLabel: "Bullish Acceleration", asOf: new Date().toISOString() } }),
  ];

  it("sorts by strength descending", () => {
    const sorted = sortSignals(signals, "strength");
    expect(sorted[0].asset).toBe("ETH");
    expect(sorted[1].asset).toBe("BTC");
  });

  it("sorts by confidence descending", () => {
    const sorted = sortSignals(signals, "confidence");
    expect(sorted[0].asset).toBe("ETH");
    expect(sorted[1].asset).toBe("BTC");
  });

  it("sorts by freshness descending (most recent first)", () => {
    const sorted = sortSignals(signals, "freshness");
    expect(sorted[0].asset).toBe("ETH");
    expect(sorted[1].asset).toBe("BTC");
  });

  it("sorts by actionability descending", () => {
    const high = makeSignal({ decisionContext: { actionability: "high" } });
    const low = makeSignal({ asset: "ETH", decisionContext: { actionability: "low" } });
    const sorted = sortSignals([low, high], "actionability");
    expect(sorted[0].decisionContext?.actionability).toBe("high");
    expect(sorted[1].decisionContext?.actionability).toBe("low");
  });

  it("does not mutate original array", () => {
    const original = [...signals];
    sortSignals(signals, "strength");
    expect(signals[0].asset).toBe(original[0].asset);
  });
});
