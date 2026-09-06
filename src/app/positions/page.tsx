"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatHorizon, formatProb, pctStr } from "@/lib/dreamdex/formatting";

/* ═══════════════════════════════════════════════════════ */
/* Local Storage Thesis Reader                            */
/* ═══════════════════════════════════════════════════════ */

function walletKey(wallet: string, suffix: string): string {
  const short = wallet.toLowerCase().slice(0, 10);
  return `dreamdex-${short}-${suffix}`;
}

function readThesisJson<T>(wallet: string, suffix: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(walletKey(wallet, suffix));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/* ═══════════════════════════════════════════════════════ */
/* Types                                                  */
/* ═══════════════════════════════════════════════════════ */

interface ThesisEntry {
  positionId: string;
  marketId: string;
  asset: string;
  horizon: number;
  direction: "up" | "down";
  entryProbability: number;
  entryTimestamp: string;
  regime: string;
  signalStrength: number;
  signalConfidence: number;
  reversalRisk: number;
  divergence: number;
  persistence: number;
  velocity: number;
  dataQuality: number;
  analysisSnapshot: string;
  trajectoryState: string;
  trajectoryScore: number;
}

interface ComparisonEntry {
  positionId: string;
  probabilityDelta: number;
  confidenceDelta: number;
  reversalRiskDelta: number;
  regimeChange: string;
  status: string;
  statusSummary: string;
  timestamp: string;
}

interface Position {
  id: string;
  wallet: string;
  marketId: string;
  marketAddress: string;
  asset: string;
  horizon: number;
  intervalLabel: string;
  direction: "up" | "down";
  outcomeIndex: number;
  quantity: number;
  entryPrice: number;
  entryTimestamp: string;
  orderId: string;
  transactionHash: string;
  status: string;
  marketStatus: string;
  quoteDecimals: number;
  expiry: string;
  lastPrice: number | null;
  winningOutcome: number | null;
  voided: boolean;
  entryThesis?: {
    regime: string;
    signalStrength: number;
    signalConfidence: number;
    reversalRisk: number;
    trajectoryState: string;
    trajectoryScore: number;
  } | null;
  comparison?: {
    probabilityDelta: number;
    confidenceDelta: number;
    reversalRiskDelta: number;
    regimeChange: string;
    status: string;
    statusSummary: string;
  } | null;
}

interface OpenOrder {
  id: string;
  orderId: string;
  side: string;
  price: number;
  quantityRemaining: number;
  filledQuantity: number;
  fullQuantity: number;
  market: { asset: string; interval: string | null; quoteDecimals: number };
}

interface RecentTrade {
  id: string;
  fillPrice: number;
  quantity: number;
  timestamp: string;
  txHash: string;
  side: string | null;
  asMaker: boolean;
  market: { asset: string; interval: string | null; quoteDecimals: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "var(--text-secondary)",
  open: "var(--accent)",
  partial: "var(--accent-ember)",
  locked: "var(--accent-secondary)",
  resolved: "var(--text-secondary)",
  voided: "var(--accent-warn)",
  redeemable: "var(--accent)",
  redeemed: "var(--text-secondary)",
};

const THESIS_STATUS_COLORS: Record<string, string> = {
  strengthening: "var(--accent)",
  weakening: "var(--accent-ember)",
  invalidated: "var(--accent-warn)",
  resolved: "var(--text-secondary)",
  unchanged: "var(--text-primary)",
  stale: "var(--text-secondary)",
};

/* ═══════════════════════════════════════════════════════ */
/* Page                                                   */
/* ═══════════════════════════════════════════════════════ */

export default function PositionsPage() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    if (!address) return;

    async function load() {
      try {
        const res = await fetch(`/api/dreamdex/positions?wallet=${address}`, { cache: "no-store" });
        const data = await res.json();
        if (!fetchedRef.current) {
          if (data.ok) {
            const theses = readThesisJson<ThesisEntry>(address!, "theses");
            const comparisons = readThesisJson<ComparisonEntry>(address!, "comparisons");
            const enriched = (data.positions ?? []).map((pos: Position) => ({
              ...pos,
              entryThesis: theses[pos.id] ?? null,
              comparison: comparisons[pos.id] ?? null,
            }));
            setPositions(enriched);
            setOpenOrders(data.openOrders ?? []);
            setRecentTrades(data.recentTrades ?? []);
            setError(null);
          } else {
            setError(data.error || "Failed to load positions");
          }
        }
      } catch (e: unknown) {
        if (!fetchedRef.current) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(() => void load(), 15000);
    return () => { fetchedRef.current = true; clearInterval(interval); };
  }, [address]);

  const activePositions = positions.filter((p) => p.status === "open" || p.status === "partial");
  const lockedPositions = positions.filter((p) => p.status === "locked");
  const thesisPositions = positions.filter((p) => p.entryThesis);

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 1100, paddingTop: 32, paddingBottom: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-10 animate-fade-up">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(28px, 5vw, 40px)",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          Positions
        </h1>
        <div className="flex items-center gap-3">
          <span
            className="status-pill"
            style={{
              color: "var(--text-secondary)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            {positions.length} TOTAL
          </span>
          <button onClick={() => window.location.reload()} className="btn-ghost btn-sm">
            REFRESH
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "OPEN", value: activePositions.length, color: activePositions.length > 0 ? "var(--accent)" : "var(--text-secondary)" },
          { label: "LOCKED", value: lockedPositions.length, color: lockedPositions.length > 0 ? "var(--accent-secondary)" : "var(--text-secondary)" },
          { label: "THESES", value: thesisPositions.length, color: thesisPositions.length > 0 ? "var(--accent)" : "var(--text-secondary)" },
        ].map((item, i) => (
          <div key={item.label} className="card text-center animate-fade-up" style={{ padding: 20, animationDelay: `${0.05 + i * 0.05}s` }}>
            <div className="form-label" style={{ marginBottom: 8 }}>{item.label}</div>
            <div style={{
              fontFamily: "var(--font-data)",
              fontSize: 28,
              fontWeight: 700,
              color: item.color,
              lineHeight: 1,
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Wallet not connected */}
      {!isConnected && (
        <div className="card text-center animate-fade-up" style={{ padding: 48 }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
            Connect your wallet to view positions
          </p>
          <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
            Positions are read from on-chain outcome token balances.
          </p>
        </div>
      )}

      {/* Loading */}
      {isConnected && loading && positions.length === 0 && (
        <div className="card text-center" style={{ padding: 48 }}>
          <div className="skeleton" style={{ height: 24, width: 200, margin: "0 auto" }} />
        </div>
      )}

      {/* Error */}
      {isConnected && error && (
        <div className="card text-center animate-fade-up" style={{ padding: 48 }}>
          <p style={{ fontSize: 14, color: "var(--accent-warn)", marginBottom: 16 }}>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary btn-sm">
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {isConnected && !loading && !error && positions.length === 0 && (
        <div className="card text-center animate-fade-up" style={{ padding: 48 }}>
          <div className="form-label" style={{ marginBottom: 12 }}>NO ACTIVE POSITIONS</div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
            Verified Event Contract fills will appear here.
          </p>
          <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
            Execute a trade on{" "}
            <Link href="/markets" style={{ color: "var(--accent)", textDecoration: "underline" }}>Markets</Link>
            {" "}or{" "}
            <Link href="/analyze/BTC" style={{ color: "var(--accent)", textDecoration: "underline" }}>Analyze</Link>.
          </p>
        </div>
      )}

      {/* Position cards */}
      {positions.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          <div className="form-label">POSITIONS</div>
          {positions.map((pos, idx) => (
            <div
              key={pos.id}
              className="card animate-fade-up"
              style={{ padding: 24, animationDelay: `${0.05 + idx * 0.05}s` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>
                    {pos.asset}
                  </span>
                  <span style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: pos.direction === "up" ? "var(--accent)" : "var(--accent-secondary)",
                    letterSpacing: "0.04em",
                  }}>
                    {pos.direction.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {formatHorizon(pos.horizon)}
                  </span>
                </div>
                <span
                  className="status-pill"
                  style={{
                    color: STATUS_COLORS[pos.status] ?? "var(--text-secondary)",
                    background: `${STATUS_COLORS[pos.status] ?? "var(--text-secondary)"}15`,
                  }}
                >
                  {pos.status.toUpperCase()}
                </span>
              </div>

              {/* Details grid */}
              <div className={`grid gap-3 sm:gap-4 grid-cols-2 ${(pos.status === "resolved" || pos.status === "redeemable" || pos.status === "redeemed" || pos.status === "locked") ? "sm:grid-cols-3" : "sm:grid-cols-4"}`} style={{ marginBottom: 12 }}>
                <div>
                  <div className="form-label" style={{ marginBottom: 4 }}>ENTRY</div>
                  <div style={{ fontSize: 14, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {formatProb(pos.entryPrice)}%
                  </div>
                </div>
                <div>
                  <div className="form-label" style={{ marginBottom: 4 }}>QUANTITY</div>
                  <div style={{ fontSize: 14, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {pos.quantity}
                  </div>
                </div>
                {(pos.status !== "resolved" && pos.status !== "redeemable" && pos.status !== "redeemed" && pos.status !== "locked") && (
                  <div>
                    <div className="form-label" style={{ marginBottom: 4 }}>CURRENT</div>
                    <div style={{ fontSize: 14, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                      {pos.lastPrice !== null ? `${formatProb(pos.lastPrice)}%` : "—"}
                    </div>
                  </div>
                )}
                {(pos.status === "resolved" || pos.status === "redeemable" || pos.status === "redeemed") && pos.winningOutcome !== null && (
                  <div>
                    <div className="form-label" style={{ marginBottom: 4 }}>OUTCOME</div>
                    <div style={{
                      fontSize: 14,
                      fontFamily: "var(--font-data)",
                      fontWeight: 600,
                      color: (() => {
                        const won = (pos.direction === "up" && pos.winningOutcome === 0) || (pos.direction === "down" && pos.winningOutcome === 1);
                        return won ? "var(--accent)" : "var(--accent-warn)";
                      })(),
                    }}>
                      {(() => {
                        const won = (pos.direction === "up" && pos.winningOutcome === 0) || (pos.direction === "down" && pos.winningOutcome === 1);
                        return won ? "WIN" : "LOSS";
                      })()}
                    </div>
                  </div>
                )}
                <div>
                  <div className="form-label" style={{ marginBottom: 4 }}>MARKET</div>
                  <span className="status-pill" style={{
                    color: STATUS_COLORS[pos.status] ?? "var(--text-secondary)",
                    fontSize: 10,
                  }}>
                    {pos.marketStatus.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Lifecycle + Settlement Info */}
              {(pos.status === "resolved" || pos.status === "voided" || pos.status === "redeemable") && (
                <div style={{
                  padding: 12,
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  marginBottom: 12,
                }}>
                  <div className="flex items-center gap-3" style={{ marginBottom: 6 }}>
                    <span className="form-label" style={{ marginBottom: 0 }}>SETTLEMENT</span>
                    {pos.voided && (
                      <span className="status-pill" style={{ color: "var(--accent-warn)", fontSize: 10 }}>VOIDED</span>
                    )}
                    {pos.winningOutcome !== null && (
                      <span className="status-pill" style={{ color: "var(--accent)", fontSize: 10 }}>
                        WINNER: {pos.winningOutcome === 0 ? "YES" : "NO"}
                      </span>
                    )}
                    {pos.status === "redeemable" && (
                      <span className="status-pill" style={{ color: "var(--accent)", fontSize: 10 }}>REDEEMABLE</span>
                    )}
                  </div>
                  <Link
                    href="/settlement"
                    style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--accent)", textDecoration: "underline" }}
                  >
                    VIEW SETTLEMENT →
                  </Link>
                </div>
              )}

              {/* Thesis summary */}
              {pos.comparison && (
                <div style={{
                  padding: 12,
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  marginBottom: 8,
                }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                    <span className="form-label" style={{ marginBottom: 0 }}>THESIS STATUS</span>
                    <span style={{
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: THESIS_STATUS_COLORS[pos.comparison.status] ?? "var(--text-secondary)",
                    }}>
                      {pos.comparison.status.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {pos.comparison.statusSummary}
                  </p>
                </div>
              )}

              {/* Thesis details */}
              {pos.entryThesis && !pos.comparison && (
                <div style={{
                  padding: 12,
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span className="form-label" style={{ marginBottom: 0 }}>ENTRY THESIS</span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                      {pos.entryThesis.trajectoryState}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Confidence", value: `${pctStr(pos.entryThesis.signalConfidence, 0)}%` },
                      { label: "Rev Risk", value: `${pctStr(pos.entryThesis.reversalRisk, 0)}%` },
                      { label: "Score", value: `${pctStr(pos.entryThesis.trajectoryScore, 0)}%` },
                    ].map((m) => (
                      <div key={m.label}>
                        <div style={{ fontSize: 10, fontFamily: "var(--font-data)", color: "var(--text-tertiary)", marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 13, fontFamily: "var(--font-data)", fontWeight: 600, color: "var(--text-primary)" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction link */}
              {pos.transactionHash && (
                <a
                  href={`https://shannon-explorer.somnia.network/tx/${pos.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5"
                  style={{ marginTop: 12, fontSize: 11, fontFamily: "var(--font-data)", color: "var(--accent)", textDecoration: "none" }}
                >
                  TX: {pos.transactionHash.slice(0, 16)}…
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                  </svg>
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Open Orders */}
      {openOrders.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          <div className="form-label">OPEN ORDERS</div>
          {openOrders.map((order) => (
            <div key={order.id} className="card" style={{ padding: 16 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 14, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {order.market.asset}
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "var(--font-data)",
                    fontWeight: 600,
                    color: order.side === "buy" ? "var(--accent)" : "var(--accent-secondary)",
                  }}>
                    {order.side.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {order.market.interval ? formatHorizon(parseInt(order.market.interval)) : "—"}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-secondary)" }}>
                  {formatProb(order.price)}% · {order.quantityRemaining}/{order.fullQuantity} remaining
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Recent Trades */}
      {recentTrades.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          <div className="form-label">RECENT TRADES</div>
          {recentTrades.slice(0, 10).map((trade) => (
            <div key={trade.id} className="card" style={{ padding: 14 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 13, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {trade.market.asset}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {trade.side?.toUpperCase() ?? "—"}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {trade.market.interval ? formatHorizon(parseInt(trade.market.interval)) : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {formatProb(trade.fillPrice)}% × {trade.quantity}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {new Date(Number(trade.timestamp) * 1000).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* About */}
      <section className="card" style={{ padding: 24 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>ABOUT</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          Positions are read on-chain from DreamDEX Event Contracts. Thesis data is stored locally in your browser.
        </p>
        <p style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)", marginTop: 8 }}>
          LOCAL THESIS MEMORY — stored in this browser only. Not synced across devices.
        </p>
      </section>
    </div>
  );
}
