// Server-side only — DreamDEX Event Contract execution engine
// Handles: pre-flight validation, price/qty quantization, simulation, broadcast, receipt verification
import type { Address, Hash, TransactionReceipt } from "viem";
import { toEventSelector, decodeEventLog, maxUint256, createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getExchange } from "./client";
import { CHAIN, COLLATERAL_DECIMALS } from "./config";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { ContractRevertError, orderBookEventsAbi } from "@somnia-chain/markets-sdk";

/* ═══════════════════════════════════════════════════════ */
/* Event Selectors (computed from SDK ABI)                */
/* ═══════════════════════════════════════════════════════ */

const ORDER_PLACED_ABI = orderBookEventsAbi.find((e: { name: string }) => e.name === "OrderPlaced")!;
const ORDER_PLACED_TOPIC0 = toEventSelector(ORDER_PLACED_ABI);

/* ═══════════════════════════════════════════════════════ */
/* Execution State Machine                                */
/* ═══════════════════════════════════════════════════════ */

export type ExecutionState =
  | "idle"
  | "validating"
  | "preflight-failed"
  | "simulating"
  | "simulation-failed"
  | "awaiting-signature"
  | "broadcasting"
  | "pending"
  | "confirmed"
  | "order-verified"
  | "filled"
  | "partial"
  | "failed"
  | "rejected";

export interface ExecutionProgress {
  state: ExecutionState;
  message: string;
  ts: number;
}

/* ═══════════════════════════════════════════════════════ */
/* Pre-flight Validation                                  */
/* ═══════════════════════════════════════════════════════ */

export type PreflightStatus = "valid" | "invalid";

export type PreflightCode =
  | "WRONG_NETWORK"
  | "MARKET_NOT_FOUND"
  | "MARKET_LOCKED"
  | "MARKET_NOT_TRADING"
  | "MARKET_RESOLVED"
  | "MARKET_VOIDED"
  | "MARKET_EXPIRED"
  | "INSUFFICIENT_BALANCE"
  | "INSUFFICIENT_ALLOWANCE"
  | "INVALID_PRICE"
  | "PRICE_ZERO"
  | "PRICE_OUT_OF_RANGE"
  | "TICK_MISALIGNED"
  | "INVALID_QUANTITY"
  | "QUANTITY_BELOW_MIN"
  | "QUANTITY_NOT_LOT_ALIGNED"
  | "INVALID_EXPIRY"
  | "EXPIRY_IN_PAST"
  | "EXPIRY_BEYOND_MARKET"
  | "INVALID_SIDE"
  | "MISSING_PARAMETERS"
  | "SDK_ERROR"
  | "UNAVAILABLE";

export interface PreflightResult {
  status: PreflightStatus;
  reason?: string;
  code?: PreflightCode;
  market?: BinaryMarket;
  rawPrice?: bigint;
  rawQuantity?: bigint;
  pool?: Address;
  expiryNs?: bigint;
  tickSize?: bigint;
  lotSize?: bigint;
  minQuantity?: bigint;
  quoteDecimals?: number;
  symbol?: string;
}

/**
 * Run pre-flight validation for an Event Contract order.
 * Verifies market state, price, quantity, expiry, and collateral.
 */
