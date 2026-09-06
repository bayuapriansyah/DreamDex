import { describe, it, expect } from "vitest";
import {
  normLevel,
  normalizeBookLevel,
  normalizePrice,
  normalizeLastPrice,
  normalizeQuoteVolume,
  midFromBidAsk,
  sortByHorizon,
  formatProbability,
  formatProbabilityInt,
  isValidProbability,
  BULLISH_THRESHOLD,
  BEARISH_THRESHOLD,
  DIVERGENCE_CONFLICT_THRESHOLD,
  VELOCITY_STRONG_THRESHOLD,
  DECAY_SIGNIFICANT_THRESHOLD,
  DATA_QUALITY_MINIMUM,
} from "../normalization";

describe("normLevel", () => {
  it("normalizes bigint with 6 decimals", () => {
    expect(normLevel(BigInt(669000), 6)).toBeCloseTo(0.669);
  });

  it("normalizes bigint with 18 decimals", () => {
    expect(normLevel(BigInt(1_500_000_000_000), 18)).toBeCloseTo(0.0015);
  });

  it("normalizes number input", () => {
    expect(normLevel(669000, 6)).toBeCloseTo(0.669);
  });

  it("normalizes string input", () => {
    expect(normLevel("669000", 6)).toBeCloseTo(0.669);
  });

  it("returns null for null", () => {
    expect(normLevel(null, 6)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normLevel(undefined, 6)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(normLevel(NaN, 6)).toBeNull();
  });

  it("handles zero", () => {
    expect(normLevel(BigInt(0), 6)).toBe(0);
  });

  it("handles 1 whole unit", () => {
    expect(normLevel(BigInt(1_000_000), 6)).toBeCloseTo(1.0);
  });

  it("returns finite for normal values", () => {
    const result = normLevel(BigInt(333000), 6);
    expect(result).not.toBeNull();
    expect(isFinite(result!)).toBe(true);
  });
});

describe("normalizePrice", () => {
  it("normalizes raw 669000 to 0.669", () => {
    expect(normalizePrice("669000", 6)).toBeCloseTo(0.669);
  });

  it("clamps to [0, 1]", () => {
    expect(normalizePrice("1100000", 6)).toBeCloseTo(1.0);
  });

  it("returns null for values outside outlier guard", () => {
    expect(normalizePrice("1600000", 6)).toBeNull();
  });

  it("returns null for negative raw", () => {
    expect(normalizePrice("-100", 6)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizePrice(null, 6)).toBeNull();
  });

  it("returns null for NaN input", () => {
    expect(normalizePrice(NaN, 6)).toBeNull();
  });

  it("handles bigint input", () => {
    expect(normalizePrice(BigInt(669000), 6)).toBeCloseTo(0.669);
  });

  it("never returns 0.5 as a fabricated default", () => {
    expect(normalizePrice(null, 6)).toBeNull();
    expect(normalizePrice(undefined, 6)).toBeNull();
  });
});

describe("normalizeLastPrice", () => {
  it("normalizes SDK string lastPrice", () => {
    expect(normalizeLastPrice("669000", 6)).toBeCloseTo(0.669);
  });

  it("returns null for null", () => {
    expect(normalizeLastPrice(null, 6)).toBeNull();
  });
});

describe("normalizeBookLevel", () => {
  it("normalizes price and quantity", () => {
    const result = normalizeBookLevel(
      { price: BigInt(669000), quantity: BigInt(10_000_000) },
      6
    );
    expect(result.price).toBeCloseTo(0.669);
    expect(result.size).toBeCloseTo(10.0);
  });

  it("handles zero values", () => {
    const result = normalizeBookLevel(
      { price: BigInt(0), quantity: BigInt(0) },
      6
    );
    expect(result.price).toBe(0);
    expect(result.size).toBe(0);
  });
});

describe("normalizeQuoteVolume", () => {
  it("normalizes raw quote volume", () => {
    expect(normalizeQuoteVolume("669000000", 6)).toBeCloseTo(669.0);
  });

  it("returns null for null", () => {
    expect(normalizeQuoteVolume(null, 6)).toBeNull();
  });

  it("handles 18 decimals", () => {
    expect(normalizeQuoteVolume("1000000000000000000", 18)).toBeCloseTo(1.0);
  });
});

describe("midFromBidAsk", () => {
  it("returns mid when both present", () => {
    expect(midFromBidAsk(0.6, 0.8)).toBeCloseTo(0.7);
  });

  it("returns bid when ask is null", () => {
    expect(midFromBidAsk(0.6, null)).toBe(0.6);
  });

  it("returns ask when bid is null", () => {
    expect(midFromBidAsk(null, 0.8)).toBe(0.8);
  });

  it("returns null when both null", () => {
    expect(midFromBidAsk(null, null)).toBeNull();
  });

  it("returns null when bid > ask (invariant violation)", () => {
    expect(midFromBidAsk(0.8, 0.6)).toBeNull();
  });
});

describe("sortByHorizon", () => {
  it("sorts by horizon ascending numerically", () => {
    const items = [
      { horizonMinutes: 1440 },
      { horizonMinutes: 15 },
      { horizonMinutes: 60 },
      { horizonMinutes: 30 },
    ];
    const sorted = sortByHorizon(items);
    expect(sorted.map((h) => h.horizonMinutes)).toEqual([15, 30, 60, 1440]);
  });

  it("does not mutate original", () => {
    const items = [{ horizonMinutes: 60 }, { horizonMinutes: 15 }];
    const sorted = sortByHorizon(items);
    expect(items[0].horizonMinutes).toBe(60);
    expect(sorted[0].horizonMinutes).toBe(15);
  });

  it("handles empty array", () => {
    expect(sortByHorizon([])).toEqual([]);
  });

  it("handles typical DreamDEX horizons: 15m, 30m, 1h, 4h", () => {
    const items = [
      { horizonMinutes: 240 },
      { horizonMinutes: 15 },
      { horizonMinutes: 60 },
      { horizonMinutes: 30 },
    ];
    const sorted = sortByHorizon(items);
    expect(sorted.map((h) => h.horizonMinutes)).toEqual([15, 30, 60, 240]);
  });
});

describe("formatProbability", () => {
  it("formats 0.669 as 66.9%", () => {
    expect(formatProbability(0.669)).toBe("66.9%");
  });

  it("formats null as —", () => {
    expect(formatProbability(null)).toBe("—");
  });

  it("formats undefined as —", () => {
    expect(formatProbability(undefined)).toBe("—");
  });

  it("formats NaN as —", () => {
    expect(formatProbability(NaN)).toBe("—");
  });

  it("formats 0 as 0.0%", () => {
    expect(formatProbability(0)).toBe("0.0%");
  });

  it("formats 1 as 100.0%", () => {
    expect(formatProbability(1)).toBe("100.0%");
  });
});

describe("formatProbabilityInt", () => {
  it("formats 0.669 as 67%", () => {
    expect(formatProbabilityInt(0.669)).toBe("67%");
  });

  it("formats null as —", () => {
    expect(formatProbabilityInt(null)).toBe("—");
  });
});

describe("isValidProbability", () => {
  it("returns true for valid values", () => {
    expect(isValidProbability(0)).toBe(true);
    expect(isValidProbability(0.5)).toBe(true);
    expect(isValidProbability(1)).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(isValidProbability(-0.1)).toBe(false);
    expect(isValidProbability(1.1)).toBe(false);
    expect(isValidProbability(NaN)).toBe(false);
  });
});

describe("decimal matrix", () => {
  it("6 decimals (tUSDC)", () => {
    expect(normLevel(BigInt(669000), 6)).toBeCloseTo(0.669);
    expect(normalizePrice("669000", 6)).toBeCloseTo(0.669);
  });

  it("8 decimals", () => {
    expect(normLevel(BigInt(66_900_000), 8)).toBeCloseTo(0.669);
    expect(normalizePrice("66900000", 8)).toBeCloseTo(0.669);
  });

  it("18 decimals (USDso)", () => {
    expect(normLevel(BigInt(669_000_000_000_000_000), 18)).toBeCloseTo(0.669);
    expect(normalizePrice("669000000000000000", 18)).toBeCloseTo(0.669);
  });
});

describe("thresholds", () => {
  it("BULLISH_THRESHOLD > BEARISH_THRESHOLD", () => {
    expect(BULLISH_THRESHOLD).toBeGreaterThan(BEARISH_THRESHOLD);
  });

  it("neutral band is between thresholds", () => {
    expect(0.5).toBeGreaterThan(BEARISH_THRESHOLD);
    expect(0.5).toBeLessThan(BULLISH_THRESHOLD);
  });

  it("DIVERGENCE_CONFLICT_THRESHOLD > 0", () => {
    expect(DIVERGENCE_CONFLICT_THRESHOLD).toBeGreaterThan(0);
  });

  it("VELOCITY_STRONG_THRESHOLD > 0", () => {
    expect(VELOCITY_STRONG_THRESHOLD).toBeGreaterThan(0);
  });

  it("DECAY_SIGNIFICANT_THRESHOLD > 0", () => {
    expect(DECAY_SIGNIFICANT_THRESHOLD).toBeGreaterThan(0);
  });

  it("DATA_QUALITY_MINIMUM is between 0 and 1", () => {
    expect(DATA_QUALITY_MINIMUM).toBeGreaterThan(0);
    expect(DATA_QUALITY_MINIMUM).toBeLessThan(1);
  });
});

describe("edge cases", () => {
  it("max valid probability", () => {
    expect(normalizePrice("1000000", 6)).toBeCloseTo(1.0);
    expect(isValidProbability(1.0)).toBe(true);
  });

  it("very small raw value", () => {
    expect(normLevel(BigInt(1), 6)).toBeCloseTo(0.000001);
  });

  it("large bigint (testnet range)", () => {
    const result = normLevel(BigInt(999_999_999), 6);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(999.999999);
  });
});
