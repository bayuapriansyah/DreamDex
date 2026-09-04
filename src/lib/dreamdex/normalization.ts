/**
 * Canonical probability normalization layer.
 *
 * ALL internal probabilities must be 0..1.
 * Raw SDK values (lastPrice, bidPrice, askPrice) are in token base units
 * and must be normalized before use in any UI or analytics.
 */

import { COLLATERAL_DECIMALS } from "./config";

const DIVISOR = 10 ** COLLATERAL_DECIMALS;

/**
 * Convert a raw SDK price (in base token units) to a probability (0..1).
 * E.g. 669000 → 0.669
 */
export function normalizeProbability(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined || isNaN(raw)) return null;
  const p = raw / DIVISOR;
  if (p < 0 || p > 1.5) return null; // outlier guard
  return Math.min(Math.max(p, 0), 1); // clamp to [0,1]
}

/**
 * Normalize and validate a bid/ask pair.
 * Returns [normBid, normAsk] or [null, null] if invalid.
 * Enforces bid <= ask and both in [0,1].
 */
export function normalizeBidAsk(
  rawBid: number | null | undefined,
  rawAsk: number | null | undefined
): [number | null, number | null] {
  const bid = normalizeProbability(rawBid);
  const ask = normalizeProbability(rawAsk);
  if (bid === null && ask === null) return [null, null];
  if (bid !== null && ask !== null && bid > ask) return [null, null];
  return [bid, ask];
}

/**
 * Format a probability (0..1) for display.
 * E.g. 0.669 → "66.9%"
 */
export function formatProbability(p: number | null | undefined): string {
  if (p === null || p === undefined || isNaN(p)) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

/**
 * Format a probability with integer display.
 * E.g. 0.669 → "67%"
 */
export function formatProbabilityInt(p: number | null | undefined): string {
  if (p === null || p === undefined || isNaN(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

/**
 * Validate a probability is in the valid range.
 */
export function isValidProbability(p: number): boolean {
  return !isNaN(p) && p >= 0 && p <= 1;
}

/**
 * Midpoint probability from bid/ask.
 * Returns null if both are null or if bid > ask.
 */
export function midFromBidAsk(
  bid: number | null,
  ask: number | null
): number | null {
  if (bid !== null && ask !== null) return (bid + ask) / 2;
  if (bid !== null) return bid;
  if (ask !== null) return ask;
  return null;
}
