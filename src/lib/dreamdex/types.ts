/**
 * Canonical domain types for DreamDex Temporal.
 *
 * UNITS & SEMANTICS:
 *
 *   Probability — normalized 0..1, derived from raw price / 10^quoteDecimals
 *   RawPrice    — raw fixed-point value from SDK (bigint or string)
 *   HorizonMinutes — numeric horizon (15, 30, 60, 240, 1440)
 *   TokenAmount — human-readable token quantity (already divided by decimals)
 *   QuoteVolume — human-readable quote volume (already divided by quoteDecimals)
 *   BasisPoints — integer basis points (1 bp = 0.01%)
 *
 * DATA FLOW:
 *
 *   SDK raw (bigint/string) → decoder → normalize(raw, decimals) → canonical type
 *
 * RULES:
 *   - null means "data unavailable" — NEVER fabricate 0.5
 *   - Probability MUST be 0..1 after normalization
 *   - NaN/Infinity inputs → null output
 *   - Bigints are safe to convert for testnet ranges; document limitation
 */

// ─────────────────────────────────────────────
// Canonical Types (plain types with explicit naming)
// ─────────────────────────────────────────────

/**
 * Normalized probability: 0..1.
 * Derived from raw price / 10^quoteDecimals.
 * Null means "data unavailable" — NEVER fabricate 0.5.
 */
export type Probability = number;

/** Raw fixed-point price from SDK (before normalization). */
export type RawPrice = string;

/** Horizon in minutes (15, 30, 60, 240, 1440). */
export type HorizonMinutes = number;

/** Human-readable token amount (already normalized by decimals). */
export type TokenAmount = number;

/** Human-readable quote volume (already normalized by quoteDecimals). */
export type QuoteVolume = number;

/** Integer basis points (1 bp = 0.01%). */
export type BasisPoints = number;

// ─────────────────────────────────────────────
// Market Lifecycle
// ─────────────────────────────────────────────

/**
 * DreamDEX binary market lifecycle states.
 * Matches SDK BinaryMarketStatus.
 */
export type MarketLifecycle =
  | "Listed"
  | "Trading"
  | "Locked"
  | "Settling"
  | "Resolved"
  | "Voided"
  | "Finalized";

/**
 * Check if a market lifecycle state is actively tradeable.
 */
export function isTradeable(status: MarketLifecycle): boolean {
  return status === "Trading";
}

/**
 * Check if a market is still active (not settled/resolved/voided).
 */
export function isActive(status: MarketLifecycle): boolean {
  return status === "Trading" || status === "Locked" || status === "Settling";
}

/**
 * Check if a market is terminal (resolved/voided/finalized).
 */
export function isTerminal(status: MarketLifecycle): boolean {
  return status === "Resolved" || status === "Voided" || status === "Finalized";
}

/**
 * Check if a market is locked (not yet resolved but no longer tradeable).
 */
export function isLocked(status: MarketLifecycle): boolean {
  return status === "Locked" || status === "Settling";
}

/**
 * Canonical lifecycle progression order.
 */
const LIFECYCLE_ORDER: Record<MarketLifecycle, number> = {
  Listed: 0,
  Trading: 1,
  Locked: 2,
  Settling: 3,
  Resolved: 4,
  Finalized: 5,
  Voided: 4, // same tier as Resolved (branch)
};

/**
 * Check if `from` precedes `to` in lifecycle.
 */
export function lifecyclePrecedes(from: MarketLifecycle, to: MarketLifecycle): boolean {
  return LIFECYCLE_ORDER[from] < LIFECYCLE_ORDER[to];
}

// ─────────────────────────────────────────────
// Settlement
// ─────────────────────────────────────────────

/**
 * Settlement record for a resolved/voided market.
 * Derived from SDK SettlementRecord + on-chain data.
 */
