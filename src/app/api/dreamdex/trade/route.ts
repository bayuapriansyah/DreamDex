import { NextRequest, NextResponse } from "next/server";
import { executeTrade } from "@/lib/dreamdex/trade";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server-side trade execution endpoint.
 * Used as fallback when browser wallet is not connected.
 * When wallet is connected, trades execute client-side via executeTradeDirect().
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log(`[TRADE API] symbol=${body.symbol} marketId=${body.marketId} side=${body.side} amount=${body.amount} price=${body.price} type=${body.type}`);

    const result = await executeTrade({
      symbol: body.symbol,
      marketId: body.marketId,
      side: body.side,
      amount: Number(body.amount),
      price: Number(body.price),
      type: body.type || "limit",
      // No walletClient — server fallback uses demo executor
    });

    console.log(`[TRADE API] result: ok=${result.ok} state=${result.state} executor=${result.executor} hash=${result.hash ?? "none"} error=${result.error ?? "none"}`);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error(`[TRADE API] Error: ${msg}`);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        errorCode: "EXECUTION_ERROR",
        executor: "demo-testnet-server",
        disclaimer:
          "Demo/Testnet Executor — transaction is not signed by your connected wallet.",
        state: "failed",
        progress: [{ state: "failed", message: msg, ts: Date.now() }],
      },
      { status: 200 }
    );
  }
}
