"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { stateColor, statusBadge, pctStr, ppStr } from "@/lib/dreamdex/formatting";

interface Thesis {
  id: string;
  asset: string;
  direction: "up" | "down";
  horizon: number;
  entryProbability: number;
  thesis: string;
  state: string;
  stateLabel: string;
  createdAt: string;
}

interface ThesisStatus {
  thesis: Thesis;
  currentState: string;
  stateLabel: string;
  currentProbability: number;
  confidence: number;
  reversalRisk: number;
  status: "active" | "weakening" | "invalidated";
}

function walletKey(wallet: string, suffix: string): string {
  const short = wallet.toLowerCase().slice(0, 10);
  return `dreamdex-${short}-${suffix}`;
}

function readThesisList(wallet: string): Thesis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(walletKey(wallet, "thesis-monitor"));
    return raw ? JSON.parse(raw) : [];
  } catch {
    try { localStorage.removeItem(walletKey(wallet, "thesis-monitor")); } catch { /* ignore */ }
    return [];
  }
}

function writeThesisList(wallet: string, theses: Thesis[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(walletKey(wallet, "thesis-monitor"), JSON.stringify(theses));
  } catch { /* storage full */ }
}

function deriveThesisStatus(s: ThesisStatus): "STRENGTHENING" | "WEAKENING" | "UNCHANGED" | "INVALIDATED" {
  if (s.status === "invalidated") return "INVALIDATED";
  if (s.status === "weakening") return "WEAKENING";
  const delta = s.currentProbability - s.thesis.entryProbability;
  const isUp = s.thesis.direction === "up";
  const effectiveDelta = isUp ? delta : -delta;
  if (effectiveDelta > 0.02) return "STRENGTHENING";
  if (effectiveDelta < -0.02) return "WEAKENING";
  return "UNCHANGED";
}

function thesisStatusLabel(label: string): { color: string; bg: string } {
  if (label === "STRENGTHENING") return { color: "var(--accent)", bg: "rgba(245,158,11,0.12)" };
  if (label === "WEAKENING") return { color: "var(--accent-warn)", bg: "rgba(239,68,68,0.12)" };
  if (label === "INVALIDATED") return { color: "var(--accent-warn)", bg: "rgba(239,68,68,0.16)" };
  return { color: "var(--text-secondary)", bg: "rgba(255,255,255,0.06)" };
}

