import { describe, it, expect } from "vitest";
import { formatHorizon, formatForecastOffset, formatProb, safePct, safeNum, pctStr, pctNum, ppStr } from "../formatting";

describe("formatHorizon", () => {
  it("formats minutes < 60 as Xm", () => {
    expect(formatHorizon(5)).toBe("5m");
    expect(formatHorizon(15)).toBe("15m");
    expect(formatHorizon(30)).toBe("30m");
    expect(formatHorizon(45)).toBe("45m");
    expect(formatHorizon(59)).toBe("59m");
  });

  it("formats hours (60..1439) as Xh", () => {
    expect(formatHorizon(60)).toBe("1h");
    expect(formatHorizon(120)).toBe("2h");
    expect(formatHorizon(240)).toBe("4h");
    expect(formatHorizon(360)).toBe("6h");
    expect(formatHorizon(720)).toBe("12h");
    expect(formatHorizon(1439)).toBe("24h");
  });

  it("formats days (>= 1440) as Xd", () => {
    expect(formatHorizon(1440)).toBe("1d");
    expect(formatHorizon(2880)).toBe("2d");
    expect(formatHorizon(4320)).toBe("3d");
    expect(formatHorizon(10080)).toBe("7d");
    expect(formatHorizon(64800)).toBe("45d");
  });

  it("handles edge cases", () => {
    expect(formatHorizon(0)).toBe("0m");
    expect(formatHorizon(1)).toBe("1m");
    expect(formatHorizon(59)).toBe("59m");
    expect(formatHorizon(60)).toBe("1h");
    expect(formatHorizon(1440)).toBe("1d");
  });
});

describe("formatForecastOffset", () => {
  it("always shows Xm format", () => {
    expect(formatForecastOffset(5)).toBe("5m");
    expect(formatForecastOffset(10)).toBe("10m");
    expect(formatForecastOffset(15)).toBe("15m");
    expect(formatForecastOffset(20)).toBe("20m");
    expect(formatForecastOffset(30)).toBe("30m");
    expect(formatForecastOffset(45)).toBe("45m");
    expect(formatForecastOffset(60)).toBe("60m");
  });
});

describe("formatProb", () => {
  it("formats probability to 1 decimal with proper rounding", () => {
    expect(formatProb(0.6515)).toBe("65.2%");
    expect(formatProb(0.5)).toBe("50.0%");
    expect(formatProb(0)).toBe("0.0%");
    expect(formatProb(1)).toBe("100.0%");
    expect(formatProb(0.3333)).toBe("33.3%");
    expect(formatProb(0.999)).toBe("99.9%");
  });

  it("handles null", () => {
    expect(formatProb(null)).toBe("—");
  });
});

describe("safePct", () => {
  it("formats with default 1 decimal with proper rounding", () => {
    expect(safePct(0.6515)).toBe("65.2%");
    expect(safePct(0.5)).toBe("50.0%");
  });

  it("formats with custom decimals", () => {
    expect(safePct(0.6515, 0)).toBe("65%");
    expect(safePct(0.6515, 2)).toBe("65.15%");
  });

  it("handles null/undefined/NaN/Infinity", () => {
    expect(safePct(null)).toBe("—");
    expect(safePct(undefined)).toBe("—");
    expect(safePct(NaN)).toBe("—");
    expect(safePct(Infinity)).toBe("—");
    expect(safePct(-Infinity)).toBe("—");
  });
});

describe("safeNum", () => {
  it("formats number with decimals", () => {
    expect(safeNum(0.5)).toBe("0.50");
    expect(safeNum(1.23456, 3)).toBe("1.235");
  });

  it("handles null/undefined/NaN/Infinity", () => {
    expect(safeNum(null)).toBe("—");
    expect(safeNum(undefined)).toBe("—");
    expect(safeNum(NaN)).toBe("—");
    expect(safeNum(Infinity)).toBe("—");
  });
});

describe("pctStr", () => {
  it("formats probability with proper rounding (no floating-point artifacts)", () => {
    expect(pctStr(0.6515, 1)).toBe("65.2");
    expect(pctStr(0.8275, 1)).toBe("82.8");
    expect(pctStr(0.5, 1)).toBe("50.0");
    expect(pctStr(0, 1)).toBe("0.0");
    expect(pctStr(1, 1)).toBe("100.0");
  });

  it("formats with 0 decimals", () => {
    expect(pctStr(0.6515, 0)).toBe("65");
    expect(pctStr(0.8275, 0)).toBe("83");
    expect(pctStr(0.5, 0)).toBe("50");
  });

  it("formats with 2 decimals", () => {
    expect(pctStr(0.6515, 2)).toBe("65.15");
    expect(pctStr(0.0314159, 2)).toBe("3.14");
  });

  it("never produces floating-point artifacts like 82.74999999999999", () => {
    const result = pctStr(0.8275, 1);
    expect(result).not.toMatch(/\d+\.?\d*9{2,}/);
    expect(result).toBe("82.8");
  });
});

describe("pctNum", () => {
  it("returns properly rounded number", () => {
    expect(pctNum(0.6515, 1)).toBe(65.2);
    expect(pctNum(0.8275, 1)).toBe(82.8);
    expect(pctNum(0.5, 0)).toBe(50);
  });
});

describe("ppStr", () => {
  it("formats percentage-point differences", () => {
    expect(ppStr(0.033, 1)).toBe("+3.3pp");
    expect(ppStr(-0.033, 1)).toBe("-3.3pp");
    expect(ppStr(0, 1)).toBe("0.0pp");
  });

  it("formats with proper rounding", () => {
    expect(ppStr(0.0335, 1)).toBe("+3.4pp");
    expect(ppStr(-0.0335, 1)).toBe("-3.3pp");
  });
});
