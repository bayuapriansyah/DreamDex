import { NextRequest, NextResponse } from "next/server";
import { fetchPositions } from "@/lib/dreamdex/positions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const wallet = url.searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: "Missing wallet parameter" },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return NextResponse.json(
        { ok: false, error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    const result = await fetchPositions(wallet);

    return NextResponse.json(
      {
        ok: true,
        positions: result.positions,
        openOrders: result.openOrders,
        recentTrades: result.recentTrades,
        account: result.account,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}

/**
 * POST — Save entry thesis (client-side localStorage)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.positionId || !body.entryThesis) {
      return NextResponse.json(
        { ok: false, error: "Missing positionId or entryThesis" },
        { status: 400 }
      );
    }
    // Thesis is stored client-side via localStorage
    // This endpoint is a no-op that confirms the save request
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * PUT — Save comparison (client-side localStorage)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.positionId || !body.comparison) {
      return NextResponse.json(
        { ok: false, error: "Missing positionId or comparison" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