function SnapshotBlock({ label, metrics }: { label: string; metrics: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div
        className="form-label"
        style={{
          marginBottom: 8,
          letterSpacing: "0.08em",
          fontSize: 10,
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            className="card"
            style={{
              padding: "8px 10px",
              textAlign: "center",
            }}
          >
            <div
              className="form-label"
              style={{ marginBottom: 2, fontSize: 9, letterSpacing: "0.06em" }}
            >
              {m.label}
            </div>
            <div
              style={{
                fontSize: 14,
                fontFamily: "var(--font-data)",
                fontWeight: 700,
                color: m.color || "var(--text-primary)",
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThesisTracker({ address }: { address: string }) {
  const [theses, setTheses] = useState<Thesis[]>(() => readThesisList(address));
  const [statuses, setStatuses] = useState<ThesisStatus[]>([]);

  useEffect(() => {
    if (theses.length === 0) return;
    let cancelled = false;
    async function checkTheses() {
      const results: ThesisStatus[] = [];
      for (const thesis of theses) {
        try {
          const res = await fetch(`/api/dreamdex/temporal?asset=${thesis.asset}`);
          const data = await res.json();
          if (cancelled) return;
          if (data.ok && data.trajectory) {
            const t = data.trajectory;
            const relevantHorizon = t.horizons.find((h: { horizonMinutes: number }) => h.horizonMinutes === thesis.horizon);
            const currentProb = relevantHorizon ? relevantHorizon.midProbability : thesis.entryProbability;
            let status: "active" | "weakening" | "invalidated" = "active";
            if (thesis.direction === "up") {
              if (currentProb < thesis.entryProbability * 0.7) status = "invalidated";
              else if (currentProb < thesis.entryProbability * 0.9) status = "weakening";
            } else {
              const downProb = 1 - currentProb;
              const entryDown = 1 - thesis.entryProbability;
              if (downProb < entryDown * 0.7) status = "invalidated";
              else if (downProb < entryDown * 0.9) status = "weakening";
            }
            results.push({ thesis, currentState: t.state, stateLabel: t.stateLabel, currentProbability: currentProb, confidence: t.confidence, reversalRisk: t.reversalRisk, status });
          }
        } catch { /* skip */ }
      }
      if (!cancelled) setStatuses(results);
    }
    void checkTheses();
    const interval = setInterval(() => void checkTheses(), 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [theses]);

  const removeThesis = (id: string) => {
    const next = theses.filter((t) => t.id !== id);
    setTheses(next);
    writeThesisList(address, next);
  };

  return (
    <>
      {statuses.length === 0 ? (
        <div className="card text-center animate-fade-up" style={{ padding: 64 }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
            NO ACTIVE THESES — Execute a trade from Analysis to create an Entry Thesis.
          </p>
          <Link
            href="/markets"
            className="status-pill"
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "8px 20px",
              fontSize: 12,
              fontFamily: "var(--font-data)",
              fontWeight: 600,
              color: "var(--accent)",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.25)",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
            }}
          >
            Explore Markets
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {statuses.map((s, idx) => {
            const ss = statusBadge(s.status);
            const delta = s.currentProbability - s.thesis.entryProbability;
            const thesisLabel = deriveThesisStatus(s);
            const labelStyle = thesisStatusLabel(thesisLabel);
            const deltaPp = s.thesis.direction === "up" ? delta : -delta;

            return (
              <div
                key={s.thesis.id}
                className="card card-interactive animate-fade-up"
                style={{
                  padding: 24,
                  borderLeft: `3px solid ${stateColor(s.currentState)}`,
                  animationDelay: `${0.05 + idx * 0.05}s`,
                }}
              >
                {/* Header row */}
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: 18,
                        color: "var(--text-primary)",
                      }}
                    >
                      {s.thesis.asset}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: s.thesis.direction === "up" ? "var(--accent)" : "var(--accent-secondary)",
                      }}
                    >
                      {s.thesis.direction.toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {s.thesis.horizon}m
                    </span>
                    <span
                      className="status-pill"
                      style={{ color: ss.color, background: ss.bg }}
                    >
                      {s.status.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => removeThesis(s.thesis.id)}
                    className="btn-ghost btn-sm"
                    style={{ padding: "4px 8px" }}
                  >
                    ×
                  </button>
                </div>

                {/* Thesis text */}
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  {s.thesis.thesis}
                </p>

                {/* Entry vs Current snapshots */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <SnapshotBlock
                    label="ENTRY THESIS"
                    metrics={[
                      { label: "Probability", value: `${pctStr(s.thesis.entryProbability, 1)}%` },
                      { label: "Regime", value: s.thesis.stateLabel.toUpperCase(), color: stateColor(s.thesis.state) },
                      { label: "Confidence", value: "—" },
                      { label: "Rev Risk", value: "—" },
                    ]}
                  />

                  {/* Arrow divider */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 32,
                      color: "var(--text-tertiary)",
                      fontSize: 18,
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    →
                  </div>

                  <SnapshotBlock
                    label="CURRENT THESIS"
                    metrics={[
                      { label: "Probability", value: `${pctStr(s.currentProbability, 1)}%`, color: delta > 0 ? "var(--accent)" : delta < 0 ? "var(--accent-secondary)" : "var(--text-primary)" },
                      { label: "Regime", value: s.stateLabel.toUpperCase(), color: stateColor(s.currentState) },
                      { label: "Delta", value: ppStr(deltaPp, 1), color: deltaPp > 0 ? "var(--accent)" : deltaPp < 0 ? "var(--accent-secondary)" : "var(--text-secondary)" },
                      { label: "Status", value: thesisLabel, color: labelStyle.color },
                    ]}
                  />
                </div>

                {/* Bottom metrics row */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    className="card"
                    style={{
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div className="form-label" style={{ fontSize: 9 }}>CONFIDENCE</div>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {pctStr(s.confidence, 0)}%
                    </span>
                  </div>
                  <div
                    className="card"
                    style={{
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div className="form-label" style={{ fontSize: 9 }}>REV RISK</div>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: s.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)",
                      }}
                    >
                      {pctStr(s.reversalRisk, 0)}%
                    </span>
                  </div>
                  <div
                    className="card"
                    style={{
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <div className="form-label" style={{ fontSize: 9 }}>CREATED</div>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {new Date(s.thesis.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Alert banners */}
                {s.status === "weakening" && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: "var(--accent-warn-muted)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                      color: "var(--accent-warn)",
                    }}
                  >
                    Thesis Weakening — probability moved against your thesis by &gt;10%.
                  </div>
                )}
                {s.status === "invalidated" && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: "var(--accent-warn-muted)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                      color: "var(--accent-warn)",
                    }}
                  >
                    Thesis Invalidated — probability moved significantly against your thesis.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function ThesisMonitorPage() {
  const { address, isConnected } = useAccount();

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
          Thesis Tracker
        </h1>
      </div>

      {!isConnected || !address ? (
        <div className="card text-center animate-fade-up" style={{ padding: 64 }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>Connect wallet to view theses.</p>
          <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
            Theses are stored locally in your browser per wallet.
          </p>
        </div>
      ) : (
        <ThesisTracker key={address} address={address} />
      )}

      <section className="card" style={{ padding: 24, marginTop: 24 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>ABOUT</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          Thesis Monitor tracks your trade thesis against live market state. Each card shows an Entry snapshot (when you created the thesis) vs a Current snapshot (live data). Status indicates whether the thesis is strengthening, weakening, unchanged, or invalidated.
        </p>
        <p style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)", marginTop: 8 }}>
          LOCAL THESIS MEMORY — stored in this browser only. Not synced across devices.
        </p>
      </section>
    </div>
  );
}
