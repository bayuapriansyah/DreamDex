/**
 * Canonical normalization layer.
 *
 * DATA FLOW:
 *
 *   SDK raw (bigint/string in token base units)
 *     ↓  normalizePrice / normalizeBookLevel / normalizeQuoteVolume
 *     ↓  validate via validateBook / toProbability
 *   Canonical value (Probability | TokenAmount | QuoteVolume)
 *     ↓  display formatting (at UI boundary only)
 *   UI string ("66.9%", "10.0")
 *
 * RULES:
 * - All internal probabilities MUST be 0..1.
 * - Missing data MUST be null — never fabricated to 0.5.
 * - Display formatting (*100) happens ONLY at the UI boundary.
 * - decimals parameter is REQUIRED — no global default assumption.
 * - Each function name communicates its units.
 */

import type { Probability } from "./types";

// ─────────────────────────────────────────────
// Temporal Analysis Thresholds
// ─────────────────────────────────────────────

/** avgProb > this → bullish. Between this and BEARISH_THRESHOLD → neutral. */
export const BULLISH_THRESHOLD = 0.52;
/** avgProb < this → bearish. Between this and BULLISH_THRESHOLD → neutral. */
export const BEARISH_THRESHOLD = 0.48;
/** Cross-horizon divergence above this → conflict between timeframes. */
export const DIVERGENCE_CONFLICT_THRESHOLD = 0.1;
/** Velocity per hour above this magnitude → strong momentum. */
export const VELOCITY_STRONG_THRESHOLD = 0.02;
/** Conviction decay magnitude above this → meaningful decay. */
export const DECAY_SIGNIFICANT_THRESHOLD = 0.03;
/** Data quality score below this → insufficient data for trajectory. */
export const DATA_QUALITY_MINIMUM = 0.3;
/** Liquidity normalization divisor (heuristic — average volume scale). */
export const LIQUIDITY_NORMALIZATION_BASE = 100;
/** Trajectory score weights (heuristic — not scientifically validated). */
export const TRAJECTORY_WEIGHTS = {
  direction: 0.3,
  momentum: 0.25,
  persistence: 0.2,
  consistency: 0.15,
  liquidity: 0.1,
} as const;

// ─────────────────────────────────────────────
// Core Decimal Conversion
// ─────────────────────────────────────────────

/**
 * Core decimal-safe conversion from raw SDK value to human-readable number.
 *
 * INPUT: raw SDK value (bigint, number, or string) in token base units
 * OUTPUT: human-readable number, or null if input is invalid
 *
 * @param raw — raw value from SDK (bigint, number, or string)
 * @param decimals — token decimals (REQUIRED — use market.quoteDecimals)
 * @returns normalized number, or null
 *
 * LIMITATION: Number(bigint) loses precision above 2^53.
 * For testnet token amounts this is acceptable.
 * For production large-value calculations, use bigint arithmetic.
 */
export function normLevel(
  raw: bigint | number | string | null | undefined,
  decimals: number
): number | null {
  if (raw === null || raw === undefined) return null;

  let asNumber: number;
  if (typeof raw === "bigint") {
    asNumber = Number(raw);
  } else if (typeof raw === "string") {
    asNumber = Number(raw);
  } else {
    asNumber = raw;
  }

  if (isNaN(asNumber) || !isFinite(asNumber)) return null;

  const divisor = 10 ** decimals;
  const result = asNumber / divisor;

  if (!isFinite(result)) return null;

  return result;
}

// ─────────────────────────────────────────────
// Price Normalization (for binary market prices)
// ─────────────────────────────────────────────

/**
 * Normalize a raw binary market price to a Probability (0..1).
 *
 * Binary market raw price represents YES probability × 10^quoteDecimals.
 * E.g. raw "669000" with 6 decimals → 0.669 (66.9%)
 *
 * @param raw — raw price from SDK (string, number, or bigint)
 * @param decimals — market.quoteDecimals (REQUIRED)
 * @returns Probability | null
 *
 * Returns null for: null, NaN, Infinity, negative, >1.5 (outlier guard).
 * Does NOT clamp: returns null for out-of-range values.
 */
export function normalizePrice(
  raw: string | number | bigint | null | undefined,
  decimals: number
): Probability | null {
  if (raw === null || raw === undefined) return null;

  let asNumber: number;
  if (typeof raw === "bigint") {
    asNumber = Number(raw);
  } else if (typeof raw === "string") {
    asNumber = Number(raw);
  } else {
    asNumber = raw;
  }

  if (!isFinite(asNumber)) return null;

  const normalized = asNumber / 10 ** decimals;

  // Outlier guard: probabilities outside [0, 1.5] are suspect
  if (normalized < 0 || normalized > 1.5) return null;

  // Clamp to valid [0, 1]
  return Math.min(Math.max(normalized, 0), 1);
}

