"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Position {
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

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [balance, setBalance] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        const res = await fetch("/api/dreamdex/positions");
        const data = await res.json();
        if (!fetchedRef.current) {
          if (data.ok) { setPositions(data.positions); setBalance(data.balance); setError(null); }
          else { setError(data.error || "Failed to load positions"); }
        }
      } catch (e: unknown) {
        if (!fetchedRef.current) setError(e instanceof Error ? e.message : "Network error");
      } finally { if (!fetchedRef.current) setLoading(false); }
    }
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => { fetchedRef.current = true; clearInterval(interval); };
  }, []);

  const totalPnl = positions.reduce((a, p) => a + p.pnl, 0);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 28px 96px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.4rem", letterSpacing: "-0.02em", color: "var(--tape)", margin: 0 }}>
          Positions
        </h1>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}
          style={{ height: 28, fontSize: "0.72rem", borderColor: "rgba(239,230,214,0.16)", color: "var(--muted-foreground)" }}>
          Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 32 }}>
        {[
          { label: "Open", value: `${positions.length}` },
          { label: "Total PnL", value: `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(4)}`, color: totalPnl > 0 ? "var(--accent-copper)" : totalPnl < 0 ? "var(--accent-steel)" : "var(--chalk)" },
          { label: "Assets", value: typeof balance === "object" && balance !== null ? Object.keys(balance).filter((k) => k !== "info" && Number((balance as Record<string, unknown>)[k]) > 0).slice(0, 3).join(", ") || "—" : "—" },
        ].map((item) => (
          <div key={item.label} style={{ padding: "16px 14px", background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)", textAlign: "center" }}>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-foreground)", fontFamily: "var(--font-display)", marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: "1.1rem", fontFamily: "var(--font-data)", fontWeight: 500, color: item.color || "var(--chalk)", fontFeatureSettings: "\"tnum\"" }}>{item.value}</div>
          </div>
        ))}
      </div>

      {loading && positions.length === 0 ? (
        <div className="py-12 text-center"><div className="h-8 w-48 mx-auto skeleton rounded" /></div>
      ) : error ? (
        <div className="py-12 text-center" style={{ display: "grid", gap: 8 }}>
          <p style={{ fontSize: "0.82rem", color: "var(--accent-warn)" }}>{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}
            style={{ height: 28, fontSize: "0.72rem", borderColor: "rgba(239,230,214,0.16)", color: "var(--muted-foreground)" }}>Retry</Button>
        </div>
      ) : positions.length === 0 ? (
        <div className="py-12 text-center" style={{ color: "var(--muted-foreground)" }}>
          <p style={{ fontSize: "0.9rem" }}>No active positions.</p>
          <p style={{ fontSize: "0.78rem", marginTop: 4 }}>Execute a trade on <Link href="/markets" style={{ color: "var(--accent-copper)", textDecoration: "underline" }}>Markets</Link> to see positions here.</p>
        </div>
      ) : (
        <section>
          <p className="kicker" style={{ marginBottom: 12 }}>Active Positions</p>
          <div style={{ border: "1px solid rgba(239,230,214,0.08)", overflow: "hidden" }}>
            <div className="grid items-center" style={{ gridTemplateColumns: "80px 60px 60px 1fr 100px", gap: 8, padding: "8px 14px", fontSize: "0.58rem", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--muted-foreground)", borderBottom: "1px solid rgba(239,230,214,0.14)", background: "rgba(239,230,214,0.02)" }}>
              <span>Asset</span><span>Side</span><span>Size</span><span>Entry / Current</span><span style={{ textAlign: "right" }}>PnL</span>
            </div>
            {positions.map((p, i) => (
              <div key={`${p.symbol}-${i}`} className="grid items-center horizon-row" style={{ gridTemplateColumns: "80px 60px 60px 1fr 100px", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(239,230,214,0.06)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tape)" }}>{p.asset}</span>
                <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-data)", fontWeight: 500, color: p.side === "long" ? "var(--accent-copper)" : "var(--accent-steel)" }}>{p.side.toUpperCase()}</span>
                <span style={{ fontSize: "0.82rem", fontFamily: "var(--font-data)", color: "var(--chalk)" }}>{p.amount}</span>
                <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-data)", color: "var(--muted-foreground)", fontFeatureSettings: "\"tnum\"" }}>{(p.entryPrice * 100).toFixed(1)}% → {(p.currentPrice * 100).toFixed(1)}%</span>
                <span style={{ fontSize: "0.82rem", fontFamily: "var(--font-data)", fontWeight: 500, textAlign: "right", color: p.pnl > 0 ? "var(--accent-copper)" : p.pnl < 0 ? "var(--accent-steel)" : "var(--chalk)", fontFeatureSettings: "\"tnum\"" }}>{p.pnl > 0 ? "+" : ""}{p.pnl.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
