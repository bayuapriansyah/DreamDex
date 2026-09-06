// Settlement service — reads settlement, oracle, and redemption data from SDK
// Uses on-chain data only. Never fabricates resolution.
import { getExchange } from "./client";
import type {
  Settlement,
  OracleMetadata,
  SettlementVerification,
  ResolutionEvent,
  ClaimablePosition,
  MarketLifecycle,
  OracleVerificationStatus,
} from "./types";

/* ═══════════════════════════════════════════════════════ */
/* Market Resolution                                       */
/* ═══════════════════════════════════════════════════════ */

/**
 * Read market resolution data from SDK.
 * Returns null if market not found or no resolution data.
 */
export async function getMarketResolution(
  marketId: string
): Promise<SettlementVerification | null> {
  try {
    const exchange = getExchange();

    const resolution = await exchange.client.getMarketResolution(marketId).catch(() => null);

    const closingAnswer: OracleMetadata | null = resolution?.closingAnswer
      ? {
          oracleQuestionId: resolution.closingAnswer.oracleQuestionId,
          numericValue: resolution.closingAnswer.numericValue,
          outcomeLabel: resolution.closingAnswer.outcomeLabel,
          voidReason: resolution.closingAnswer.voidReason,
          resolvedAt: resolution.closingAnswer.resolvedAt,
          txHash: resolution.closingAnswer.txHash,
        }
      : null;

    const openingAnswer: OracleMetadata | null = resolution?.openingAnswer
      ? {
          oracleQuestionId: resolution.openingAnswer.oracleQuestionId,
          numericValue: resolution.openingAnswer.numericValue,
          outcomeLabel: resolution.openingAnswer.outcomeLabel,
          voidReason: resolution.openingAnswer.voidReason,
          resolvedAt: resolution.openingAnswer.resolvedAt,
          txHash: resolution.openingAnswer.txHash,
        }
      : null;

    const resolutionEvents: ResolutionEvent[] = (resolution?.events ?? []).map(
      (e: {
        id: string;
        market: string;
        kind: string;
        winningOutcome: number | null;
        voided?: boolean | null;
        blockNumber: string;
        timestamp: string;
        txHash: string;
      }) => ({
        id: e.id,
        market: e.market,
        kind: e.kind,
        winningOutcome: e.winningOutcome,
        voided: e.voided ?? false,
        blockNumber: e.blockNumber,
        timestamp: e.timestamp,
        txHash: e.txHash,
      })
    );

    const referenceLink = resolution?.reference?.oracleQuestionId ?? null;

    // Derive settlement from resolution events
    const resolvedEvent = resolutionEvents.find(
      (e) => e.kind === "Resolved" || e.voided
    );

    const settlement: Settlement | null = resolvedEvent
      ? {
          marketId,
          asset: "", // Not available from resolution data alone
          horizon: 0, // Not available from resolution data alone
          status: (resolvedEvent.voided ? "Voided" : "Resolved") as MarketLifecycle,
          winningOutcome: resolvedEvent.winningOutcome,
          voided: resolvedEvent.voided,
          settlementFeeBpsTimes1k: null,
          feeRecipient: null,
          pool: null,
          nonce: null,
          backing: null,
          finalized: false,
          payoutNumerators: [],
          resolvedAt: resolvedEvent.timestamp
            ? new Date(Number(resolvedEvent.timestamp) * 1000).toISOString()
            : null,
          finalizedAt: null,
          oracleQuestionId: closingAnswer?.oracleQuestionId ?? null,
          oracleQuestion: null,
        }
      : null;

    // Determine verification status
    const { status: verificationStatus, summary: verificationSummary } =
      determineVerificationStatus(settlement, closingAnswer);

    return {
      marketId,
      settlement,
      closingAnswer,
      openingAnswer,
      referenceLink,
      resolutionEvents,
      verificationStatus,
      verificationSummary,
    };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════ */
/* Verification Status                                     */
/* ═══════════════════════════════════════════════════════ */

function determineVerificationStatus(
  settlement: Settlement | null,
  closingAnswer: OracleMetadata | null,
): { status: OracleVerificationStatus; summary: string } {
  // No settlement data at all
  if (!settlement) {
    return { status: "unavailable", summary: "No settlement data available." };
  }

  // Voided — no oracle verification needed
  if (settlement.voided) {
    return {
      status: "verified",
      summary: "Market voided. Both outcomes redeem at par.",
    };
  }

  // No oracle answer
  if (!closingAnswer) {
    return {
      status: "unavailable",
      summary: "Oracle answer not yet available.",
    };
  }

  // Oracle answered
  if (closingAnswer.resolvedAt) {
    // If winning outcome is set and oracle answered, it's verified
    if (settlement.winningOutcome !== null) {
      return {
        status: "verified",
        summary: `Oracle resolved. Winning outcome: ${settlement.winningOutcome === 0 ? "YES" : "NO"}.`,
      };
    }
    // Oracle answered but no winning outcome yet
    return {
      status: "not_verified",
      summary: "Oracle answered but settlement pending.",
    };
  }

  return {
    status: "unavailable",
    summary: "Oracle answer pending.",
  };
}

/* ═══════════════════════════════════════════════════════ */
/* Claimable Positions                                     */
/* ═══════════════════════════════════════════════════════ */

/**
 * Get claimable positions for a wallet.
 * Returns positions that can be redeemed.
 */
export async function getClaimablePositions(
  account: string
): Promise<ClaimablePosition[]> {
  try {
    const exchange = getExchange();
    const claimable = await exchange.client.getClaimable(account);
    return claimable.map((c) => ({
      marketId: c.marketId,
      pool: c.pool,
      outcomeIdx: c.outcomeIdx as 0 | 1,
      amount: c.amount,
      estPayout: c.estPayout,
      status: c.status,
    }));
  } catch {
    return [];
  }
}

/* ═══════════════════════════════════════════════════════ */
/* Redemption                                              */
/* ═══════════════════════════════════════════════════════ */

export interface RedeemResult {
  ok: boolean;
  hash?: string;
  error?: string;
  amount?: bigint;
  estPayout?: bigint;
}

/**
 * Redeem a claimable position.
 * Follows same execution pattern as Phase 4 trade.
 */
export async function redeemPosition(
  marketId: string,
  amount: bigint,
  outcomeIdx: 0 | 1
): Promise<RedeemResult> {
  try {
    const exchange = getExchange();
    const result = await exchange.trader.redeem({
      marketId: marketId as `0x${string}`,
      amount,
      outcomeIdx,
    });

    if (result.hash) {
      // Wait for receipt
      const client = (exchange.client as unknown as { getViemClient: () => unknown }).getViemClient?.() as
        | { waitForTransactionReceipt: (args: { hash: string }) => Promise<{ status: string }> }
        | undefined;
      if (client) {
        const receipt = await client.waitForTransactionReceipt({ hash: result.hash });
        if (receipt.status === "success") {
          return { ok: true, hash: result.hash, amount, estPayout: amount };
        }
        return { ok: false, error: "Transaction reverted", hash: result.hash };
      }
      return { ok: true, hash: result.hash, amount, estPayout: amount };
    }

    return { ok: false, error: "No transaction hash returned" };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Redemption failed" };
  }
}

/**
 * Redeem multiple claimable positions in one transaction.
 */
export async function redeemManyPositions(
  entries: Array<{ marketId: string; amount: bigint; outcomeIdx: 0 | 1 }>
): Promise<RedeemResult> {
  try {
    const exchange = getExchange();
    const result = await exchange.trader.redeemMany({
      entries: entries.map((e) => ({
        marketId: e.marketId as `0x${string}`,
        amount: e.amount,
        outcomeIdx: e.outcomeIdx,
      })),
    });

    if (result.hash) {
      const client = (exchange.client as unknown as { getViemClient: () => unknown }).getViemClient?.() as
        | { waitForTransactionReceipt: (args: { hash: string }) => Promise<{ status: string }> }
        | undefined;
      if (client) {
        const receipt = await client.waitForTransactionReceipt({ hash: result.hash });
        if (receipt.status === "success") {
          const totalAmount = entries.reduce((a, e) => a + e.amount, BigInt(0));
          return { ok: true, hash: result.hash, amount: totalAmount, estPayout: totalAmount };
        }
        return { ok: false, error: "Transaction reverted", hash: result.hash };
      }
      const totalAmount = entries.reduce((a, e) => a + e.amount, BigInt(0));
      return { ok: true, hash: result.hash, amount: totalAmount, estPayout: totalAmount };
    }

    return { ok: false, error: "No transaction hash returned" };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Batch redemption failed" };
  }
}
