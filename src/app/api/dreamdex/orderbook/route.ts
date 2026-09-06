import { NextRequest, NextResponse } from "next/server";
import { fetchOrderBook } from "@/lib/dreamdex/orderbook";
import { discoverMarkets } from "@/lib/dreamdex/markets";
import { COLLATERAL_DECIMALS } from "@/lib/dreamdex/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const pool = searchParams.get("pool");

  if (!symbol && !pool) {
    return NextResponse.json(
      { ok: false, error: "Missing ?symbol= or ?pool= parameter" },
      { status: 400 }
    );
  }

  try {
    let resolvedPool = pool;
    let quoteDecimals = COLLATERAL_DECIMALS;

    // If only symbol provided, look up first matching pool address + decimals
    if (!resolvedPool && symbol) {
      const markets = await discoverMarkets();
      const match = markets.find(
        (m) => m.asset.toUpperCase() === symbol.toUpperCase()
      );
      if (!match) {
        return NextResponse.json(
          { ok: false, error: `No live market found for symbol: ${symbol}` },
          { status: 404 }
        );
      }
      resolvedPool = match.pool;
      quoteDecimals = match.quoteDecimals;
    } else if (resolvedPool) {
      // Pool provided directly — look up its quoteDecimals from market data
      const markets = await discoverMarkets();
      const match = markets.find(
        (m) => m.pool.toLowerCase() === resolvedPool!.toLowerCase()
      );
      if (match) {
        quoteDecimals = match.quoteDecimals;
      }
    }

    const book = await fetchOrderBook(resolvedPool!, quoteDecimals);

    if (!book) {
      return NextResponse.json(
        { ok: false, error: "Orderbook not available for this market" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...book,
      pool: resolvedPool,
      quoteDecimals,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
