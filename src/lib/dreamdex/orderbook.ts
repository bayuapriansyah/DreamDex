// Server-side only — DreamDEX orderbook reads
import { getExchange } from "./client";

export interface OrderBookData {
  bids: [number, number][];
  asks: [number, number][];
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spread: number | null;
}

export async function fetchOrderBook(
  symbol: string,
  depth: number = 5
): Promise<OrderBookData> {
  const exchange = getExchange();
  await exchange.loadMarkets();
  const book = await exchange.fetchOrderBook(symbol, depth);

  const bestBid = book.bids[0]?.[0] ?? null;
  const bestAsk = book.asks[0]?.[0] ?? null;
  const mid =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
  const spread =
    bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return {
    bids: book.bids,
    asks: book.asks,
    bestBid,
    bestAsk,
    mid,
    spread,
  };
}
