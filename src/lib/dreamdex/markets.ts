// Server-side only — DreamDEX market discovery with Event Contract validation
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { getExchange } from "./client";
import { normalizeLastPrice, normalizeQuoteVolume } from "./normalization";
import { ADDRESSES } from "./config";
import type { Probability, QuoteVolume, HorizonMinutes, MarketLifecycle } from "./types";

/* ═══════════════════════════════════════════════════════ */
/* Event Contract Cadence Ladder                          */
/* ═══════════════════════════════════════════════════════ */

/**
 * Officially verified DreamDEX Event Contract cadences.
 * Source: Shannon testnet live market data + SDK CADENCE_LADDER_SEC.
 *
 * Testnet currently supports: 5m (300s), 1h (3600s), 4h (14400s).
 * 24h excluded (too long for hackathon demo — markets take 24h to resolve).
 */
export const EVENT_CONTRACT_CADENCES_SEC: readonly number[] = [
  300,   // 5m
  3600,  // 1h
  14400, // 4h
];

/** Tolerance for cadence matching (from SDK: ±5s). */
const CADENCE_TOLERANCE_SEC = 5;

/** Valid cadences in minutes for Event Contract temporal analysis. */
export const VALID_EC_MINUTES: readonly number[] = EVENT_CONTRACT_CADENCES_SEC.map(
  (s) => (s / 60) as number
);

/* ═══════════════════════════════════════════════════════ */
/* MarketData (extended with SDK metadata)                */
/* ═══════════════════════════════════════════════════════ */

export interface MarketData {
  /** Underlying asset (e.g. "BTC", "ETH"). */
  asset: string;
  /** Horizon in minutes. */
  horizonMinutes: number;
  /** On-chain market identifier (bytes32 hex). */
  marketId: string;
  /** Pool contract address. */
  pool: string;
  /** BinaryMarket clone contract address. */
  marketAddress: string;
  /** Market expiry timestamp (unix seconds). */
  expiry: number;
  /** Seconds until expiry. */
  secondsLeft: number;
  /** YES outcome token ID. */
  yesTokenId: string;
  /** NO outcome token ID. */
  noTokenId: string;

  /** Per-market quote token decimals (from SDK). */
  quoteDecimals: number;

  /** Normalized last price / probability (0..1). Null until first fill. */
  lastPrice: Probability | null;

  /** Normalized cumulative quote volume. Null if unavailable. */
  volume: QuoteVolume | null;

  /** Market lifecycle status. */
  status: MarketLifecycle;

  /** Market intervalSec as a string (raw from SDK). */
  intervalSec: string;

  /** Human-readable interval label (e.g. "15m", "1h") from SDK. */
  interval: string | null;

  /** Display question text from SDK. */
  question: string;

  /** Resolution mode: "reference" or "fixed". */
  mode: string;

  /** Strike threshold (raw, oracle price scale). */
  strike: string;

  /** Whether this market has been voided. */
  voided: boolean;

  /** Unix seconds when trading opens. */
  tradingStart: number;

  /** When this snapshot was captured (ms since epoch). */
  capturedAt: number;
}

/* ═══════════════════════════════════════════════════════ */
/* Event Contract Semantic Validation                     */
/* ═══════════════════════════════════════════════════════ */

/**
 * Determine if a raw `intervalSec` value matches a known Event Contract cadence.
 * Uses ±5s tolerance (matching SDK CADENCE_TOLERANCE_SEC).
 */
function matchesEventContractCadence(intervalSec: string | null | undefined): boolean {
  if (!intervalSec) return false;
  const sec = parseInt(intervalSec, 10);
  if (isNaN(sec) || sec <= 0) return false;
  return EVENT_CONTRACT_CADENCES_SEC.some(
    (cadence) => Math.abs(sec - cadence) <= CADENCE_TOLERANCE_SEC
  );
}

/**
 * Validate a BinaryMarket as a genuine DreamDEX Event Contract.
 *
 * Checks:
 * - binary/Event Contract market semantics (marketType === "BINARY" implicit via SDK method)
 * - status === "Trading"
 * - voided === false
 * - supported Event Contract cadence (15m, 1h)
 * - necessary metadata exists (asset, marketId, poolAddress, expiry)
 * - sufficient time until expiry (>60s)
 */
function isValidEventContract(bm: BinaryMarket): boolean {
  // Must be Trading status
  if (bm.status !== "Trading") return false;

  // Must not be voided
  if (bm.voided) return false;

  // Must have a recognized Event Contract cadence
  if (!matchesEventContractCadence(bm.intervalSec)) return false;

  // Must have essential metadata
  if (!bm.asset || !bm.marketId || !bm.poolAddress || !bm.expiry) return false;

  // Must have sufficient time left
  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(bm.expiry);
  if (isNaN(expiry) || expiry - now < 60) return false;

  // Must have a positive intervalSec
  const intervalSec = parseInt(bm.intervalSec || "0", 10);
  if (isNaN(intervalSec) || intervalSec <= 0) return false;

  return true;
}

