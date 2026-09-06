import { describe, it, expect } from "vitest";
import {
  probabilityToRawPrice,
  rawPriceToProbability,
  humanToRawQuantity,
  rawToHumanQuantity,
  snapToTick,
  snapToLot,
} from "../execution";

const DECIMALS = 6;
const ONE = BigInt(10 ** DECIMALS);

describe("probabilityToRawPrice", () => {
  it("converts 0.5 to raw", () => {
    expect(probabilityToRawPrice(0.5, DECIMALS)).toBe(BigInt(500000));
  });
  it("converts 0.01 to raw", () => {
    expect(probabilityToRawPrice(0.01, DECIMALS)).toBe(BigInt(10000));
  });
  it("converts 0.99 to raw", () => {
    expect(probabilityToRawPrice(0.99, DECIMALS)).toBe(BigInt(990000));
  });
  it("rounds to nearest unit", () => {
    expect(probabilityToRawPrice(0.1234567, DECIMALS)).toBe(BigInt(123457));
  });
});

describe("rawPriceToProbability", () => {
  it("converts raw to probability", () => {
    expect(rawPriceToProbability(BigInt(500000), DECIMALS)).toBeCloseTo(0.5);
  });
  it("converts 0.01 raw", () => {
    expect(rawPriceToProbability(BigInt(10000), DECIMALS)).toBeCloseTo(0.01);
  });
});

describe("humanToRawQuantity", () => {
  it("converts 10 to raw", () => {
    expect(humanToRawQuantity(10, DECIMALS)).toBe(BigInt(10000000));
  });
  it("converts 1 to raw", () => {
    expect(humanToRawQuantity(1, DECIMALS)).toBe(ONE);
  });
  it("rounds to nearest unit", () => {
    expect(humanToRawQuantity(1.1234567, DECIMALS)).toBe(BigInt(1123457));
  });
});

describe("rawToHumanQuantity", () => {
  it("converts raw to human", () => {
    expect(rawToHumanQuantity(BigInt(10000000), DECIMALS)).toBeCloseTo(10);
  });
  it("converts ONE to 1", () => {
    expect(rawToHumanQuantity(ONE, DECIMALS)).toBeCloseTo(1);
  });
});

describe("snapToTick", () => {
  const tickSize = BigInt(1000); // 0.001

  it("buy rounds down", () => {
    expect(snapToTick(BigInt(500500), tickSize, "buy")).toBe(BigInt(500000));
  });

  it("buy rounds down even when already on tick", () => {
    expect(snapToTick(BigInt(500000), tickSize, "buy")).toBe(BigInt(500000));
  });

  it("sell rounds up", () => {
    expect(snapToTick(BigInt(500500), tickSize, "sell")).toBe(BigInt(501000));
  });

  it("sell stays on tick when already aligned", () => {
    expect(snapToTick(BigInt(500000), tickSize, "sell")).toBe(BigInt(500000));
  });

  it("tickSize of 1 means no rounding", () => {
    expect(snapToTick(BigInt(123456), BigInt(1), "buy")).toBe(BigInt(123456));
  });
});

describe("snapToLot", () => {
  const lotSize = BigInt(1000000); // 1.0

  it("snaps down to lot", () => {
    expect(snapToLot(BigInt(1500000), lotSize)).toBe(BigInt(1000000));
  });

  it("stays on lot when aligned", () => {
    expect(snapToLot(BigInt(2000000), lotSize)).toBe(BigInt(2000000));
  });

  it("lotSize of 1 means no rounding", () => {
    expect(snapToLot(BigInt(123456), BigInt(1))).toBe(BigInt(123456));
  });

  it("snaps 999999 to 0 with lotSize of 1000000", () => {
    expect(snapToLot(BigInt(999999), lotSize)).toBe(BigInt(0));
  });
});

describe("roundtrip conversion", () => {
  it("probability → raw → probability roundtrips", () => {
    const prob = 0.652;
    const raw = probabilityToRawPrice(prob, DECIMALS);
    const back = rawPriceToProbability(raw, DECIMALS);
    expect(back).toBeCloseTo(prob, 3);
  });

  it("human → raw → human roundtrips", () => {
    const qty = 42;
    const raw = humanToRawQuantity(qty, DECIMALS);
    const back = rawToHumanQuantity(raw, DECIMALS);
    expect(back).toBeCloseTo(qty, 6);
  });
});

describe("edge cases", () => {
  it("probability 0.01 (minimum)", () => {
    const raw = probabilityToRawPrice(0.01, DECIMALS);
    expect(raw).toBe(BigInt(10000));
  });

  it("probability 0.99 (maximum)", () => {
    const raw = probabilityToRawPrice(0.99, DECIMALS);
    expect(raw).toBe(BigInt(990000));
  });

  it("very small quantity snaps to 0 with large lotSize", () => {
    expect(snapToLot(BigInt(500000), BigInt(1000000))).toBe(BigInt(0));
  });

  it("tick alignment: 0.6515 with tick 0.001", () => {
    const tick = BigInt(1000);
    const raw = probabilityToRawPrice(0.6515, DECIMALS);
    expect(raw).toBe(BigInt(651500));
    const snapped = snapToTick(raw, tick, "buy");
    expect(snapped).toBe(BigInt(651000));
    expect(rawPriceToProbability(snapped, DECIMALS)).toBeCloseTo(0.651, 3);
  });
});
