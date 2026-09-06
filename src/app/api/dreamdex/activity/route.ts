import { NextResponse } from "next/server";
import { activityTracker } from "@/lib/dreamdex/activity";
import type { ActivityEventType } from "@/lib/dreamdex/activity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const asset = searchParams.get("asset") || undefined;
    const type = searchParams.get("type") as ActivityEventType | null;

    const filter: { asset?: string; type?: ActivityEventType } = {};
    if (asset) filter.asset = asset;
    if (type) filter.type = type;

    const events = activityTracker.getEvents(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    return NextResponse.json({ ok: true, events, count: events.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