/* ═══════════════════════════════════════════════════════ */
/* Deduplication                                          */
/* ═══════════════════════════════════════════════════════ */

/**
 * Deduplicate markets by asset + cadence.
 * Selection priority:
 * 1. Trading status (already guaranteed by isValidEventContract)
 * 2. Nearest expiry to now (most immediate)
 * 3. Highest volume as tie-break
 * 4. Deterministic marketId tie-break
 */
function deduplicateByCadence(markets: MarketData[]): MarketData[] {
  const map = new Map<string, MarketData>();

  for (const m of markets) {
    const key = `${m.asset}-${m.horizonMinutes}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, m);
      continue;
    }

    // Prefer nearest expiry (most immediate active market)
    if (m.secondsLeft < existing.secondsLeft) {
      map.set(key, m);
      continue;
    }

    // Tie-break: higher volume
    if (m.secondsLeft === existing.secondsLeft) {
      const mVol = m.volume ?? 0;
      const eVol = existing.volume ?? 0;
      if (mVol > eVol) {
        map.set(key, m);
        continue;
      }

      // Final tie-break: deterministic marketId
      if (mVol === eVol && m.marketId < existing.marketId) {
        map.set(key, m);
      }
    }
  }

  return Array.from(map.values());
}

/* ═══════════════════════════════════════════════════════ */
/* Chain-Log Fallback (indexer down)                       */
/* ═══════════════════════════════════════════════════════ */

/**
 * MarketCreated event ABI for chain-log discovery.
 * 13-field MarketCreator event (indexed: marketId, market, pool).
 */
const MARKET_CREATED_ABI = [
  {
    type: "event" as const,
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "market", type: "address", indexed: true },
      { name: "pool", type: "address", indexed: true },
      { name: "yesId", type: "uint256", indexed: false },
      { name: "noId", type: "uint256", indexed: false },
      { name: "collateral", type: "address", indexed: false },
      { name: "asset", type: "string", indexed: false },
      { name: "strike", type: "uint256", indexed: false },
      { name: "tradingStart", type: "uint64", indexed: false },
      { name: "expiry", type: "uint64", indexed: false },
      { name: "oracleQuestionId", type: "uint256", indexed: false },
      { name: "question", type: "string", indexed: false },
      { name: "intervalSec", type: "uint64", indexed: false },
    ],
  },
] as const;

/**
 * Fallback market discovery using chain logs when the indexer is down.
 * Scans MarketCreated events from the MarketCreator factory contract.
 * Limited to last ~40,000 blocks (~1 day on Somnia).
 */
async function discoverFromChainLogs(): Promise<MarketData[]> {
  const exchange = getExchange();
  const publicClient = exchange.client.getViemClient();
  const now = Math.floor(Date.now() / 1000);
  const capturedAt = Date.now();

  const marketCreatorAddress = ADDRESSES.marketCreator as `0x${string}`;
  if (!marketCreatorAddress) {
    console.warn("[discoverFromChainLogs] No marketCreator address configured");
    return [];
  }

  try {
    // Scan last 40,000 blocks for MarketCreated events
    const latestBlock = await publicClient.getBlockNumber();
    const fortyK = BigInt(40000);
    const fromBlock = latestBlock > fortyK ? latestBlock - fortyK : BigInt(0);

    const logs = await publicClient.getLogs({
      address: marketCreatorAddress,
      event: MARKET_CREATED_ABI[0],
      fromBlock,
      toBlock: "latest",
    });

    console.log(`[discoverFromChainLogs] Found ${logs.length} MarketCreated events`);

    const candidates: MarketData[] = [];

    for (const log of logs) {
      try {
        const args = log.args;
        if (!args) continue;

        const asset = args.asset;
        const intervalSec = Number(args.intervalSec);
        const expiry = Number(args.expiry);

        // Filter by collateral (must be testUsdc)
        const collateral = args.collateral?.toLowerCase();
        const expectedCollateral = ADDRESSES.collateral?.toLowerCase() ?? ADDRESSES.testUsdc?.toLowerCase();
        if (collateral && expectedCollateral && collateral !== expectedCollateral) continue;

        // Validate cadence
        if (!EVENT_CONTRACT_CADENCES_SEC.some((c) => Math.abs(intervalSec - c) <= CADENCE_TOLERANCE_SEC)) continue;

        // Skip expired markets
        if (expiry - now < 60) continue;

        // Get full market state from chain
        let marketState: Awaited<ReturnType<typeof exchange.client.getMarketOnchain>> | null = null;
        try {
          marketState = await exchange.client.getMarketOnchain(args.marketId as `0x${string}`);
        } catch {
          continue; // Skip if we can't read market state
        }

        // Must be Trading status (MarketOnchain.status: 1 = Trading)
        if (marketState.status !== 1) continue;
        if (marketState.isVoided) continue;

        const secondsLeft = expiry - now;
        const quoteDecimals = marketState.decimals;

        candidates.push({
          asset: asset ?? "UNKNOWN",
          horizonMinutes: (intervalSec / 60) as HorizonMinutes,
          marketId: args.marketId as string,
          pool: args.pool as string,
          marketAddress: marketState.marketAddress,
          expiry,
          secondsLeft,
          yesTokenId: args.yesId?.toString() ?? "0",
          noTokenId: args.noId?.toString() ?? "0",
          quoteDecimals,
          lastPrice: null, // No lastPrice from chain-log fallback
          volume: null, // No volume from chain-log fallback
          status: "Trading" as MarketLifecycle,
          intervalSec: intervalSec.toString(),
          interval: null,
          question: args.question ?? "",
          mode: "reference",
          strike: args.strike?.toString() ?? "0",
          voided: false,
          tradingStart: Number(args.tradingStart || 0),
          capturedAt,
        });
      } catch {
        // Skip market that fails processing
      }
    }

    return deduplicateByCadence(candidates);
  } catch (e) {
    console.error("[discoverFromChainLogs] Chain-log fallback failed:", e);
    return [];
  }
}

/* ═══════════════════════════════════════════════════════ */
/* Market Discovery                                       */
/* ═══════════════════════════════════════════════════════ */

/**
 * Discover live DreamDEX Event Contract markets via the indexer.
 *
 * Filters applied:
 * - SDK returns only binary markets (listLiveBinaryMarkets)
 * - isValidEventContract: status === Trading, not voided, recognized cadence
 * - Deduplication by asset + cadence (keep nearest expiry / highest volume)
 *
 * Per-market normalization:
 *   - Uses market.quoteDecimals (NOT global 6)
 *   - Returns normalized Probability and QuoteVolume types
 */
export async function discoverMarkets(retries: number = 2): Promise<MarketData[]> {
  const exchange = getExchange();
  const now = Math.floor(Date.now() / 1000);
  const capturedAt = Date.now();

  let rawMarkets: BinaryMarket[] = [];
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      rawMarkets = await exchange.client.listLiveBinaryMarkets({ limit: 50 });
      break;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      console.error(`[discoverMarkets] Failed after ${retries + 1} attempts:`, lastError);
    }
  }

  // Indexer failed — fall back to chain-log discovery
  if (rawMarkets.length === 0) {
    console.warn("[discoverMarkets] Indexer unavailable, falling back to chain-log discovery");
    const fallback = await discoverFromChainLogs();
    if (fallback.length > 0) return fallback;
    console.error("[discoverMarkets] Chain-log fallback also returned empty");
    return [];
  }

  const candidates: MarketData[] = [];

  for (const bm of rawMarkets) {
    try {
      // Semantic Event Contract validation
      if (!isValidEventContract(bm)) continue;

      const expiry = Number(bm.expiry);
      const secondsLeft = expiry - now;
      if (secondsLeft < 60) continue;

      const quoteDecimals = bm.quoteDecimals;
      const lastPrice = normalizeLastPrice(bm.lastPrice, quoteDecimals);
      const volume = normalizeQuoteVolume(bm.cumulativeQuoteVolume, quoteDecimals);

      candidates.push({
        asset: bm.asset,
        horizonMinutes: (Number(bm.intervalSec) / 60) as HorizonMinutes,
        marketId: bm.marketId,
        pool: bm.poolAddress,
        marketAddress: bm.marketAddress,
        expiry,
        secondsLeft,
        yesTokenId: bm.yesTokenId,
        noTokenId: bm.noTokenId,
        quoteDecimals,
        lastPrice,
        volume,
        status: bm.status,
        intervalSec: bm.intervalSec ?? "0",
        interval: bm.interval ?? null,
        question: bm.question ?? "",
        mode: bm.mode ?? "reference",
        strike: bm.strike ?? "0",
        voided: bm.voided ?? false,
        tradingStart: Number(bm.tradingStart || 0),
        capturedAt,
      });
    } catch {
      // Skip market that fails processing
    }
  }

  // Deduplicate by asset + cadence
  const deduped = deduplicateByCadence(candidates);

  // Sort: by asset name, then horizon ascending
  deduped.sort(
    (a, b) =>
      a.asset.localeCompare(b.asset) || a.horizonMinutes - b.horizonMinutes
  );

  return deduped;
}

/**
 * Group Event Contract markets by asset (BTC, ETH, etc.)
 */
export function groupByAsset(
  markets: MarketData[]
): Record<string, MarketData[]> {
  const groups: Record<string, MarketData[]> = {};
  for (const m of markets) {
    if (!groups[m.asset]) groups[m.asset] = [];
    groups[m.asset].push(m);
  }
  return groups;
}