export interface Settlement {
  /** Market ID (bytes32 hex) */
  marketId: string;
  /** Underlying asset */
  asset: string;
  /** Contract horizon in minutes */
  horizon: HorizonMinutes;
  /** Market lifecycle status */
  status: MarketLifecycle;
  /** Winning outcome index (0 = YES, 1 = NO); null on void */
  winningOutcome: number | null;
  /** Whether market was voided */
  voided: boolean;
  /** Settlement fee in bps (scaled by 1000 from raw) */
  settlementFeeBpsTimes1k: bigint | null;
  /** Fee recipient address */
  feeRecipient: string | null;
  /** Pool address that finalized */
  pool: string | null;
  /** Pool market nonce */
  nonce: bigint | null;
  /** Backing (collateral held post-fee) */
  backing: bigint | null;
  /** Whether settlement has been finalized */
  finalized: boolean;
  /** Payout numerators (per-outcome, denominator 10_000_000) */
  payoutNumerators: bigint[];
  /** Resolved timestamp (ISO) */
  resolvedAt: string | null;
  /** Finalized timestamp (ISO) */
  finalizedAt: string | null;
  /** Oracle question ID */
  oracleQuestionId: string | null;
  /** Oracle question text */
  oracleQuestion: string | null;
}

/**
 * Oracle answer data.
 */
export interface OracleMetadata {
  /** Oracle question ID (decimal string) */
  oracleQuestionId: string | null;
  /** Numeric answer from oracle */
  numericValue: string | null;
  /** Human outcome label */
  outcomeLabel: string | null;
  /** Void reason code (non-null only on voided answer) */
  voidReason: number | null;
  /** Timestamp when answer was posted */
  resolvedAt: string | null;
  /** Transaction hash of the answer */
  txHash: string | null;
}

/**
 * Oracle verification status.
 */
export type OracleVerificationStatus =
  | "verified"      // Oracle answered and matches settlement
  | "not_verified"  // Oracle answered but doesn't match settlement
  | "unavailable";  // No oracle data available

/**
 * Complete settlement verification data.
 */
export interface SettlementVerification {
  /** Market ID */
  marketId: string;
  /** Settlement record (if available) */
  settlement: Settlement | null;
  /** Oracle closing answer */
  closingAnswer: OracleMetadata | null;
  /** Oracle opening answer */
  openingAnswer: OracleMetadata | null;
  /** Oracle reference link */
  referenceLink: string | null;
  /** Resolution events */
  resolutionEvents: ResolutionEvent[];
  /** Verification status */
  verificationStatus: OracleVerificationStatus;
  /** Human-readable verification summary */
  verificationSummary: string;
}

/**
 * Resolution event (from indexer).
 */
export interface ResolutionEvent {
  /** Event ID */
  id: string;
  /** Market ID */
  market: string;
  /** Resolution kind ("Resolved" | "Skipped" | "Failed") */
  kind: string;
  /** Winning outcome (0 = YES, 1 = NO); null on void */
  winningOutcome: number | null;
  /** Whether market was voided */
  voided: boolean;
  /** Block number */
  blockNumber: string;
  /** Timestamp (unix seconds) */
  timestamp: string;
  /** Transaction hash */
  txHash: string;
}

/**
 * Claimable position from SDK getClaimable().
 */
export interface ClaimablePosition {
  /** Market ID */
  marketId: string;
  /** Pool address */
  pool: string;
  /** Outcome index (0 = YES, 1 = NO) */
  outcomeIdx: 0 | 1;
  /** Redeemable token amount (raw) */
  amount: bigint;
  /** Estimated payout net of fee (raw) */
  estPayout: bigint;
  /** Market status */
  status: string;
}

// ─────────────────────────────────────────────
// Horizon Model
// ─────────────────────────────────────────────

/** Canonical horizon definition. */
export interface Horizon {
  minutes: HorizonMinutes;
  label: string;
}

/** Standard DreamDEX Event Contract horizons (verified on Shannon testnet: 5m, 1h, 4h). */
export const STANDARD_HORIZONS: Horizon[] = [
  { minutes: 5 as HorizonMinutes, label: "5m" },
  { minutes: 60 as HorizonMinutes, label: "1h" },
  { minutes: 240 as HorizonMinutes, label: "4h" },
];

