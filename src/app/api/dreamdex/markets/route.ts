import { NextResponse } from "next/server";
import { discoverMarkets, groupByAsset } from "@/lib/dreamdex/markets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const markets = await discoverMarkets();
    const grouped = groupByAsset(markets);

    return NextResponse.json({
      ok: true,
      markets,
      grouped,
      count: markets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        markets: [],
        grouped: {},
        count: 0,
      },
      { status: 500 }
    );
  }
}
