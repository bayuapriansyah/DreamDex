// Server-side only — DreamDEX market discovery
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { getExchange } from "./client";
import { COLLATERAL_DECIMALS } from "./config";
import { normalizeProbability } from "./normalization";

export interface MarketData {
  asset: string;
  horizonMinutes: number;
  marketId: string;
  pool: string;
  expiry: number;
  secondsLeft: number;
  yesTokenId: string;
  noTokenId: string;
  lastPrice: number | null;
  volume: number | null;
}

/**
 * Discover live DreamDEX binary markets via the indexer.
 * Uses listLiveBinaryMarkets() directly — no full loadMarkets() needed.
 */
export async function discoverMarkets(): Promise<MarketData[]> {
  const exchange = getExchange();
  const now = Math.floor(Date.now() / 1000);

  let rawMarkets: BinaryMarket[];
  try {
    rawMarkets = await exchange.client.listLiveBinaryMarkets({ limit: 50 });
  } catch (e) {
    console.error("listLiveBinaryMarkets failed:", e);
    return [];
  }

  const results: MarketData[] = [];

  for (const bm of rawMarkets) {
    try {
      // Must have time left (at least 60s)
      const expiry = Number(bm.expiry);
      const secondsLeft = expiry - now;
      if (secondsLeft < 60) continue;

      const lastPrice = normalizeProbability(
        bm.lastPrice ? Number(bm.lastPrice) : null
      );
      const volume = bm.cumulativeQuoteVolume
        ? Number(bm.cumulativeQuoteVolume) / 10 ** COLLATERAL_DECIMALS
        : null;

      results.push({
        asset: bm.asset,
        horizonMinutes: Number(bm.intervalSec || 0) / 60,
        marketId: bm.marketId,
        pool: bm.poolAddress,
        expiry,
        secondsLeft,
        yesTokenId: bm.yesTokenId,
        noTokenId: bm.noTokenId,
        lastPrice,
        volume,
      });
    } catch (e) {
      console.warn(`Skip market ${bm.marketId}:`, e);
    }
  }

  // Sort: by asset name, then horizon ascending
  results.sort(
    (a, b) =>
      a.asset.localeCompare(b.asset) || a.horizonMinutes - b.horizonMinutes
  );

  return results;
}

/**
 * Group markets by asset (BTC, ETH, etc.)
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