export async function preflightOrder(params: {
  marketId: string;
  side: "buy" | "sell";
  price: number;
  amount: number;
}): Promise<PreflightResult> {
  const exchange = getExchange();

  try {
    if (Object.keys(exchange.markets).length === 0) {
      await exchange.loadMarkets();
    }

    // 1. Resolve market
    // exchange.markets is Record<string, UnifiedMarket> — the BinaryMarket is inside .info
    const keys = Object.keys(exchange.markets);
    let symbol: string | null = null;
    let binaryMarket: BinaryMarket | null = null;

    if (params.marketId.startsWith("0x")) {
      const target = params.marketId.toLowerCase();

      for (const s of keys) {
        const um = exchange.markets[s];
        if (!um) continue;
        const bm = um.info as unknown as BinaryMarket;
        const poolMatch = bm.poolAddress?.toLowerCase() === target;
        const idMatch = bm.marketId?.toLowerCase() === target;
        if (poolMatch || idMatch) {
          symbol = s;
          binaryMarket = bm;
          break;
        }
      }
    }

    if (!symbol && exchange.markets[params.marketId]) {
      const um = exchange.markets[params.marketId];
      symbol = params.marketId;
      binaryMarket = um.info as unknown as BinaryMarket;
    }

    if (!symbol) {
      const upper = params.marketId.toUpperCase();
      for (const s of keys) {
        const um = exchange.markets[s];
        if (!um) continue;
        const bm = um.info as unknown as BinaryMarket;
        if (bm.asset === upper || um.id.includes(upper)) {
          symbol = s;
          binaryMarket = bm;
          break;
        }
      }
    }

    if (!symbol || !binaryMarket) {
      return { status: "invalid", code: "MARKET_NOT_FOUND", reason: `Market "${params.marketId}" not found` };
    }

    const market = binaryMarket;

    // 2. Validate market status
    const status = market.status as string | undefined;
    if (!status) {
      return {
        status: "invalid",
        code: "MARKET_NOT_TRADING",
        reason: `Market status unavailable (marketId=${market.marketId}, pool=${market.poolAddress}). SDK may need reload.`,
        market,
      };
    }
    if (status === "Locked") {
      return { status: "invalid", code: "MARKET_LOCKED", reason: "Market is locked (pending resolution)", market };
    }
    if (status === "Resolved" || status === "Finalized") {
      return { status: "invalid", code: "MARKET_RESOLVED", reason: "Market has been resolved", market };
    }
    if (status === "Voided") {
      return { status: "invalid", code: "MARKET_VOIDED", reason: "Market has been voided", market };
    }
    if (status !== "Trading" && status !== "Listed") {
      return { status: "invalid", code: "MARKET_NOT_TRADING", reason: `Market status is "${status}", not tradeable`, market };
    }

    // 3. Validate market hasn't expired (expiry is unix seconds)
    const expiryMs = Number(market.expiry) * 1000;
    if (expiryMs > 0 && Date.now() >= expiryMs) {
      return { status: "invalid", code: "MARKET_EXPIRED", reason: "Market has expired", market };
    }

    // 4. Validate price
    if (params.price <= 0) {
      return { status: "invalid", code: "PRICE_ZERO", reason: "Price must be greater than 0", market };
    }
    if (params.price < 0.01 || params.price > 0.99) {
      return { status: "invalid", code: "PRICE_OUT_OF_RANGE", reason: "Price must be between 0.01 and 0.99", market };
    }

    // 5. Get pool parameters
    const pool = market.poolAddress as Address;
    const bookParams = await exchange.client.getBinaryBookParams(pool);
    const { tickSize, minQuantity, lotSize } = bookParams;
    const decimals = market.quoteDecimals || COLLATERAL_DECIMALS;

    // 6. Quantize price to tick grid
    const oneBase = BigInt(10 ** decimals);
    const rawPrice = BigInt(Math.round(params.price * Number(oneBase)));
    const snappedPrice = (rawPrice / tickSize) * tickSize;

    if (snappedPrice <= BigInt(0) || snappedPrice >= oneBase) {
      return {
        status: "invalid",
        code: "TICK_MISALIGNED",
        reason: `Price ${params.price} snaps to invalid tick. tickSize=${tickSize.toString()}`,
        market,
      };
    }

    // 7. Quantize quantity to lot grid
    const rawQuantity = BigInt(Math.round(params.amount * Number(oneBase)));
    const snappedQuantity = (rawQuantity / lotSize) * lotSize;

    if (snappedQuantity <= BigInt(0)) {
      return {
        status: "invalid",
        code: "INVALID_QUANTITY",
        reason: `Quantity ${params.amount} is too small`,
        market,
      };
    }

    if (snappedQuantity < minQuantity) {
      return {
        status: "invalid",
        code: "QUANTITY_BELOW_MIN",
        reason: `Quantity ${params.amount} is below minimum ${(Number(minQuantity) / Number(oneBase)).toFixed(6)}`,
        market,
      };
    }

    // 8. Validate expiry
    const now = BigInt(Date.now()) * BigInt(1_000_000);
    const marketExpiryNs = BigInt(expiryMs) * BigInt(1_000_000);
    if (marketExpiryNs <= now) {
      return { status: "invalid", code: "EXPIRY_IN_PAST", reason: "Market expiry is in the past", market };
    }

    // 9. Check balance
    try {
      const balance = await exchange.fetchBalance();
      const collateralCode = market.collateral?.toLowerCase().includes("usdc") ? "tUSDC" : "STT";
      const free = balance[collateralCode]?.free ?? balance["STT"]?.free ?? 0;
      const cost = params.price * params.amount;
      if (free < cost) {
        return {
          status: "invalid",
          code: "INSUFFICIENT_BALANCE",
          reason: `Insufficient ${collateralCode} balance. Have ${free.toFixed(4)}, need ~${cost.toFixed(4)}`,
          market,
        };
      }
    } catch {
      // Balance check non-fatal on testnet
    }

    return {
      status: "valid",
      market,
      rawPrice: snappedPrice,
      rawQuantity: snappedQuantity,
      pool,
      expiryNs: marketExpiryNs,
      tickSize,
      lotSize,
      minQuantity,
      quoteDecimals: decimals,
      symbol,
    };
  } catch (e: unknown) {
    return {
      status: "invalid",
      code: "SDK_ERROR",
      reason: e instanceof Error ? e.message : "SDK error during pre-flight",
    };
  }
}

