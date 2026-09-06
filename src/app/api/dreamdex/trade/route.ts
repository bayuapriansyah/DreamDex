import { NextRequest, NextResponse } from "next/server";
import { executeTrade } from "@/lib/dreamdex/trade";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const result = await executeTrade({
      symbol: body.symbol,
      marketId: body.marketId,
      side: body.side,
      amount: Number(body.amount),
      price: Number(body.price),
      type: body.type || "limit",
    });

    return NextResponse.json(result, {
      status: result.ok ? 200 : 400,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        executor: "demo-testnet-server",
        disclaimer:
          "Demo/Testnet Executor — transaction is not signed by your connected wallet.",
        state: "failed",
      },
      { status: 500 }
    );
  }
}
