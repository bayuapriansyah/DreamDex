// Server-side only — Read binary Event Contract positions from SDK
import { getExchange } from "./client";
import { COLLATERAL_DECIMALS } from "./config";
import type { Position, PositionStatus } from "./position";
import { mapPositionStatus } from "./position";
import type { HorizonMinutes } from "./types";

/* ═══════════════════════════════════════════════════════ */
/* Parse interval label to HorizonMinutes                 */
/* ═══════════════════════════════════════════════════════ */

function parseIntervalToMinutes(interval: string | null, intervalSec: string | null): HorizonMinutes {
  if (interval) {
    const map: Record<string, HorizonMinutes> = {
      "15m": 15, "1h": 60,
    };
    if (map[interval]) return map[interval];
  }
  if (intervalSec) {
    const sec = parseInt(intervalSec, 10);
    if (!isNaN(sec)) return Math.round(sec / 60) as HorizonMinutes;
  }
  return 60;
}

/* ═══════════════════════════════════════════════════════ */
/* Fetch Positions                                        */
/* ═══════════════════════════════════════════════════════ */

export interface FetchPositionsResult {
  positions: Position[];
  openOrders: Array<{
    id: string;
    orderId: string;
    side: string;
    price: number;
    quantityRemaining: number;
    filledQuantity: number;
    fullQuantity: number;
    market: { asset: string; interval: string | null; quoteDecimals: number };
  }>;
  recentTrades: Array<{
    id: string;
    fillPrice: number;
    quantity: number;
    timestamp: string;
    txHash: string;
    side: string | null;
    asMaker: boolean;
    market: { asset: string; interval: string | null; quoteDecimals: number };
  }>;
  account: string;
}

/**
 * Read binary Event Contract positions for a wallet.
 * Uses SDK's getPortfolio (indexer-based, binary only).
 *
 * IMPORTANT: This reads from the INDEXER which may lag on-chain state by seconds.
 */
async function fetchPortfolioWithRetry(
  exchange: ReturnType<typeof getExchange>,
  walletAddress: string,
  retries = 2,
  timeoutMs = 15000
): Promise<Awaited<ReturnType<typeof exchange.client.getPortfolio>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await Promise.race([
        exchange.client.getPortfolio(walletAddress),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Indexer timeout — Somnia indexer is responding slowly. Retrying…")), timeoutMs)
        ),
      ]);
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function fetchPositions(walletAddress: string): Promise<FetchPositionsResult> {
  const exchange = getExchange();

  try {
    const portfolio = await fetchPortfolioWithRetry(exchange, walletAddress);

    const positions: Position[] = portfolio.positions.map((p) => {
      const decimals = p.market.quoteDecimals || COLLATERAL_DECIMALS;
      const humanBalance = Number(p.balance) / (10 ** decimals);
      const lastPriceRaw = p.market.lastPrice ? Number(p.market.lastPrice) / (10 ** decimals) : null;
      const horizon = parseIntervalToMinutes(p.market.interval, p.market.intervalSec);
      const direction: "up" | "down" = p.outcomeIndex === 0 ? "up" : "down";

      const status = mapPositionStatus(
        p.market.status,
        humanBalance > 0,
        humanBalance,
        humanBalance,
        p.market.winningOutcome ?? null,
        p.outcomeIndex,
        p.market.voided
      );

      return {
        id: `pos-${p.tokenId}-${p.outcomeIndex}`,
        wallet: walletAddress,
        marketId: p.market.id,
        marketAddress: p.market.marketAddress,
        asset: p.market.asset,
        horizon,
        intervalLabel: p.market.interval ?? `${horizon}m`,
        direction,
        outcomeIndex: p.outcomeIndex,
        quantity: humanBalance,
        entryPrice: lastPriceRaw ?? 0.5,
        entryTimestamp: "", // Not available from portfolio — set on fill
        orderId: "",
        transactionHash: "",
        status: status as PositionStatus,
        marketStatus: p.market.status,
        quoteDecimals: decimals,
        expiry: p.market.expiry,
        lastPrice: lastPriceRaw,
        winningOutcome: p.market.winningOutcome ?? null,
        voided: p.market.voided,
      };
    });

    const openOrders = portfolio.openOrders.map((o) => ({
      id: o.id,
      orderId: o.orderId,
      side: o.side ?? "unknown",
      price: Number(o.price) / (10 ** (o.market.quoteDecimals || COLLATERAL_DECIMALS)),
      quantityRemaining: Number(o.quantityRemaining) / (10 ** (o.market.quoteDecimals || COLLATERAL_DECIMALS)),
      filledQuantity: Number(o.filledQuantity) / (10 ** (o.market.quoteDecimals || COLLATERAL_DECIMALS)),
      fullQuantity: Number(o.fullQuantity) / (10 ** (o.market.quoteDecimals || COLLATERAL_DECIMALS)),
      market: {
        asset: o.market.asset,
        interval: o.market.interval,
        quoteDecimals: o.market.quoteDecimals,
      },
    }));

    const recentTrades = portfolio.trades.map((t) => ({
      id: t.id,
      fillPrice: Number(t.fillPrice) / (10 ** (t.market.quoteDecimals || COLLATERAL_DECIMALS)),
      quantity: Number(t.quantity) / (10 ** (t.market.quoteDecimals || COLLATERAL_DECIMALS)),
      timestamp: t.timestamp,
      txHash: t.txHash,
      side: t.side,
      asMaker: t.asMaker,
      market: {
        asset: t.market.asset,
        interval: t.market.interval,
        quoteDecimals: t.market.quoteDecimals,
      },
    }));

    return {
      positions,
      openOrders,
      recentTrades,
      account: portfolio.account,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to fetch positions: ${msg}`);
  }
}
