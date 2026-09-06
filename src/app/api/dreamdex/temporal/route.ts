import { NextRequest, NextResponse } from "next/server";
import { discoverMarkets } from "@/lib/dreamdex/markets";
import { computeTemporalTrajectory } from "@/lib/dreamdex/temporal";
import { buildDecisionContext } from "@/lib/dreamdex/decision";
import { activityTracker } from "@/lib/dreamdex/activity";

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

    // Return available assets for diagnosis
    const availableAssets = [...new Set(markets.map((m) => m.asset))];

    const trajectory = await computeTemporalTrajectory(
      asset.toUpperCase(),
      markets
    );
    const decisionContext = buildDecisionContext(trajectory);

    // Feed activity tracker for temporal activity feed
    activityTracker.update(asset.toUpperCase(), trajectory);

    return NextResponse.json({
      ok: true,
      trajectory,
      decisionContext,
      availableAssets,
      totalMarkets: markets.length,
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
