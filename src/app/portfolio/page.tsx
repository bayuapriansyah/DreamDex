"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { formatHorizon, formatProb, pctStr } from "@/lib/dreamdex/formatting";
import { getFollows } from "@/lib/dreamdex/following";

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
  id: string;
  asset: string;
  direction: "up" | "down";
  horizon: number;
  entryProbability: number;
  thesis: string;
  state: string;
  stateLabel: string;
  signalConfidence: number;
  reversalRisk: number;
  trajectoryScore: number;
  trajectoryState: string;
  createdAt: string;
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
  entryThesis?: ThesisEntry | null;
  comparison?: ComparisonEntry | null;
}

/* ═══════════════════════════════════════════════════════ */
/* Helpers                                                */
/* ═══════════════════════════════════════════════════════ */

const STATUS_COLORS: Record<string, string> = {
  open: "var(--accent)",
  partial: "var(--accent-secondary)",
  locked: "var(--accent-secondary)",
  resolved: "var(--text-secondary)",
  redeemable: "var(--accent)",
  redeemed: "var(--text-secondary)",
  voided: "var(--accent-warn)",
  pending: "var(--text-secondary)",
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

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [theses, setTheses] = useState<ThesisEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    if (!address) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/dreamdex/positions?wallet=${address}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!fetchedRef.current) {
          if (data.ok) {
            setPositions(data.positions ?? []);
            setError(null);
          } else {
            setError(data.error || "Failed to load positions");
          }
        }
      } catch (e: unknown) {
        if (!fetchedRef.current)
          setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }

    function loadTheses() {
      if (!address) return;
      try {
        const raw = localStorage.getItem(walletKey(address, "thesis-monitor"));
        if (!raw) { setTheses([]); return; }
        const parsed = JSON.parse(raw);
        // Handle both formats: array (new) and object (old)
        const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
        setTheses(list as ThesisEntry[]);
      } catch {
        setTheses([]);
      }
    }

    void load();
    loadTheses();
    const interval = setInterval(() => void load(), 15000);
    const thesisInterval = setInterval(loadTheses, 15000);
    return () => {
      fetchedRef.current = true;
      clearInterval(interval);
      clearInterval(thesisInterval);
    };
  }, [address]);

  /* ── Derived ────────────────────────────────────── */

  const openPositions = positions.filter(
    (p) => p.status === "open" || p.status === "partial"
  );
  const pendingResolution = positions.filter((p) => p.status === "locked");
  const redeemable = positions.filter((p) => p.status === "redeemable");
  const activeTheses = theses;
  const followingCount = address ? getFollows(address).length : 0;

  return (
    <div
      className="mx-auto px-4"
      style={{ maxWidth: 1100, paddingTop: 32, paddingBottom: 80 }}
    >
      {/* ── Header ────────────────────────────────────── */}
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
          Portfolio
        </h1>
        <button
          onClick={() => window.location.reload()}
          className="btn-ghost btn-sm"
        >
          REFRESH
        </button>
      </div>

      {/* ── Summary ────────────────────────────────────── */}
      {isConnected && (
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10 animate-fade-up"
          style={{ animationDelay: "0.05s" }}
        >
          {[
            {
              label: "OPEN POSITIONS",
              value: openPositions.length,
              color:
                openPositions.length > 0
                  ? "var(--accent)"
                  : "var(--text-secondary)",
            },
            {
              label: "PENDING RESOLUTION",
              value: pendingResolution.length,
              color:
                pendingResolution.length > 0
                  ? "var(--accent-secondary)"
                  : "var(--text-secondary)",
            },
            {
              label: "REDEEMABLE",
              value: redeemable.length,
              color:
                redeemable.length > 0
                  ? "var(--accent)"
                  : "var(--text-secondary)",
            },
            {
              label: "ACTIVE THESES",
              value: activeTheses.length,
              color:
                activeTheses.length > 0
                  ? "var(--accent)"
                  : "var(--text-secondary)",
            },
            {
              label: "FOLLOWING SIGNALS",
              value: followingCount,
              color:
                followingCount > 0
                  ? "var(--accent-secondary)"
                  : "var(--text-secondary)",
              href: "/signals/following",
            },
          ].map((item, i) => {
            const content = (
              <div
                key={item.label}
                className={`card text-center animate-fade-up ${"href" in item && item.href ? "card-interactive" : ""}`}
                style={{ padding: 20, animationDelay: `${0.05 + i * 0.05}s`, cursor: "href" in item && item.href ? "pointer" : undefined }}
              >
                <div className="form-label" style={{ marginBottom: 8 }}>
                  {item.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: item.color,
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </div>
              </div>
            );
            if ("href" in item && item.href) {
              return (
                <Link key={item.label} href={item.href} style={{ textDecoration: "none" }}>
                  {content}
                </Link>
              );
            }
            return content;
          })}
        </div>
      )}

      {/* ── Wallet not connected ───────────────────────── */}
      {!isConnected && (
        <div className="card text-center animate-fade-up" style={{ padding: 48 }}>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 8,
            }}
          >
            Connect your wallet to view your portfolio
          </p>
          <p
            style={{
              fontSize: 12,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
            }}
          >
            Portfolio aggregates positions, theses, and settlement data from
            DreamDEX Event Contracts.
          </p>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────── */}
      {isConnected && loading && positions.length === 0 && (
        <div className="card text-center" style={{ padding: 48 }}>
          <div
            className="skeleton"
            style={{ height: 24, width: 200, margin: "0 auto" }}
          />
        </div>
      )}

      {/* ── Error ──────────────────────────────────────── */}
      {isConnected && error && (
        <div className="card text-center animate-fade-up" style={{ padding: 48 }}>
          <p
            style={{
              fontSize: 14,
              color: "var(--accent-warn)",
              marginBottom: 16,
            }}
          >
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary btn-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Open Positions ─────────────────────────────── */}
      {isConnected && !loading && (
        <section style={{ marginBottom: 40 }}>
          <div className="form-label" style={{ marginBottom: 16 }}>
            OPEN POSITIONS
          </div>
          {openPositions.length === 0 ? (
            <div
              className="card text-center animate-fade-up"
              style={{ padding: 40 }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: 8,
                }}
              >
                NO OPEN POSITIONS — Execute a trade from Analysis to build your
                portfolio.
              </p>
              <Link
                href="/markets"
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-data)",
                  color: "var(--accent)",
                  textDecoration: "underline",
                }}
              >
                Explore Markets
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {openPositions.map((pos, idx) => (
                <div
                  key={pos.id}
                  className="card animate-fade-up"
                  style={{
                    padding: 24,
                    animationDelay: `${0.05 + idx * 0.05}s`,
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 16 }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 18,
                          color: "var(--text-primary)",
                        }}
                      >
                        {pos.asset}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 11,
                          fontWeight: 600,
                          color:
                            pos.direction === "up"
                              ? "var(--accent)"
                              : "var(--accent-secondary)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {pos.direction.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {formatHorizon(pos.horizon)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {pos.comparison && (
                        <span
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 11,
                            fontWeight: 600,
                            color:
                              THESIS_STATUS_COLORS[pos.comparison.status] ??
                              "var(--text-secondary)",
                          }}
                        >
                          {pos.comparison.status.toUpperCase()}
                        </span>
                      )}
                      <span
                        className="status-pill"
                        style={{
                          color:
                            STATUS_COLORS[pos.status] ??
                            "var(--text-secondary)",
                          background: `${STATUS_COLORS[pos.status] ?? "var(--text-secondary)"}15`,
                        }}
                      >
                        {pos.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 12 }}>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>
                        ENTRY
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {formatProb(pos.entryPrice)}%
                      </div>
                    </div>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>
                        CURRENT
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {pos.lastPrice !== null
                          ? `${formatProb(pos.lastPrice)}%`
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>
                        QUANTITY
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {pos.quantity}
                      </div>
                    </div>
                    <div>
                      <div className="form-label" style={{ marginBottom: 4 }}>
                        MARKET
                      </div>
                      <span
                        className="status-pill"
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: 10,
                        }}
                      >
                        {pos.marketStatus?.toUpperCase() ?? "UNKNOWN"}
                      </span>
                    </div>
                  </div>

                  {/* Thesis summary */}
                  {pos.comparison && (
                    <div
                      style={{
                        padding: 12,
                        background: "var(--surface-2)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-secondary)",
                          lineHeight: 1.5,
                        }}
                      >
                        {pos.comparison.statusSummary}
                      </p>
                    </div>
                  )}

                  {/* Transaction link */}
                  {pos.transactionHash && (
                    <a
                      href={`https://shannon-explorer.somnia.network/tx/${pos.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5"
                      style={{
                        marginTop: 12,
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                    >
                      TX: {pos.transactionHash.slice(0, 16)}…
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 17L17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Active Theses ─────────────────────────────── */}
      {isConnected && !loading && (
        <section style={{ marginBottom: 40 }}>
          <div className="form-label" style={{ marginBottom: 16 }}>
            ACTIVE THESES
          </div>
          {activeTheses.length === 0 ? (
            <div
              className="card text-center animate-fade-up"
              style={{ padding: 40 }}
            >
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                }}
              >
                NO ACTIVE THESES — Execute a trade from Analysis to create an
                Entry Thesis.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {activeTheses.map((thesis, idx) => {
                const thesisComparison = positions.find(
                  (p) => p.id === thesis.id
                )?.comparison;
                const thesisStatus =
                  thesisComparison?.status ?? "unchanged";
                const statusColor =
                  THESIS_STATUS_COLORS[thesisStatus] ??
                  "var(--text-secondary)";

                return (
                  <div
                    key={thesis.id}
                    className="card animate-fade-up"
                    style={{
                      padding: 24,
                      animationDelay: `${0.05 + idx * 0.05}s`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: 18,
                            color: "var(--text-primary)",
                          }}
                        >
                          {thesis.asset}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 11,
                            fontWeight: 600,
                            color:
                              thesis.direction === "up"
                                ? "var(--accent)"
                                : "var(--accent-secondary)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {(thesis.direction ?? "up").toUpperCase()}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-data)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {formatHorizon(thesis.horizon)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 11,
                            fontWeight: 600,
                            color: statusColor,
                          }}
                        >
                          {thesisStatus.toUpperCase()}
                        </span>
                        <span
                          className="status-pill"
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: 10,
                          }}
                        >
                          {thesis.trajectoryState}
                        </span>
                      </div>
                    </div>

                    <div
                      className="grid grid-cols-4 gap-3"
                      style={{ marginTop: 12 }}
                    >
                      {[
                        {
                          label: "ENTRY",
                          value: formatProb(thesis.entryProbability),
                        },
                        {
                          label: "CONFIDENCE",
                          value: `${pctStr(thesis.signalConfidence, 0)}%`,
                        },
                        {
                          label: "REV RISK",
                          value: `${pctStr(thesis.reversalRisk, 0)}%`,
                        },
                        {
                          label: "SCORE",
                          value: `${pctStr(thesis.trajectoryScore, 0)}%`,
                        },
                      ].map((m) => (
                        <div key={m.label}>
                          <div
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-data)",
                              color: "var(--text-tertiary)",
                              marginBottom: 2,
                            }}
                          >
                            {m.label}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontFamily: "var(--font-data)",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Redeemable ────────────────────────────────── */}
      {isConnected && !loading && redeemable.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div className="form-label" style={{ marginBottom: 16 }}>
            REDEEMABLE
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {redeemable.map((pos, idx) => {
              const won =
                (pos.direction === "up" && pos.winningOutcome === 0) ||
                (pos.direction === "down" && pos.winningOutcome === 1);
              return (
                <div
                  key={pos.id}
                  className="card animate-fade-up"
                  style={{
                    padding: 24,
                    animationDelay: `${0.05 + idx * 0.05}s`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 18,
                          color: "var(--text-primary)",
                        }}
                      >
                        {pos.asset}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-data)",
                          fontSize: 11,
                          fontWeight: 600,
                          color:
                            pos.direction === "up"
                              ? "var(--accent)"
                              : "var(--accent-secondary)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {pos.direction.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {formatHorizon(pos.horizon)}
                      </span>
                      {pos.winningOutcome !== null && (
                        <span
                          style={{
                            fontFamily: "var(--font-data)",
                            fontSize: 11,
                            fontWeight: 600,
                            color: won
                              ? "var(--accent)"
                              : "var(--accent-warn)",
                          }}
                        >
                          {won ? "WIN" : "LOSS"}
                        </span>
                      )}
                    </div>
                    <Link
                      href="/settlement"
                      className="btn-primary btn-sm"
                      style={{ textDecoration: "none" }}
                    >
                      CLAIM
                    </Link>
                  </div>

                  <div
                    className="grid grid-cols-3 gap-3"
                    style={{ marginTop: 12 }}
                  >
                    <div>
                      <div
                        className="form-label"
                        style={{ marginBottom: 4 }}
                      >
                        ENTRY
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {formatProb(pos.entryPrice)}%
                      </div>
                    </div>
                    <div>
                      <div
                        className="form-label"
                        style={{ marginBottom: 4 }}
                      >
                        QUANTITY
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: "var(--font-data)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {pos.quantity}
                      </div>
                    </div>
                    <div>
                      <div
                        className="form-label"
                        style={{ marginBottom: 4 }}
                      >
                        OUTCOME
                      </div>
                      <span
                        className="status-pill"
                        style={{
                          color: "var(--accent)",
                          fontSize: 10,
                        }}
                      >
                        {pos.winningOutcome === 0 ? "YES" : "NO"} WON
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── About ──────────────────────────────────────── */}
      {isConnected && (
        <section
          className="card animate-fade-up"
          style={{ padding: 24, animationDelay: "0.15s" }}
        >
          <div className="form-label" style={{ marginBottom: 8 }}>
            ABOUT
          </div>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            Portfolio provides a unified view of your DreamDEX Event Contract
            activity. Open positions are read on-chain. Active theses are stored
            locally in your browser and track your original trade rationale.
            Redeemable positions are resolved markets awaiting settlement
            claims.
          </p>
          <p
            style={{
              fontSize: 11,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
              marginTop: 8,
            }}
          >
            LOCAL DATA — thesis memory is stored in this browser only. Not
            synced across devices.
          </p>
        </section>
      )}
    </div>
  );
}
