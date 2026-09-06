"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════ */
/* Types                                                  */
/* ═══════════════════════════════════════════════════════ */

interface SettlementData {
  marketId: string;
  asset: string;
  horizon: number;
  status: string;
  winningOutcome: number | null;
  voided: boolean;
  finalized: boolean;
  resolvedAt: string | null;
  oracleQuestionId: string | null;
  oracleQuestion: string | null;
}

interface OracleAnswer {
  oracleQuestionId: string | null;
  numericValue: string | null;
  outcomeLabel: string | null;
  voidReason: number | null;
  resolvedAt: string | null;
  txHash: string | null;
}

interface ResolutionEvent {
  id: string;
  kind: string;
  winningOutcome: number | null;
  voided: boolean;
  blockNumber: string;
  timestamp: string;
  txHash: string;
}

interface SettlementVerification {
  marketId: string;
  settlement: SettlementData | null;
  closingAnswer: OracleAnswer | null;
  openingAnswer: OracleAnswer | null;
  referenceLink: string | null;
  resolutionEvents: ResolutionEvent[];
  verificationStatus: string;
  verificationSummary: string;
}

interface ClaimablePosition {
  marketId: string;
  pool: string;
  outcomeIdx: 0 | 1;
  amount: string;
  estPayout: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  Listed: "var(--text-secondary)",
  Trading: "var(--accent)",
  Locked: "var(--accent-secondary)",
  Settling: "var(--accent-ember)",
  Resolved: "var(--accent-warn)",
  Finalized: "var(--accent-success)",
  Voided: "var(--text-secondary)",
};

const VERIFICATION_COLORS: Record<string, string> = {
  verified: "var(--accent)",
  not_verified: "var(--accent-warn)",
  unavailable: "var(--text-secondary)",
};

const LIFECYCLE_STEPS = ["Listed", "Trading", "Locked", "Settling", "Resolved", "Finalized"];

/* ═══════════════════════════════════════════════════════ */
/* ClaimablePanel (client-side wallet-scoped)             */
/* ═══════════════════════════════════════════════════════ */

