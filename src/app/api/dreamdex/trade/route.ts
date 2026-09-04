import { NextRequest, NextResponse } from "next/server";
import { executeTrade, type TradeParams } from "@/lib/dreamdex/trade";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const params: TradeParams = {
      symbol: body.symbol,
      marketId: body.marketId,
      side: body.side,
      amount: Number(body.amount),
      price: Number(body.price),
      type: body.type || "limit",
    };

    const result = await executeTrade(params);

    return NextResponse.json(result, {
      status: result.ok ? 200 : 400,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        executor: "demo-testnet-server",
        disclaimer:
          "This trade was executed by a demo/testnet executor using a server-side key. " +
          "The connected wallet did NOT sign this transaction.",
      },
      { status: 500 }
    );
  }
}