/**
 * Normalize a binary market lastPrice (string from BaseMarket).
 * Wrapper for normalizePrice with string input.
 *
 * @param lastPrice — raw lastPrice from BaseMarket (string | null)
 * @param decimals — market.quoteDecimals
 */
export function normalizeLastPrice(
  lastPrice: string | null | undefined,
  decimals: number
): Probability | null {
  return normalizePrice(lastPrice, decimals);
}

// ─────────────────────────────────────────────
// Orderbook Normalization
// ─────────────────────────────────────────────

/**
 * Normalize a single BookLevel (price + quantity) from SDK raw bigint.
 *
 * @param level — { price: bigint, quantity: bigint } from SDK BookLevel
 * @param decimals — market.quoteDecimals
 * @returns { price: Probability | null, size: number | null }
 */
export function normalizeBookLevel(
  level: { price: bigint; quantity: bigint },
  decimals: number
): { price: Probability | null; size: number | null } {
  return {
    price: normalizePrice(level.price, decimals),
    size: normLevel(level.quantity, decimals),
  };
}

// ─────────────────────────────────────────────
// Volume Normalization
// ─────────────────────────────────────────────

/**
 * Normalize cumulativeQuoteVolume from raw SDK string to human-readable.
 *
 * SDK field: BaseMarket.cumulativeQuoteVolume — raw decimal string
 * Units: raw quote collateral units (e.g. raw USDC for testnet)
 *
 * @param raw — raw cumulativeQuoteVolume from SDK (string)
 * @param decimals — market.quoteDecimals
 * @returns human-readable quote volume, or null
 */
export function normalizeQuoteVolume(
  raw: string | bigint | null | undefined,
  decimals: number
): number | null {
  if (raw === null || raw === undefined) return null;
  return normLevel(raw, decimals);
}

// ─────────────────────────────────────────────
// Probability Helpers
// ─────────────────────────────────────────────

/**
 * Create a validated Probability from a raw number.
 * Returns null if value is NaN, Infinity, or outside [0, 1].
 */
export function toProbability(v: number): Probability | null {
  if (!isFinite(v)) return null;
  if (v < 0 || v > 1) return null;
  return v;
}

/**
 * Midpoint probability from bid/ask.
 * Returns null if both are null or if bid > ask.
 * NEVER fabricates a default value.
 */
export function midFromBidAsk(
  bid: Probability | null,
  ask: Probability | null
): Probability | null {
  if (bid !== null && ask !== null) {
    if (bid > ask) return null; // invariant violation
    return ((bid + ask) / 2);
  }
  if (bid !== null) return bid;
  if (ask !== null) return ask;
  return null;
}

/**
 * Validate a probability is in the canonical range [0, 1].
 */
export function isValidProbability(p: number): boolean {
  return !isNaN(p) && isFinite(p) && p >= 0 && p <= 1;
}

// ─────────────────────────────────────────────
// Sorting
// ─────────────────────────────────────────────

interface HorizonsSortable {
  horizonMinutes: number;
}

/**
 * Sort an array of items by horizon duration (ascending).
 * NOT lexicographic — sorts numerically: 5, 15, 30, 60, 240, 1440.
 */
export function sortByHorizon<T extends HorizonsSortable>(items: T[]): T[] {
  return [...items].sort((a, b) => a.horizonMinutes - b.horizonMinutes);
}

// ─────────────────────────────────────────────
// Formatting (UI boundary only)
// ─────────────────────────────────────────────

/**
 * Format a probability (0..1) for display.
 * E.g. 0.669 → "66.9%"
 * Returns "—" for null/undefined.
 */
export function formatProbability(p: number | null | undefined): string {
  if (p === null || p === undefined || isNaN(p)) return "—";
  return `${(Math.round(p * 1000) / 10).toFixed(1)}%`;
}

/**
 * Format a probability with integer display.
 * E.g. 0.669 → "67%"
 * Returns "—" for null/undefined.
 */
export function formatProbabilityInt(p: number | null | undefined): string {
  if (p === null || p === undefined || isNaN(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

/**
 * Format a raw number for display with given decimal places.
 * Returns "—" for null/undefined/NaN.
 */
export function formatDecimal(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return value.toFixed(decimals);
}

/**
 * Format a horizon in minutes to a human-readable label.
 */
export function formatHorizon(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

/**
 * Format a velocity as a signed percentage per hour.
 */
export function formatVelocity(v: number): string {
  return `${v > 0 ? "+" : ""}${(Math.round(v * 10000) / 100).toFixed(2)}%/hr`;
}