/** Format a horizon in minutes to a human-readable label. */
export function formatHorizonLabel(mins: HorizonMinutes | number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

// ─────────────────────────────────────────────
// Data Freshness
// ─────────────────────────────────────────────

/** How fresh is the data in a snapshot. */
export type DataFreshness = "live" | "recent" | "stale" | "unavailable";

/**
 * Determine data freshness from timestamp and seconds-left.
 * @param timestampMs — when the data was captured (ms since epoch)
 * @param secondsLeft — how many seconds until market expires
 */
export function classifyFreshness(
  timestampMs: number,
  secondsLeft?: number
): DataFreshness {
  const ageMs = Date.now() - timestampMs;
  if (ageMs > 60_000) return "stale";
  if (ageMs > 30_000) return "recent";
  if (secondsLeft !== undefined && secondsLeft < 60) return "unavailable";
  return "live";
}

// ─────────────────────────────────────────────
// Canonical Snapshots
// ─────────────────────────────────────────────

/** Single market probability snapshot across one horizon. */
export interface MarketSnapshot {
  /** Underlying asset (e.g. "BTC", "ETH"). */
  asset: string;
  /** On-chain market identifier (bytes32 hex). */
  marketId: string;
  /** Pool contract address. */
  pool: string;
  /** Horizon in minutes. */
  horizon: HorizonMinutes;
  /** Market identifier for display (e.g. "BTC-0-04SEP26-1400/tUSDC"). */
  symbol: string;

  /** Quote token decimals (from market.quoteDecimals). */
  quoteDecimals: number;

  /** Normalized probabilities (0..1). Null = data unavailable. */
  probability: Probability | null;
  bid: Probability | null;
  ask: Probability | null;
  mid: Probability | null;

  /** Bid-ask spread in probability points. Null if either side missing. */
  spread: Probability | null;

  /** Human-readable quote volume (normalized). */
  volume: QuoteVolume | null;

  /** Seconds until market expiry. */
  secondsLeft: number;

  /** Market lifecycle status. */
  status: MarketLifecycle;

  /** Data quality assessment. */
  dataQuality: "high" | "medium" | "low" | "none";

  /** When this snapshot was created. */
  capturedAt: string;

  /** Freshness classification. */
  freshness: DataFreshness;
}

/** Full orderbook snapshot for a single market. */
export interface OrderbookSnapshot {
  /** On-chain market identifier. */
  marketId: string;
  /** Pool contract address. */
  pool: string;
  /** Underlying asset. */
  asset: string;
  /** Quote token decimals for this market. */
  quoteDecimals: number;

  /** Normalized best bid probability. */
  bestBid: Probability | null;
  /** Normalized best ask probability. */
  bestAsk: Probability | null;
  /** Midpoint probability. Null if either side missing. */
  mid: Probability | null;
  /** Spread in probability points. Null if either side missing. */
  spread: Probability | null;

  /** Normalized bid levels. */
  bids: OrderbookLevel[];
  /** Normalized ask levels. */
  asks: OrderbookLevel[];

  /** When this snapshot was captured. */
  capturedAt: string;
}

/** Single orderbook level (normalized). */
export interface OrderbookLevel {
  price: Probability;
  size: TokenAmount;
}

// ─────────────────────────────────────────────
// Orderbook Validation
// ─────────────────────────────────────────────

export interface ValidatedBook {
  bestBid: Probability | null;
  bestAsk: Probability | null;
  mid: Probability | null;
  spread: Probability | null;
  isValid: boolean;
  error?: string;
}

/**
 * Validate and compute mid/spread from bid/ask.
 * Returns null for invalid combinations.
 */
export function validateBook(
  bid: Probability | null,
  ask: Probability | null
): ValidatedBook {
  // Both null
  if (bid === null && ask === null) {
    return { bestBid: null, bestAsk: null, mid: null, spread: null, isValid: false, error: "no data" };
  }

  // Single side
  if (bid === null) {
    return { bestBid: null, bestAsk: ask, mid: ask, spread: null, isValid: true };
  }
  if (ask === null) {
    return { bestBid: bid, bestAsk: null, mid: bid, spread: null, isValid: true };
  }

  // Both present: validate bid <= ask
  if (bid > ask) {
    return { bestBid: null, bestAsk: null, mid: null, spread: null, isValid: false, error: "bid > ask" };
  }

  const mid = (bid + ask) / 2;
  const spread = ask - bid;

  return { bestBid: bid, bestAsk: ask, mid, spread, isValid: true };
}
