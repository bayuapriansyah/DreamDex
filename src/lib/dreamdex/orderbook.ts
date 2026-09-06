// Server-side only — DreamDEX orderbook reads via SDK
import { getExchange } from "./client";
import { normalizeBookLevel, midFromBidAsk } from "./normalization";
import type { Probability, TokenAmount } from "./types";

export interface OrderBookLevel {
  price: Probability | null;
  size: TokenAmount | null;
}

export interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: Probability | null;
  bestAsk: Probability | null;
  mid: Probability | null;
  spread: Probability | null;
}

/**
 * Fetch the live orderbook for a binary market by pool address.
 * Uses client.getBinaryOrderBook() which reads directly from chain.
 *
 * Per-market normalization:
 *   Uses market.quoteDecimals (passed as `decimals` parameter).
 *   NOT global COLLATERAL_DECIMALS.
 */
export async function fetchOrderBook(
  pool: string,
  decimals: number,
  depth: number = 10
): Promise<OrderBookData | null> {
  const exchange = getExchange();

  try {
    const book = await exchange.client.getBinaryOrderBook(
      pool as `0x${string}`,
      { depth, decimals }
    );

    // Use shared normalizeBookLevel — consistent with temporal.ts
    const bids = book.yesBids.map((lvl) =>
      normalizeBookLevel(lvl, decimals)
    );
    const asks = book.yesAsks.map((lvl) =>
      normalizeBookLevel(lvl, decimals)
    );

    const bestBid = bids[0]?.price ?? null;
    const bestAsk = asks[0]?.price ?? null;

    // Validate and compute mid/spread using canonical helpers
    const mid = midFromBidAsk(bestBid, bestAsk);
    const spread =
      bestBid !== null && bestAsk !== null && bestBid <= bestAsk
        ? (bestAsk - bestBid)
        : null;

    return { bids, asks, bestBid, bestAsk, mid, spread };
  } catch {
    return null;
  }
}
