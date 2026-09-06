import { NextRequest, NextResponse } from "next/server";
import { getMarketResolution, getClaimablePositions, redeemPosition, redeemManyPositions } from "@/lib/dreamdex/settlement";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET — Read settlement/oracle data for a market
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const marketId = url.searchParams.get("marketId");
    const account = url.searchParams.get("account");

    // Settlement verification for a market
    if (marketId) {
      const verification = await getMarketResolution(marketId);
      return NextResponse.json(
        { ok: true, verification },
        {
          status: 200,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        }
      );
    }

    // Claimable positions for a wallet
    if (account) {
      const claimable = await getClaimablePositions(account);
      return NextResponse.json(
        { ok: true, claimable },
        {
          status: 200,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Missing marketId or account parameter" },
      { status: 400 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * POST — Redeem a claimable position
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Batch redemption
    if (body.entries && Array.isArray(body.entries) && body.entries.length > 0) {
      const entries = body.entries.map((e: { marketId: string; amount: string; outcomeIdx: 0 | 1 }) => ({
        marketId: e.marketId,
        amount: BigInt(e.amount),
        outcomeIdx: e.outcomeIdx,
      }));
      const result = await redeemManyPositions(entries);
      return NextResponse.json(result, {
        status: result.ok ? 200 : 400,
      });
    }

    // Single redemption
    if (!body.marketId || body.amount === undefined || body.outcomeIdx === undefined) {
      return NextResponse.json(
        { ok: false, error: "Missing marketId/amount/outcomeIdx or entries array" },
        { status: 400 }
      );
    }

    const result = await redeemPosition(
      body.marketId,
      BigInt(body.amount),
      body.outcomeIdx
    );

    return NextResponse.json(result, {
      status: result.ok ? 200 : 400,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
