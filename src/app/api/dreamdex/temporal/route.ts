import { NextRequest, NextResponse } from "next/server";
import { discoverMarkets } from "@/lib/dreamdex/markets";
import { computeTemporalTrajectory } from "@/lib/dreamdex/temporal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset");

  if (!asset) {
    return NextResponse.json(
      { ok: false, error: "Missing ?asset= parameter (e.g. BTC, ETH)" },
      { status: 400 }
    );
  }

  try {
    const markets = await discoverMarkets();
    const trajectory = await computeTemporalTrajectory(
      asset.toUpperCase(),
      markets
    );

    return NextResponse.json({
      ok: true,
      trajectory,
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
