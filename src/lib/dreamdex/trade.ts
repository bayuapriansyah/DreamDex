// Server-side only — DreamDEX trade execution
// LABEL: Demo/testnet executor. NOT signed by the user's wallet.
// TODO: Replace with browser wallet signing (user's wallet signs the tx)
import { getExchange } from "./client";

export interface TradeParams {
  symbol?: string; // tradable symbol, e.g. "BTC-0-15SEP26-1200/USDso#YES"
  marketId?: string; // alternative: resolve symbol from marketId
  side: "buy" | "sell";
  amount: number; // human units (whole contracts)
  price: number; // probability 0-1
  type?: "limit" | "market"; // default "limit"
}

export interface TradeResult {
  ok: boolean;
  hash?: string;
  orderId?: string;
  filled?: number;
  averagePrice?: number;
  error?: string;
  executor: "demo-testnet-server";
  disclaimer: string;
}

const DISCLAIMER =
  "This trade was executed by a demo/testnet executor using a server-side key. " +
  "The connected wallet did NOT sign this transaction. " +
  "For production, trades will be signed by your connected wallet.";

/**
 * Execute a trade on DreamDEX Event Contracts.
 *
 * IMPORTANT: This uses a server-side testnet key for demo execution.
 * The user's wallet is NOT used for signing in this version.
 */
export async function executeTrade(params: TradeParams): Promise<TradeResult> {
  const exchange = getExchange();

  // Validate inputs
  if (!params.symbol && !params.marketId) {
    return {
      ok: false,
      error: "Missing symbol or marketId",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
    };
  }
  if (params.amount <= 0) {
    return {
      ok: false,
      error: "Amount must be positive",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
    };
  }
  if (params.price < 0 || params.price > 1) {
    return {
      ok: false,
      error: "Price must be between 0 and 1",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
    };
  }

  try {
    // Load markets if not already loaded
    if (Object.keys(exchange.markets).length === 0) {
      await exchange.loadMarkets();
    }

    // Resolve symbol from marketId if needed
    let symbol = params.symbol;
    if (!symbol && params.marketId) {
      const found = Object.keys(exchange.markets).find((s) => {
        const mkt = exchange.markets[s];
        if (!mkt) return false;
        const info = mkt.info as Record<string, unknown>;
        return info?.marketId === params.marketId;
      });
      if (!found) {
        return {
          ok: false,
          error: `No symbol found for marketId: ${params.marketId}`,
          executor: "demo-testnet-server",
          disclaimer: DISCLAIMER,
        };
      }
      symbol = found;
    }

    // Validate the symbol exists
    const market = exchange.market(symbol!);
    if (!market) {
      return {
        ok: false,
        error: `Unknown symbol: ${symbol}`,
        executor: "demo-testnet-server",
        disclaimer: DISCLAIMER,
      };
    }

    const order = await exchange.createOrder(
      symbol!,
      params.type || "limit",
      params.side,
      params.amount,
      params.price,
      { timeInForce: params.type === "market" ? "IOC" : "GTC" }
    );

    return {
      ok: true,
      hash: order.txHash || undefined,
      orderId: order.id,
      filled: order.filled,
      averagePrice: order.price,
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
    };
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? e.message
        : String(e);
    return {
      ok: false,
      error: msg,
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
    };
  }
}
