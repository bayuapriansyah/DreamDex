"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useSearchParams } from "next/navigation";
import { formatHorizon, formatProb, pctStr } from "@/lib/dreamdex/formatting";

/* ═══════════════════════════════════════════════════════ */
/* Types                                                  */
/* ═══════════════════════════════════════════════════════ */

type ExecState =
  | "idle"
  | "validating"
  | "preflight-failed"
  | "simulating"
  | "simulation-failed"
  | "awaiting-signature"
  | "broadcasting"
  | "pending"
  | "confirmed"
  | "order-verified"
  | "filled"
  | "partial"
  | "failed"
  | "rejected";

interface TradeResult {
  ok: boolean;
  hash?: string;
  orderId?: string;
  filled?: number;
  averagePrice?: number;
  error?: string;
  errorCode?: string;
  executor: string;
  disclaimer: string;
  state: ExecState;
  orderStatus?: string;
  progress?: Array<{ state: string; message: string; ts: number }>;
}

interface MarketOption {
  marketId: string;
  asset: string;
  horizonMinutes: number;
  lastPrice: number | null;
  pool: string;
  secondsLeft: number;
  label: string;
}

const STATE_LABELS: Record<ExecState, string> = {
  idle: "IDLE",
  validating: "VALIDATING",
  "preflight-failed": "PRE-FLIGHT FAILED",
  simulating: "SIMULATING",
  "simulation-failed": "SIMULATION FAILED",
  "awaiting-signature": "AWAITING SIGNATURE",
  broadcasting: "BROADCASTING",
  pending: "PENDING",
  confirmed: "CONFIRMED",
  "order-verified": "ORDER VERIFIED",
  filled: "FILLED",
  partial: "PARTIALLY FILLED",
  failed: "FAILED",
  rejected: "REJECTED",
};

const STATE_COLORS: Record<ExecState, string> = {
  idle: "var(--text-secondary)",
  validating: "var(--accent-secondary)",
  "preflight-failed": "var(--accent-warn)",
  simulating: "var(--accent-secondary)",
  "simulation-failed": "var(--accent-warn)",
  "awaiting-signature": "var(--accent-ember)",
  broadcasting: "var(--accent-ember)",
  pending: "var(--accent)",
  confirmed: "var(--accent)",
  "order-verified": "var(--accent)",
  filled: "var(--accent)",
  partial: "var(--accent-ember)",
  failed: "var(--accent-warn)",
  rejected: "var(--accent-warn)",
};

/* ═══════════════════════════════════════════════════════ */
/* Component                                              */
/* ═══════════════════════════════════════════════════════ */