function ClaimablePanel({ address }: { address: string }) {
  const [claimable, setClaimable] = useState<ClaimablePosition[]>([]);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; hash?: string; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/dreamdex/settlement?account=${address}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.ok) setClaimable(data.claimable ?? []);
      } catch { /* skip */ }
    }
    void load();
    return () => { cancelled = true; };
  }, [address]);

  const handleRedeem = async (pos: ClaimablePosition) => {
    setRedeemResult(null);
    try {
      const res = await fetch("/api/dreamdex/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: pos.marketId, amount: pos.amount, outcomeIdx: pos.outcomeIdx }),
      });
      const data = await res.json();
      setRedeemResult(data);
    } catch (e: unknown) {
      setRedeemResult({ ok: false, error: e instanceof Error ? e.message : "Redemption failed" });
    }
  };

  return (
    <section className="card animate-fade-up" style={{ padding: 28 }}>
      <div className="form-label" style={{ marginBottom: 16 }}>CLAIMABLE POSITIONS</div>
      {claimable.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          No claimable positions found. Positions become claimable after market resolution.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {claimable.map((pos, i) => (
            <div
              key={`${pos.marketId}-${pos.outcomeIdx}-${i}`}
              style={{
                padding: 16,
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 13, fontFamily: "var(--font-data)", fontWeight: 600, color: "var(--text-primary)" }}>
                    {pos.marketId.slice(0, 10)}…
                  </span>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "var(--font-data)",
                    color: pos.outcomeIdx === 0 ? "var(--accent)" : "var(--accent-secondary)",
                  }}>
                    {pos.outcomeIdx === 0 ? "YES" : "NO"}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {pos.status}
                  </span>
                </div>
                <button
                  onClick={() => void handleRedeem(pos)}
                  className="btn-primary btn-sm"
                >
                  REDEEM
                </button>
              </div>
              <div className="flex items-center gap-4">
                <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                  Amount: {pos.amount}
                </span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--accent)" }}>
                  Est. Payout: {pos.estPayout}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {redeemResult && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: "var(--radius-md)",
            fontSize: 12,
            background: redeemResult.ok ? "var(--accent-muted)" : "var(--accent-warn-muted)",
            border: `1px solid ${redeemResult.ok ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
            color: redeemResult.ok ? "var(--accent)" : "var(--accent-warn)",
          }}
        >
          {redeemResult.ok ? (
            <>Redeemed. TX: <span style={{ fontFamily: "var(--font-data)", wordBreak: "break-all" }}>{redeemResult.hash}</span></>
          ) : (
            <>Redemption failed: {redeemResult.error}</>
          )}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* Page                                                   */
/* ═══════════════════════════════════════════════════════ */

export default function SettlementPage() {
  const { address, isConnected } = useAccount();
  const [marketId, setMarketId] = useState("");
  const [verification, setVerification] = useState<SettlementVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupMarket = async () => {
    if (!marketId.trim()) return;
    setLoading(true);
    setError(null);
    setVerification(null);
    try {
      const res = await fetch(`/api/dreamdex/settlement?marketId=${encodeURIComponent(marketId.trim())}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setVerification(data.verification);
      } else {
        setError(data.error || "Market not found");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 1100, paddingTop: 32, paddingBottom: 80 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-10 animate-fade-up">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 40px)",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Settlement
          </h1>
          <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
            Oracle verification + redemption for resolved Event Contracts
          </p>
        </div>
      </div>

      {/* Market Lookup */}
      <section className="card animate-fade-up delay-1" style={{ padding: 28, marginBottom: 24 }}>
        <div className="form-label" style={{ marginBottom: 12 }}>MARKET LOOKUP</div>
        <div className="flex gap-3">
          <input
            className="input-field"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            placeholder="Market ID (0x...)"
            onKeyDown={(e) => { if (e.key === "Enter") void lookupMarket(); }}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => void lookupMarket()}
            disabled={loading || !marketId.trim()}
            className="btn-primary"
          >
            {loading ? "LOOKING UP…" : "LOOKUP"}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="card animate-fade-up" style={{ padding: 20, borderLeft: "3px solid var(--accent-warn)", marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "var(--accent-warn)" }}>{error}</p>
        </div>
      )}

      {/* Settlement Verification */}
      {verification && (
        <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Settlement Status */}
          <div className="card animate-fade-up" style={{ padding: 28 }}>
            <div className="form-label" style={{ marginBottom: 16 }}>SETTLEMENT</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <div className="form-label" style={{ marginBottom: 6 }}>Status</div>
                <span
                  className="status-pill"
                  style={{ color: STATUS_COLORS[verification.settlement?.status ?? ""] ?? "var(--text-secondary)" }}
                >
                  {(verification.settlement?.status ?? "UNKNOWN").toUpperCase()}
                </span>
              </div>
              {verification.settlement && (
                <>
                  <div>
                    <div className="form-label" style={{ marginBottom: 6 }}>Winning Outcome</div>
                    <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                      {verification.settlement.winningOutcome !== null
                        ? verification.settlement.winningOutcome === 0 ? "YES (Up)" : "NO (Down)"
                        : verification.settlement.voided ? "VOIDED" : "Pending"}
                    </div>
                  </div>
                  <div>
                    <div className="form-label" style={{ marginBottom: 6 }}>Finalized</div>
                    <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: verification.settlement.finalized ? "var(--accent)" : "var(--text-secondary)" }}>
                      {verification.settlement.finalized ? "YES" : "NO"}
                    </div>
                  </div>
                  {verification.settlement.resolvedAt && (
                    <div>
                      <div className="form-label" style={{ marginBottom: 6 }}>Resolved At</div>
                      <div style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                        {new Date(verification.settlement.resolvedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Lifecycle Timeline */}
          <div className="card animate-fade-up" style={{ padding: 28 }}>
            <div className="form-label" style={{ marginBottom: 16 }}>LIFECYCLE</div>
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
              {LIFECYCLE_STEPS.map((step, i) => {
                const isCurrent = verification.settlement?.status === step;
                const isPast = verification.settlement
                  ? LIFECYCLE_STEPS.indexOf(verification.settlement.status) > i
                  : false;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        fontWeight: isCurrent ? 600 : 400,
                        background: isCurrent
                          ? "var(--accent-muted)"
                          : isPast
                          ? "var(--surface-2)"
                          : "transparent",
                        border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`,
                        color: isCurrent ? "var(--accent)" : isPast ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                    >
                      {isPast || isCurrent ? "●" : "○"} {step}
                    </div>
                    {i < LIFECYCLE_STEPS.length - 1 && (
                      <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>→</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Oracle Verification Panel */}
          <div className="card animate-fade-up" style={{ padding: 28 }}>
            <div className="form-label" style={{ marginBottom: 16 }}>SETTLEMENT VERIFICATION</div>
            <div
              className="flex items-center gap-3"
              style={{
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: `${VERIFICATION_COLORS[verification.verificationStatus] ?? "var(--text-secondary)"}10`,
                border: `1px solid ${VERIFICATION_COLORS[verification.verificationStatus] ?? "var(--text-secondary)"}25`,
                marginBottom: 20,
              }}
            >
              <span style={{
                fontSize: 13,
                fontFamily: "var(--font-data)",
                fontWeight: 600,
                color: VERIFICATION_COLORS[verification.verificationStatus] ?? "var(--text-secondary)",
              }}>
                {verification.verificationStatus.toUpperCase()}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                — {verification.verificationSummary}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Oracle Question ID</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-data)", wordBreak: "break-all", color: verification.closingAnswer?.oracleQuestionId ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {verification.closingAnswer?.oracleQuestionId ?? "N/A"}
                </div>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Oracle Answer</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-data)", color: verification.closingAnswer?.numericValue ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {verification.closingAnswer?.numericValue ?? "N/A"}
                </div>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Outcome Label</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-data)", color: verification.closingAnswer?.outcomeLabel ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {verification.closingAnswer?.outcomeLabel ?? "N/A"}
                </div>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Oracle Resolved At</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-data)", color: verification.closingAnswer?.resolvedAt ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                  {verification.closingAnswer?.resolvedAt
                    ? new Date(Number(verification.closingAnswer.resolvedAt) * 1000).toLocaleString()
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Oracle Tx Hash</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-data)", wordBreak: "break-all", color: verification.closingAnswer?.txHash ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {verification.closingAnswer?.txHash ?? "N/A"}
                </div>
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 4 }}>Reference Link</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-data)", color: verification.referenceLink ? "var(--accent)" : "var(--text-tertiary)" }}>
                  {verification.referenceLink ?? "N/A"}
                </div>
              </div>
            </div>

            {/* Resolution Events */}
            {verification.resolutionEvents.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="form-label" style={{ marginBottom: 12 }}>RESOLUTION EVENTS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {verification.resolutionEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: 12,
                        background: "var(--surface-2)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: ev.voided ? "var(--accent-warn)" : "var(--accent)" }}>
                          {ev.kind.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                          Block {ev.blockNumber}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                          {new Date(Number(ev.timestamp) * 1000).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, fontFamily: "var(--font-data)", marginTop: 6, wordBreak: "break-all", color: "var(--text-tertiary)" }}>
                        TX: {ev.txHash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Claimable Positions */}
      {isConnected && address && <ClaimablePanel key={address} address={address} />}

      {/* Not connected */}
      {!isConnected && (
        <div className="card text-center animate-fade-up" style={{ padding: 48, marginTop: 24 }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>Connect wallet to view claimable positions.</p>
          <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
            You can still look up any market by ID without connecting.
          </p>
        </div>
      )}

      {/* Quick Links */}
      <section className="card" style={{ padding: 24, marginTop: 24 }}>
        <div className="form-label" style={{ marginBottom: 12 }}>NAVIGATE</div>
        <div className="flex items-center gap-6">
          <Link href="/markets" style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--accent)", textDecoration: "underline" }}>Markets</Link>
          <Link href="/positions" style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--accent)", textDecoration: "underline" }}>Positions</Link>
          <Link href="/thesis" style={{ fontSize: 13, fontFamily: "var(--font-data)", color: "var(--accent)", textDecoration: "underline" }}>Thesis Monitor</Link>
        </div>
      </section>
    </div>
  );
}
