import { NextResponse } from "next/server";
import { getExchange } from "@/lib/dreamdex/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PositionData {
  asset: string;
  marketId: string;
  symbol: string;
  side: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: string;
}

export async function GET() {
  try {
    const exchange = getExchange();
    await exchange.loadMarkets();

    const [positions, balance] = await Promise.all([
      exchange.fetchPositions().catch(() => []),
      exchange.fetchBalance().catch(() => ({})),
    ]);

    const formatted: PositionData[] = [];

    if (Array.isArray(positions)) {
      for (const pos of positions) {
        try {
          const p = pos as unknown as Record<string, unknown>;
          const symbol = (p.symbol as string) || "";
          const side = (p.side as string) || "long";
          const amount = Number(p.amount || p.contracts || 0);
          const entryPrice = Number(p.entryPrice || p.averagePrice || 0);
          const markPrice = Number(p.markPrice || p.currentPrice || entryPrice);
          const pnl = Number(p.unrealizedPnl || p.pnl || 0);

          if (amount === 0) continue;

          const market = exchange.market(symbol);
          const marketRecord = market as unknown as Record<string, unknown> | null;
          const info = marketRecord?.info as Record<string, unknown> | undefined;
          const marketId = (info?.marketId as string) || "";
          const assetMatch = symbol.match(/^([A-Z]+)/);
          const asset = assetMatch ? assetMatch[1] : symbol;

          formatted.push({
            asset,
            marketId,
            symbol,
            side,
            amount,
            entryPrice,
            currentPrice: markPrice,
            pnl,
            pnlPercent: entryPrice > 0 ? (pnl / (entryPrice * amount)) * 100 : 0,
            status: "open",
          });
        } catch {
          continue;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      positions: formatted,
      balance,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg, positions: [], balance: {} },
      { status: 500 }
    );
  }
}