export function TradeClient() {
  const { isConnected } = useAccount();
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketOption | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("10");
  const [price, setPrice] = useState("0.50");
  const [result, setResult] = useState<TradeResult | null>(null);
  const [execState, setExecState] = useState<ExecState>("idle");
  const [loading, setLoading] = useState(false);
  const [marketsLoading, setMarketsLoading] = useState(true);

  // Analysis context from URL params (passed from Analyze page)
  const analysisContext = useMemo(() => {
    const from = searchParams.get("from");
    if (from !== "analyze") return null;
    return {
      asset: searchParams.get("asset") || "",
      horizon: parseInt(searchParams.get("horizon") || "60", 10),
      probability: parseFloat(searchParams.get("prob") || "0"),
      state: searchParams.get("state") || "",
      confidence: parseFloat(searchParams.get("confidence") || "0"),
      reversalRisk: parseFloat(searchParams.get("revrisk") || "0"),
      actionability: searchParams.get("actionability") || "low",
    };
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dreamdex/markets", { cache: "no-store" });
        const data = await res.json();
        if (data.ok && data.markets) {
          const opts: MarketOption[] = data.markets
            .filter((m: { secondsLeft: number }) => m.secondsLeft > 60)
            .map((m: { marketId: string; asset: string; horizonMinutes: number; lastPrice: number | null; pool: string; secondsLeft: number }) => ({
              ...m,
              label: `${m.asset} · ${formatHorizon(m.horizonMinutes)} · ${m.lastPrice !== null ? `${formatProb(m.lastPrice)}%` : "—"}`,
            }))
            .sort((a: MarketOption, b: MarketOption) => a.asset.localeCompare(b.asset) || a.horizonMinutes - b.horizonMinutes);
          setMarkets(opts);

          // Auto-select market from analysis context
          if (analysisContext) {
            const match = opts.find(
              (m) =>
                m.asset.toUpperCase() === analysisContext.asset.toUpperCase() &&
                m.horizonMinutes === analysisContext.horizon
            );
            if (match) {
              setSelectedMarket(match);
              setPrice(match.lastPrice != null ? match.lastPrice.toFixed(2) : analysisContext.probability > 0 ? analysisContext.probability.toFixed(2) : "0.50");
              // Auto-set side based on state
              if (analysisContext.state.includes("bullish")) {
                setSide("buy");
              } else if (analysisContext.state.includes("bearish")) {
                setSide("sell");
              }
            }
          }
        }
      } catch {
        // silent
      } finally {
        setMarketsLoading(false);
      }
    }
    void load();
  }, []);

  function handleSelectMarket(e: React.ChangeEvent<HTMLSelectElement>) {
    const idx = parseInt(e.target.value, 10);
    if (idx >= 0 && idx < markets.length) {
      const m = markets[idx];
      setSelectedMarket(m);
      setPrice(m.lastPrice != null ? m.lastPrice.toFixed(2) : "0.50");
    }
  }

  async function handleTrade() {
    if (!selectedMarket || !amount || !price) return;
    setLoading(true);
    setResult(null);
    setExecState("validating");

    try {
      const res = await fetch("/api/dreamdex/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.marketId,
          side,
          amount: parseFloat(amount),
          price: parseFloat(price),
          type: "limit",
        }),
      });
      const data: TradeResult = await res.json();
      setResult(data);
      setExecState(data.state);
    } catch (e: unknown) {
      const errState: ExecState = "failed";
      setResult({
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
        executor: "demo-testnet-server",
        disclaimer: "",
        state: errState,
      });
      setExecState(errState);
    } finally {
      setLoading(false);
    }
  }

  function resetTrade() {
    setResult(null);
    setExecState("idle");
  }

  const isActive = execState !== "idle" && execState !== "preflight-failed" && execState !== "failed" && execState !== "rejected" && execState !== "simulation-failed";

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 580, paddingTop: 32, paddingBottom: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(28px, 5vw, 40px)",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          Trade
        </h1>
        <span
          className="status-pill"
          style={{
            color: "var(--text-secondary)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          DEMO MODE
        </span>
      </div>

      {/* Disclaimer */}
      <div
        className="animate-fade-up delay-1"
        style={{
          padding: "10px 14px",
          background: "var(--accent-warn-muted)",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: "var(--radius-md)",
          marginBottom: 24,
        }}
      >
        <p style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)" }}>
          Demo/Testnet Executor — transaction is not signed by your connected wallet.
        </p>
      </div>

      {/* Analysis Context — from Analyze page */}
      {analysisContext && (
        <div
          className="card animate-fade-up delay-1"
          style={{ padding: 20, marginBottom: 20, borderLeft: "3px solid var(--accent)" }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <span className="form-label" style={{ marginBottom: 0 }}>YOUR ANALYSIS</span>
            <span className="status-pill" style={{ color: "var(--accent)", background: "rgba(245,158,11,0.1)", fontSize: 10 }}>
              FROM ANALYZE
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Asset", value: `${analysisContext.asset} · ${formatHorizon(analysisContext.horizon)}` },
              { label: "Current Conviction", value: analysisContext.probability > 0 ? `${pctStr(analysisContext.probability, 1)}%` : "—" },
              { label: "Regime", value: analysisContext.state.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
              { label: "Actionability", value: analysisContext.actionability.toUpperCase(), color: analysisContext.actionability === "high" ? "var(--accent)" : analysisContext.actionability === "low" ? "var(--accent-warn)" : "var(--text-primary)" },
            ].map((item) => (
              <div key={item.label}>
                <div className="form-label" style={{ marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontFamily: "var(--font-data)", fontWeight: 600, color: item.color || "var(--text-primary)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3" style={{ marginTop: 10 }}>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Signal Confidence</div>
              <div style={{ fontSize: 13, fontFamily: "var(--font-data)", fontWeight: 600, color: analysisContext.confidence > 0.5 ? "var(--accent)" : "var(--text-primary)" }}>
                {pctStr(analysisContext.confidence, 0)}%
              </div>
            </div>
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Reversal Risk</div>
              <div style={{ fontSize: 13, fontFamily: "var(--font-data)", fontWeight: 600, color: analysisContext.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)" }}>
                {pctStr(analysisContext.reversalRisk, 0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Form */}
      <section className="card animate-fade-up delay-2" style={{ padding: 28 }}>
        <div className="form-label" style={{ marginBottom: 16 }}>Order Form</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Market selector */}
          <div>
            <label className="form-label">Market</label>
            <select
              className="input-field"
              value={selectedMarket != null ? markets.indexOf(selectedMarket) : -1}
              onChange={handleSelectMarket}
              disabled={marketsLoading || isActive}
            >
              <option value="-1" disabled>
                {marketsLoading ? "Loading markets..." : "Select market"}
              </option>
              {markets.map((m, i) => (
                <option key={m.marketId} value={i}>
                  {m.label}
                </option>
              ))}
            </select>
            {selectedMarket && (
              <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                  pool: {selectedMarket.pool.slice(0, 10)}…
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                  expires in {selectedMarket.secondsLeft >= 86400 ? `${Math.floor(selectedMarket.secondsLeft / 86400)}d` : selectedMarket.secondsLeft >= 3600 ? `${Math.floor(selectedMarket.secondsLeft / 3600)}h` : `${Math.floor(selectedMarket.secondsLeft / 60)}m`}
                </span>
              </div>
            )}
          </div>

          {/* Side toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSide("buy")}
              disabled={isActive}
              className={side === "buy" ? "btn-primary" : "btn-secondary"}
              style={{ width: "100%", opacity: isActive ? 0.5 : 1 }}
            >
              BUY YES
            </button>
            <button
              onClick={() => setSide("sell")}
              disabled={isActive}
              className={side === "sell" ? "btn-secondary" : "btn-ghost"}
              style={{
                width: "100%",
                opacity: isActive ? 0.5 : 1,
                borderColor: side === "sell" ? "var(--accent-secondary)" : undefined,
                color: side === "sell" ? "var(--accent-secondary)" : undefined,
              }}
            >
              SELL YES
            </button>
          </div>

          {/* Amount + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Quantity</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isActive}
                style={{ opacity: isActive ? 0.5 : 1 }}
              />
            </div>
            <div>
              <label className="form-label">Price (0.01–0.99)</label>
              <input
                type="number"
                min="0.01"
                max="0.99"
                step="0.01"
                className="input-field"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isActive}
                style={{ opacity: isActive ? 0.5 : 1 }}
              />
            </div>
          </div>

          {/* Execute / Reset buttons */}
          {execState === "idle" || execState === "preflight-failed" || execState === "failed" || execState === "rejected" || execState === "simulation-failed" ? (
            <button
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={handleTrade}
              disabled={!isConnected || loading || !selectedMarket}
            >
              {loading ? "EXECUTING…" : "EXECUTE TRADE"}
            </button>
          ) : (
            <div
              className="card"
              style={{
                width: "100%",
                height: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-data)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                color: STATE_COLORS[execState],
              }}
            >
              {STATE_LABELS[execState]}
            </div>
          )}

          {!isConnected && (
            <p style={{ fontSize: 13, textAlign: "center", color: "var(--accent-warn)" }}>
              Connect your wallet to trade
            </p>
          )}
        </div>
      </section>

      {/* Execution Progress */}
      {result?.progress && result.progress.length > 0 && (
        <section className="card animate-fade-up" style={{ padding: 28, marginTop: 20 }}>
          <div className="form-label" style={{ marginBottom: 16 }}>Execution Timeline</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.progress.map((p, i) => (
              <div key={i} className="flex items-start gap-3" style={{ fontSize: 12, fontFamily: "var(--font-data)" }}>
                <span style={{ color: "var(--text-tertiary)", minWidth: 70 }}>
                  {new Date(p.ts).toLocaleTimeString()}
                </span>
                <span style={{
                  color: p.state.includes("failed") || p.state === "rejected"
                    ? "var(--accent-warn)"
                    : p.state === "confirmed" || p.state === "order-verified" || p.state === "filled"
                    ? "var(--accent)"
                    : "var(--text-primary)",
                }}>
                  {p.message}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Result */}
      {result && (
        <section className="card animate-fade-up" style={{ padding: 28, marginTop: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ marginBottom: 0 }}>Execution Result</div>
            <span
              className="status-pill"
              style={{
                color: result.ok ? "var(--accent)" : "var(--accent-warn)",
                background: result.ok ? "var(--accent-muted)" : "var(--accent-warn-muted)",
              }}
            >
              {result.ok ? STATE_LABELS[result.state] : "FAILED"}
            </span>
          </div>
          {result.ok ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selectedMarket && (
                <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Market</span>
                  <span style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {selectedMarket.asset} · {formatHorizon(selectedMarket.horizonMinutes)} · {side.toUpperCase()} YES
                  </span>
                </div>
              )}
              {result.filled !== undefined && (
                <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Quantity</span>
                  <span style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {result.filled}
                  </span>
                </div>
              )}
              {result.averagePrice !== undefined && (
                <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Avg Price</span>
                  <span style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {pctStr(result.averagePrice, 0)}%
                  </span>
                </div>
              )}
              {result.orderStatus && (
                <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Fill Status</span>
                  <span style={{
                    fontSize: 13,
                    fontFamily: "var(--font-data)",
                    fontWeight: 600,
                    color: result.orderStatus === "filled"
                      ? "var(--accent)"
                      : result.orderStatus === "partial"
                      ? "var(--accent-ember)"
                      : "var(--text-secondary)",
                  }}>
                    {result.orderStatus.toUpperCase()}
                  </span>
                </div>
              )}
              {result.hash && (
                <>
                  <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                    <span className="form-label" style={{ marginBottom: 0 }}>Transaction</span>
                    <span style={{
                      fontSize: 12,
                      fontFamily: "var(--font-data)",
                      color: "var(--text-primary)",
                      wordBreak: "break-all",
                      textAlign: "right",
                      maxWidth: "70%",
                    }}>
                      {result.hash}
                    </span>
                  </div>
                  <a
                    href={`https://shannon-explorer.somnia.network/tx/${result.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 13, fontFamily: "var(--font-data)", fontWeight: 500, color: "var(--accent)", textDecoration: "none" }}
                  >
                    View on explorer
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                    </svg>
                  </a>
                </>
              )}
              {result.orderId && (
                <div className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Order ID</span>
                  <span style={{
                    fontSize: 12,
                    fontFamily: "var(--font-data)",
                    color: "var(--text-primary)",
                    wordBreak: "break-all",
                    textAlign: "right",
                    maxWidth: "70%",
                  }}>
                    {result.orderId}
                  </span>
                </div>
              )}
              <button
                onClick={resetTrade}
                className="btn-secondary"
                style={{ width: "100%", marginTop: 8 }}
              >
                NEW TRADE
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--accent-warn)" }}>{result.error}</p>
              {result.errorCode && (
                <p style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                  CODE: {result.errorCode}
                </p>
              )}
              <button
                onClick={resetTrade}
                className="btn-secondary"
                style={{ width: "100%" }}
              >
                TRY AGAIN
              </button>
            </div>
          )}
          {result.disclaimer && (
            <p style={{ fontSize: 11, marginTop: 12, color: "var(--accent-ember)" }}>{result.disclaimer}</p>
          )}
        </section>
      )}
    </div>
  );
}
