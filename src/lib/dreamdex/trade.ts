// DreamDEX trade execution — hybrid mode
// Browser wallet signs when connected, server fallback for demo.
import type { WalletClient, Address } from "viem";
import { executeOrder } from "./execution";

export interface TradeResult {
  ok: boolean;
  hash?: string;
  orderId?: string;
  filled?: number;
  averagePrice?: number;
  error?: string;
  errorCode?: string;
  executor: "browser-wallet" | "demo-testnet-server";
  disclaimer: string;
  /** Execution state for UI */
  state: string;
  /** Fill status */
  orderStatus?: string;
  /** Progress timeline */
  progress?: Array<{ state: string; message: string; ts: number }>;
}

/**
 * Execute a trade on DreamDEX Event Contracts.
 * Delegates to the full execution engine for pre-flight, simulation, broadcast, and verification.
 *
 * @param walletClient - Optional browser wallet client. When provided, trades are signed by the user's wallet.
 * @param walletAddress - Optional wallet address for browser signing.
 */
export async function executeTrade(params: {
  symbol?: string;
  marketId?: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  type?: "limit" | "market";
  walletClient?: WalletClient;
  walletAddress?: Address;
}): Promise<TradeResult> {
  const ref = params.marketId || params.symbol;
  if (!ref) {
    return {
      ok: false,
      error: "Missing symbol or marketId",
      errorCode: "MISSING_PARAMETERS",
      executor: params.walletClient ? "browser-wallet" : "demo-testnet-server",
      disclaimer: params.walletClient
        ? "Transaction is signed by your connected wallet."
        : "Demo/Testnet Executor — transaction is not signed by your connected wallet.",
      state: "preflight-failed",
    };
  }

  if (params.amount <= 0) {
    return {
      ok: false,
      error: "Amount must be positive",
      errorCode: "INVALID_QUANTITY",
      executor: params.walletClient ? "browser-wallet" : "demo-testnet-server",
      disclaimer: params.walletClient
        ? "Transaction is signed by your connected wallet."
        : "Demo/Testnet Executor — transaction is not signed by your connected wallet.",
      state: "preflight-failed",
    };
  }

  if (params.price < 0.01 || params.price > 0.99) {
    return {
      ok: false,
      error: "Price must be between 0.01 and 0.99",
      errorCode: "INVALID_PRICE",
      executor: params.walletClient ? "browser-wallet" : "demo-testnet-server",
      disclaimer: params.walletClient
        ? "Transaction is signed by your connected wallet."
        : "Demo/Testnet Executor — transaction is not signed by your connected wallet.",
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
      executor: params.walletClient ? "browser-wallet" : "demo-testnet-server",
      disclaimer: params.walletClient
        ? "Transaction is signed by your connected wallet."
        : "Demo/Testnet Executor — transaction is not signed by your connected wallet.",
      state: "preflight-failed",
    };
  }

  const result = await executeOrder({
    marketRef: ref,
    side: params.side,
    amount: params.amount,
    price: params.price,
    type: params.type || "limit",
    walletClient: params.walletClient,
    walletAddress: params.walletAddress,
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