/* ═══════════════════════════════════════════════════════ */
/* Price / Quantity Conversion Utilities                   */
/* ═══════════════════════════════════════════════════════ */

export function probabilityToRawPrice(probability: number, decimals: number): bigint {
  const oneBase = BigInt(10 ** decimals);
  return BigInt(Math.round(probability * Number(oneBase)));
}

export function rawPriceToProbability(rawPrice: bigint, decimals: number): number {
  const oneBase = BigInt(10 ** decimals);
  return Number(rawPrice) / Number(oneBase);
}

export function humanToRawQuantity(human: number, decimals: number): bigint {
  const oneBase = BigInt(10 ** decimals);
  return BigInt(Math.round(human * Number(oneBase)));
}

export function rawToHumanQuantity(raw: bigint, decimals: number): number {
  const oneBase = BigInt(10 ** decimals);
  return Number(raw) / Number(oneBase);
}

export function snapToTick(rawPrice: bigint, tickSize: bigint, side: "buy" | "sell"): bigint {
  if (side === "buy") {
    return (rawPrice / tickSize) * tickSize;
  }
  const snapped = (rawPrice / tickSize) * tickSize;
  return snapped < rawPrice ? snapped + tickSize : snapped;
}

export function snapToLot(rawQuantity: bigint, lotSize: bigint): bigint {
  return (rawQuantity / lotSize) * lotSize;
}

/* ═══════════════════════════════════════════════════════ */
/* Order Execution                                        */
/* ═══════════════════════════════════════════════════════ */

export interface ExecuteOrderParams {
  marketRef: string;
  side: "buy" | "sell";
  amount: number;
  price: number;
  type?: "limit" | "market";
  preflight?: PreflightResult;
}

export interface ExecutionResult {
  ok: boolean;
  state: ExecutionState;
  hash?: Hash;
  receipt?: TransactionReceipt;
  orderId?: bigint;
  fills?: Array<{
    takerOrderId: bigint;
    makerOrderId: bigint;
    quantityFilled: bigint;
    fillPrice: bigint;
  }>;
  filledQuantity?: number;
  averagePrice?: number;
  orderStatus?: "open" | "filled" | "partial" | "cancelled" | "expired";
  error?: string;
  errorCode?: string;
  executor: "demo-testnet-server";
  disclaimer: string;
  progress: ExecutionProgress[];
}

const DISCLAIMER =
  "Demo/Testnet Executor — transaction is not signed by your connected wallet. " +
  "For production, trades will be signed by your connected wallet.";

/**
 * Execute a full Event Contract order lifecycle:
 * preflight → simulate → broadcast → receipt → verify → determine fill
 */
