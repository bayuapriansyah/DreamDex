import { NextResponse } from "next/server";
import { getExchange } from "@/lib/dreamdex/client";
import { CADENCE_LADDER_SEC, CADENCE_TOLERANCE_SEC } from "@somnia-chain/markets-sdk";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Debug endpoint: inspect what markets the testnet actually has.
 * Shows cadence distribution, filter pass/fail, and assets.
 */
export async function GET() {
  const exchange = getExchange();

  try {
    if (Object.keys(exchange.markets).length === 0) {
      await exchange.loadMarkets();
    }

    const rawMarkets = await exchange.client.listLiveBinaryMarkets({ limit: 200 });
    const now = Math.floor(Date.now() / 1000);

    const cadenceBuckets: Record<number, { count: number; assets: Set<string>; statuses: Record<string, number> }> = {};
    const allCadences: Record<number, number> = {};
    const rejected = { expired: 0, locked: 0, voided: 0, unsupported_cadence: 0, no_metadata: 0, low_expiry: 0 };
    const assets = new Set<string>();

    for (const bm of rawMarkets) {
      const intervalSec = parseInt(bm.intervalSec || "0", 10);
      const asset = bm.asset || "UNKNOWN";
      assets.add(asset);

      // Count raw cadence distribution
      if (intervalSec > 0) {
        allCadences[intervalSec] = (allCadences[intervalSec] || 0) + 1;
      }

      // Check why each market passes or fails our filter
      const expiry = Number(bm.expiry);
      const secondsLeft = expiry - now;

      if (secondsLeft < 60) { rejected.expired++; continue; }
      if (bm.status !== "Trading") { rejected.locked++; continue; }
      if (bm.voided) { rejected.voided++; continue; }
      if (!bm.asset || !bm.marketId || !bm.poolAddress) { rejected.no_metadata++; continue; }

      // Check cadence match
      const matchesCadence = CADENCE_LADDER_SEC.some(
        (cadence) => Math.abs(intervalSec - cadence) <= CADENCE_TOLERANCE_SEC
      );
      if (!matchesCadence) { rejected.unsupported_cadence++; continue; }

      // Bucket by cadence
      if (!cadenceBuckets[intervalSec]) {
        cadenceBuckets[intervalSec] = { count: 0, assets: new Set(), statuses: {} };
      }
      cadenceBuckets[intervalSec].count++;
      cadenceBuckets[intervalSec].assets.add(asset);
      cadenceBuckets[intervalSec].statuses[bm.status] = (cadenceBuckets[intervalSec].statuses[bm.status] || 0) + 1;
    }

    // Convert sets to arrays for JSON
    const cadenceReport: Record<string, { count: number; assets: string[]; statuses: Record<string, number> }> = {};
    for (const [k, v] of Object.entries(cadenceBuckets)) {
      cadenceReport[`${k}s (${Math.round(Number(k) / 60)}m)`] = {
        count: v.count,
        assets: Array.from(v.assets),
        statuses: v.statuses,
      };
    }

    return NextResponse.json({
      ok: true,
      totalRaw: rawMarkets.length,
      assets: Array.from(assets),
      cadencesRaw: allCadences,
      cadencesFiltered: cadenceReport,
      rejected,
      cadenceLadder: CADENCE_LADDER_SEC,
      tolerance: CADENCE_TOLERANCE_SEC,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
