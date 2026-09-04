"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TradeResult {
  ok: boolean;
  hash?: string;
  orderId?: string;
  filled?: number;
  averagePrice?: number;
  error?: string;
  executor: string;
  disclaimer: string;
}

export function TradeClient() {
  const { isConnected } = useAccount();
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [price, setPrice] = useState("0.50");
  const [result, setResult] = useState<TradeResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTrade() {
    if (!symbol || !amount || !price) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/dreamdex/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, amount: parseFloat(amount), price: parseFloat(price), type: "limit" }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Network error", executor: "demo-testnet-server", disclaimer: "" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 28px 96px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.4rem", letterSpacing: "-0.02em", color: "var(--tape)", margin: 0 }}>
          Trade
        </h1>
        <span style={{ padding: "3px 8px", border: "1px solid rgba(239,230,214,0.2)", borderRadius: 999, fontSize: "0.6rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
          Demo Mode
        </span>
      </div>

      <section>
        <p className="kicker" style={{ marginBottom: 16 }}>Order Form</p>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6, fontFamily: "var(--font-display)" }}>
              Symbol
            </label>
            <Input
              placeholder="e.g. BTC-0-15SEP26-1200/USDso#YES"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={{ height: 40, fontSize: "0.85rem", background: "rgba(239,230,214,0.04)", border: "1px solid rgba(239,230,214,0.12)", color: "var(--tape)", fontFamily: "var(--font-data)" }}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setSide("buy")}
              className="flex-1"
              style={{
                height: 40,
                borderRadius: 4,
                border: `1px solid ${side === "buy" ? "var(--accent-copper)" : "rgba(239,230,214,0.12)"}`,
                background: side === "buy" ? "rgba(232,160,96,0.12)" : "transparent",
                color: side === "buy" ? "var(--accent-copper)" : "var(--muted-foreground)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.82rem",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              BUY
            </button>
            <button
              onClick={() => setSide("sell")}
              className="flex-1"
              style={{
                height: 40,
                borderRadius: 4,
                border: `1px solid ${side === "sell" ? "var(--accent-steel)" : "rgba(239,230,214,0.12)"}`,
                background: side === "sell" ? "rgba(143,192,222,0.12)" : "transparent",
                color: side === "sell" ? "var(--accent-steel)" : "var(--muted-foreground)",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.82rem",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              SELL
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6, fontFamily: "var(--font-display)" }}>
                Amount
              </label>
              <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
                style={{ height: 40, fontSize: "0.85rem", background: "rgba(239,230,214,0.04)", border: "1px solid rgba(239,230,214,0.12)", color: "var(--tape)", fontFamily: "var(--font-data)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6, fontFamily: "var(--font-display)" }}>
                Price (0-1)
              </label>
              <Input type="number" min="0.01" max="0.99" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                style={{ height: 40, fontSize: "0.85rem", background: "rgba(239,230,214,0.04)", border: "1px solid rgba(239,230,214,0.12)", color: "var(--tape)", fontFamily: "var(--font-data)" }} />
            </div>
          </div>

          <button
            className="solid"
            style={{ width: "100%", padding: "14px 20px", fontSize: "1rem", opacity: !isConnected || loading || !symbol ? 0.4 : 1, cursor: !isConnected || loading || !symbol ? "not-allowed" : "pointer" }}
            onClick={handleTrade}
            disabled={!isConnected || loading || !symbol}
          >
            {loading ? "Executing..." : "Execute Trade"}
          </button>

          {!isConnected && (
            <p style={{ fontSize: "0.78rem", color: "var(--accent-warn)", textAlign: "center" }}>Connect your wallet to trade</p>
          )}
        </div>
      </section>

      {result && (
        <section style={{ borderTop: "1px solid rgba(239,230,214,0.14)", paddingTop: 24, marginTop: 24 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <p className="kicker" style={{ margin: 0 }}>Trade Result</p>
            <span style={{
              padding: "3px 8px",
              borderRadius: 999,
              fontSize: "0.6rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: result.ok ? "var(--accent-copper)" : "var(--accent-warn)",
              background: result.ok ? "rgba(232,160,96,0.12)" : "rgba(196,92,58,0.12)",
            }}>
              {result.ok ? "SUCCESS" : "FAILED"}
            </span>
          </div>
          {result.ok ? (
            <div style={{ display: "grid", gap: 6 }}>
              {[
                { label: "Order ID", value: result.orderId },
                { label: "TX Hash", value: result.hash?.slice(0, 20) + "..." },
                { label: "Filled", value: `${result.filled}` },
                { label: "Avg Price", value: `${result.averagePrice}` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between" style={{ fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>{item.label}</span>
                  <span style={{ fontFamily: "var(--font-data)", color: "var(--chalk)" }}>{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "var(--accent-warn)" }}>{result.error}</p>
          )}
          <p style={{ fontSize: "0.72rem", color: "var(--accent-ember)", marginTop: 8 }}>{result.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