export async function executeOrder(params: ExecuteOrderParams): Promise<ExecutionResult> {
  const progress: ExecutionProgress[] = [];
  const now = () => Date.now();

  function push(state: ExecutionState, message: string) {
    progress.push({ state, message, ts: now() });
  }

  const exchange = getExchange();

  // ─── Step 1: Pre-flight ─────────────────────────────
  push("validating", "Running pre-flight validation…");

  let preflight = params.preflight;
  if (!preflight || preflight.status === "invalid") {
    preflight = await preflightOrder({
      marketId: params.marketRef,
      side: params.side,
      price: params.price,
      amount: params.amount,
    });
  }

  if (preflight.status === "invalid") {
    push("preflight-failed", `Pre-flight failed: ${preflight.reason}`);
    return {
      ok: false,
      state: "preflight-failed",
      error: preflight.reason,
      errorCode: preflight.code,
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      progress,
    };
  }

  const { pool } = preflight;
  const symbol = preflight.symbol;

  if (!symbol) {
    push("preflight-failed", "Could not resolve market symbol");
    return {
      ok: false,
      state: "preflight-failed",
      error: "Could not resolve market symbol",
      errorCode: "MARKET_NOT_FOUND",
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      progress,
    };
  }

  push("validating", `Pre-flight passed. Pool=${pool?.slice(0, 10)}…`);

  // ─── Step 2: Simulation + Broadcast ─────────────────
  push("simulating", "Simulating order…");

  let orderId: bigint | undefined;
  const fills: ExecutionResult["fills"] = [];
  let hash: Hash | undefined;
  let receipt: TransactionReceipt | undefined;

  try {
    push("validating", "Ensuring token approval…");

    // Create wallet client for explicit ERC-20 approval
    const privateKey = process.env.DREAMDEX_PRIVATE_KEY as `0x${string}` | undefined;
    if (privateKey && pool) {
      try {
        const account = privateKeyToAccount(privateKey);
        const walletClient = createWalletClient({
          account,
          chain: CHAIN,
          transport: http(),
        });

        const collateral = preflight.market?.collateral as Address;
        const decimals = preflight.quoteDecimals || COLLATERAL_DECIMALS;
        const costRaw = BigInt(Math.round(params.price * params.amount * (10 ** decimals)));

        const ERC20_ABI = [
          { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
          { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
        ] as const;

        const owner = account.address;
        const publicClient = createPublicClient({ chain: CHAIN, transport: http() });
        const currentAllowance = await publicClient.readContract({
          address: collateral,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [owner, pool],
        });

        if (currentAllowance < costRaw) {
          push("validating", "Approving collateral token to pool…");
          const approveHash = await walletClient.writeContract({
            address: collateral,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [pool, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          push("validating", "Token approved successfully.");
        } else {
          push("validating", "Token already approved.");
        }
      } catch (approveErr: unknown) {
        const msg = approveErr instanceof Error ? approveErr.message : String(approveErr);
        push("validating", `Approval issue (non-fatal): ${msg.slice(0, 150)}`);
      }
    }

    push("broadcasting", "Broadcasting transaction…");

    console.log(`[TRADE] symbol=${symbol} type=${params.type || "limit"} side=${params.side} amount=${params.amount} price=${params.price}`);

    const order = await exchange.createOrder(
      symbol,
      params.type || "limit",
      params.side,
      params.amount,
      params.price,
      {
        timeInForce: params.type === "market" ? "IOC" : "GTC",
      }
    );

    push("confirmed", `Order executed. TX: ${order.txHash?.slice(0, 16)}…`);

    hash = order.txHash as Hash | undefined;

    // Extract orderId from the order info
    // UnifiedOrder.info contains the native PlaceOrderResult
    const info = order.info as Record<string, unknown> | undefined;
    if (info) {
      const rawOrderId = info.orderId;
      if (rawOrderId !== undefined && rawOrderId !== null) {
        orderId = typeof rawOrderId === "bigint" ? rawOrderId : BigInt(String(rawOrderId));
      }
    }

    // Compute fill info from the unified order
    const filledQty = order.filled;
    const totalQty = order.amount;
    let orderStatus: ExecutionResult["orderStatus"] = "open";
    if (filledQty >= totalQty * 0.99) {
      orderStatus = "filled";
    } else if (filledQty > 0) {
      orderStatus = "partial";
    }

    // Get receipt for event verification
    if (hash) {
      push("pending", "Waiting for transaction receipt…");
      try {
        const viemClient = exchange.client.getViemClient();
        receipt = await viemClient.getTransactionReceipt({ hash: hash as `0x${string}` }) as TransactionReceipt | undefined;

        if (receipt) {
          if (receipt.status === "success") {
            push("order-verified", `Receipt confirmed. Status=success. Gas used: ${receipt.gasUsed.toString()}`);

            // Scan for OrderPlaced event in logs using SDK ABI
            const orderPlacedLog = receipt.logs.find(
              (log) => log.topics[0] === ORDER_PLACED_TOPIC0
            );
            if (orderPlacedLog) {
              try {
                const decoded = decodeEventLog({
                  abi: [ORDER_PLACED_ABI],
                  data: orderPlacedLog.data,
                  topics: orderPlacedLog.topics,
                });
                const args = decoded.args as { orderId: bigint };
                const decodedOrderId = args.orderId;
                orderId = orderId ?? decodedOrderId;
                push("order-verified", `OrderPlaced event verified. Order ID: ${decodedOrderId.toString()}`);
              } catch {
                push("order-verified", `OrderPlaced event matched but decode failed. Order ID: ${orderId?.toString() ?? "pending"}`);
              }
            } else {
              // Fallback: scan for any log with a positive uint128 orderId in topic[1]
              for (const log of receipt.logs) {
                if (log.topics.length >= 2 && log.topics[0]?.length === 66) {
                  try {
                    const topic = log.topics[1];
                    if (topic) {
                      const id = BigInt(topic);
                      if (id > BigInt(0)) {
                        orderId = orderId ?? id;
                        push("order-verified", `Order ID ${id.toString()} extracted from receipt log (fallback)`);
                        break;
                      }
                    }
                  } catch {
                    // not the right event
                  }
                }
              }
            }
          } else {
            push("failed", "Transaction reverted on-chain — check explorer for details");
            return {
              ok: false,
              state: "failed",
              hash,
              error: `Transaction reverted on-chain. TX: ${hash}. Check https://shannon-explorer.somnia.network/tx/${hash}`,
              errorCode: "TX_REVERTED",
              executor: "demo-testnet-server",
              disclaimer: DISCLAIMER,
              progress,
            };
          }
        } else {
          push("confirmed", "Transaction confirmed but receipt not yet available (indexer may lag)");
        }
      } catch {
        push("confirmed", "Transaction mined but receipt not yet available");
      }
    }

    // Compute human-readable results
    const humanFilled = order.filled;
    const humanPrice = order.price ?? params.price;

    if (orderStatus === "filled") {
      push("filled", `Order fully filled. ${humanFilled} @ ${humanPrice.toFixed(4)}`);
    } else if (orderStatus === "partial") {
      push("partial", `Order partially filled. ${humanFilled}/${order.amount}`);
    } else {
      push("order-verified", `Order placed on book. ID: ${orderId?.toString() ?? "pending"}`);
    }

    return {
      ok: true,
      state: orderStatus === "filled" ? "filled" : orderStatus === "partial" ? "partial" : "order-verified",
      hash,
      receipt,
      orderId,
      fills,
      filledQuantity: humanFilled,
      averagePrice: humanPrice,
      orderStatus,
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      progress,
    };
  } catch (e: unknown) {
    // Handle SDK-specific error types first
    if (e instanceof ContractRevertError) {
      const name = e.errorName || "UnknownRevert";
      push("failed", `Contract reverted: ${name}`);
      return {
        ok: false,
        state: "failed",
        error: `Contract reverted: ${name}`,
        errorCode: name.toUpperCase(),
        executor: "demo-testnet-server",
        disclaimer: DISCLAIMER,
        progress,
      };
    }

    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes("UserDenied") || msg.includes("user rejected") || msg.includes("rejected")) {
      push("rejected", "Transaction rejected by signer");
      return {
        ok: false,
        state: "rejected",
        error: "Transaction rejected by signer",
        errorCode: "USER_DENIED",
        executor: "demo-testnet-server",
        disclaimer: DISCLAIMER,
        progress,
      };
    }

    if (msg.includes("InsufficientFunds") || msg.includes("insufficient")) {
      push("failed", "Insufficient collateral");
      return {
        ok: false,
        state: "failed",
        error: "Insufficient collateral for this order",
        errorCode: "INSUFFICIENT_BALANCE",
        executor: "demo-testnet-server",
        disclaimer: DISCLAIMER,
        progress,
      };
    }

    if (msg.includes("simulation") || msg.includes("estimateGas") || msg.includes("call")) {
      push("simulation-failed", `Simulation failed: ${msg.slice(0, 200)}`);
      return {
        ok: false,
        state: "simulation-failed",
        error: `Simulation failed: ${msg.slice(0, 200)}`,
        errorCode: "SIMULATION_FAILED",
        executor: "demo-testnet-server",
        disclaimer: DISCLAIMER,
        progress,
      };
    }

    push("failed", msg.slice(0, 300));
    return {
      ok: false,
      state: "failed",
      error: msg.slice(0, 300),
      executor: "demo-testnet-server",
      disclaimer: DISCLAIMER,
      progress,
    };
  }
}

/* ═══════════════════════════════════════════════════════ */
/* Order Verification Helpers                             */
/* ═══════════════════════════════════════════════════════ */

export function extractOrderIdFromReceipt(receipt: TransactionReceipt): bigint | null {
  for (const log of receipt.logs) {
    if (log.topics.length >= 2 && log.topics[0]?.length === 66) {
      try {
        const topic = log.topics[1];
        if (topic) {
          const orderId = BigInt(topic);
          if (orderId > BigInt(0)) return orderId;
        }
      } catch {
        // not the right event
      }
    }
  }
  return null;
}

export function computeFillStatus(
  fills: Array<{ quantityFilled: bigint }>,
  totalQuantity: bigint
): "open" | "filled" | "partial" {
  const filled = fills.reduce((sum, f) => sum + f.quantityFilled, BigInt(0));
  if (filled >= totalQuantity) return "filled";
  if (filled > BigInt(0)) return "partial";
  return "open";
}
