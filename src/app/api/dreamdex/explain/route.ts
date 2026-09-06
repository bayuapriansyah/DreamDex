import { NextRequest, NextResponse } from "next/server";
import { discoverMarkets } from "@/lib/dreamdex/markets";
import { computeTemporalTrajectory } from "@/lib/dreamdex/temporal";
import { buildDecisionContext } from "@/lib/dreamdex/decision";
import { generateAIExplanation } from "@/lib/dreamdex/ai";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset");
  const question = searchParams.get("question") ?? undefined;

  if (!asset) {
    return NextResponse.json(
      { ok: false, error: "Missing ?asset= parameter" },
      { status: 400 }
    );
  }

  try {
    const markets = await discoverMarkets();
    const trajectory = await computeTemporalTrajectory(
      asset.toUpperCase(),
      markets
    );
    const decisionContext = buildDecisionContext(trajectory);

    const explanation = await generateAIExplanation(
      trajectory as unknown as Parameters<typeof generateAIExplanation>[0],
      question
    );

    return NextResponse.json({
      ok: true,
      explanation,
      decisionContext,
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
