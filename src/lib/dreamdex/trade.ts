// Server-side only — DreamDEX trade execution
// LABEL: Demo/testnet executor. NOT signed by the user's wallet.
import { executeOrder } from "./execution";

export interface TradeResult {
  ok: boolean;
  hash?: string;
  orderId?: string;
  filled?: number;
  averagePrice?: number;
  error?: string;
  errorCode?: string;
  executor: "demo-testnet-server";
  disclaimer: string;
  /** Execution state for UI */
  state: string;
  /** Fill status */
  orderStatus?: string;
  /** Progress timeline */
  progress?: Array<{ state: string; message: string; ts: number }>;
}

const DISCLAIMER =
  "Demo/Testnet Executor — transaction is not signed by your connected wallet. " +
  "For production, trades will be signed by your connected wallet.";

/**
 * Execute a trade on DreamDEX Event Contracts.
 * Delegates to the full execution engine for pre-flight, simulation, broadcast, and verification.
 */
export async function executeTrade(params: {
  symbol?: string;
  marketId?: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  type?: "limit" | "market";
}): Promise<TradeResult> {
  const ref = params.marketId || params.symbol;
  if (!ref) {
    return {
      ok: false,
      error: "Missing symbol or marketId",
      errorCode: "MISSING_PARAMETERS",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      state: "preflight-failed",
    };
  }

  if (params.amount <= 0) {
    return {
      ok: false,
      error: "Amount must be positive",
      errorCode: "INVALID_QUANTITY",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      state: "preflight-failed",
    };
  }

  if (params.price < 0.01 || params.price > 0.99) {
    return {
      ok: false,
      error: "Price must be between 0.01 and 0.99",
      errorCode: "INVALID_PRICE",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      state: "preflight-failed",
    };
  }

  // Strategic range check — prevent extreme-probability entries with poor risk/reward
  const MIN_STRATEGIC = 0.10;
  const MAX_STRATEGIC = 0.90;
  if (params.price < MIN_STRATEGIC || params.price > MAX_STRATEGIC) {
    return {
      ok: false,
      error: `Entry at ${(params.price * 100).toFixed(1)}% is outside the strategic range (${(MIN_STRATEGIC * 100)}%–${(MAX_STRATEGIC * 100)}%). Market strongly ${params.price < MIN_STRATEGIC ? "doubts" : "favors"} this outcome — risk/reward is unfavorable.`,
      errorCode: "PRICE_OUT_OF_STRATEGIC_RANGE",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      state: "preflight-failed",
    };
  }

  const result = await executeOrder({
    marketRef: ref,
    side: params.side,
    amount: params.amount,
    price: params.price,
    type: params.type || "limit",
  });

  return {
    ok: result.ok,
    hash: result.hash,
    orderId: result.orderId?.toString(),
    filled: result.filledQuantity,
    averagePrice: result.averagePrice,
    error: result.error,
    errorCode: result.errorCode,
    executor: result.executor,
    disclaimer: result.disclaimer,
    state: result.state,
    orderStatus: result.orderStatus,
    progress: result.progress.map((p) => ({ state: p.state, message: p.message, ts: p.ts })),
  };
}
