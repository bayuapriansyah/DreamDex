import { NextRequest, NextResponse } from "next/server";
import { fetchOrderBook } from "@/lib/dreamdex/orderbook";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json(
      { ok: false, error: "Missing ?symbol= parameter" },
      { status: 400 }
    );
  }

  try {
    const book = await fetchOrderBook(symbol, 10);

    return NextResponse.json({
      ok: true,
      ...book,
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
