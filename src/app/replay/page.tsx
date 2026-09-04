"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface Snapshot {
  timestamp: string;
  state: string;
  stateLabel: string;
  avgProbability: number;
  velocity: number;
  persistence: number;
  divergence: number;
  confidence: number;
  reversalRisk: number;
}

function stateColor(state: string): string {
  if (state.includes("bullish")) return "var(--accent-copper)";
  if (state.includes("bearish")) return "var(--accent-steel)";
  if (state === "reversal-warning") return "var(--accent-warn)";
  return "var(--muted-foreground)";
}

export default function ReplayPage() {
  const [asset, setAsset] = useState("BTC");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const recordingRef = useRef(false);

  const collectSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
      const data = await res.json();
      if (data.ok && data.trajectory) {
        const t = data.trajectory;
        const avgProb = t.horizons.length > 0 ? t.horizons.reduce((a: number, h: { midProbability: number }) => a + h.midProbability, 0) / t.horizons.length : 0.5;
        setSnapshots((prev) => {
          const next = [...prev, { timestamp: new Date().toISOString(), state: t.state, stateLabel: t.stateLabel, avgProbability: avgProb, velocity: t.metrics.velocityPerHour, persistence: t.metrics.persistence, divergence: t.metrics.crossHorizonDivergence, confidence: t.confidence, reversalRisk: t.reversalRisk }];
          if (next.length > 100) next.shift();
          return next;
        });
      }
    } catch { /* silent */ }
  }, [asset]);

  useEffect(() => {
    fetchedRef.current = false;
    recordingRef.current = false;
    async function load() { setLoading(true); setIsRecording(false); await collectSnapshot(); setLoading(false); }
    void load();
    return () => { fetchedRef.current = true; };
  }, [asset, collectSnapshot]);

  useEffect(() => {
    if (!isRecording) return;
    recordingRef.current = true;
    const interval = setInterval(() => { if (recordingRef.current) void collectSnapshot(); }, 5000);
    return () => { recordingRef.current = false; clearInterval(interval); };
  }, [isRecording, collectSnapshot]);

  const latest = snapshots[snapshots.length - 1];
  const maxProb = Math.max(...snapshots.map((s) => s.avgProbability), 1);
  const minProb = Math.min(...snapshots.map((s) => s.avgProbability), 0);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 28px 96px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.4rem", letterSpacing: "-0.02em", color: "var(--tape)", margin: 0 }}>Trajectory Replay</h1>
        <div className="flex items-center gap-2">
          {["BTC", "ETH"].map((a) => (
            <button key={a} onClick={() => { setAsset(a); setSnapshots([]); }}
              style={{
                height: 28, padding: "0 12px", borderRadius: 4, fontSize: "0.72rem", fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer",
                border: `1px solid ${asset === a ? "var(--accent-copper)" : "rgba(239,230,214,0.16)"}`,
                background: asset === a ? "rgba(232,160,96,0.12)" : "transparent",
                color: asset === a ? "var(--accent-copper)" : "var(--muted-foreground)",
              }}>
              {a}
            </button>
          ))}
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <p className="kicker" style={{ margin: 0 }}>Recording</p>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "0.68rem", color: "var(--muted-foreground)", fontFamily: "var(--font-data)" }}>{snapshots.length} snapshots</span>
            <button onClick={() => setIsRecording(!isRecording)}
              style={{
                height: 28, padding: "0 14px", borderRadius: 4, fontSize: "0.72rem", fontFamily: "var(--font-display)", fontWeight: 700, cursor: "pointer",
                border: `1px solid ${isRecording ? "var(--accent-warn)" : "var(--accent-copper)"}`,
                background: isRecording ? "rgba(196,92,58,0.16)" : "rgba(232,160,96,0.12)",
                color: isRecording ? "var(--accent-warn)" : "var(--accent-copper)",
              }}>
              {isRecording ? "Stop" : "Record"}
            </button>
            <button onClick={() => void collectSnapshot()} disabled={loading}
              style={{
                height: 28, padding: "0 14px", borderRadius: 4, fontSize: "0.72rem", fontFamily: "var(--font-display)", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.4 : 1,
                border: "1px solid rgba(239,230,214,0.16)", background: "transparent", color: "var(--muted-foreground)",
              }}>
              Snapshot
            </button>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="py-16 text-center" style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
            No snapshots yet. Click Record to auto-collect every 5s.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {latest && (
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: "State", value: latest.stateLabel, color: stateColor(latest.state) },
                  { label: "Avg Prob", value: `${(latest.avgProbability * 100).toFixed(1)}%` },
                  { label: "Velocity", value: `${latest.velocity > 0 ? "+" : ""}${(latest.velocity * 100).toFixed(2)}%/hr`, color: latest.velocity > 0 ? "var(--accent-copper)" : latest.velocity < 0 ? "var(--accent-steel)" : "var(--chalk)" },
                  { label: "Confidence", value: `${(latest.confidence * 100).toFixed(0)}%` },
                  { label: "Rev Risk", value: `${(latest.reversalRisk * 100).toFixed(0)}%`, color: latest.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--chalk)" },
                ].map((m) => (
                  <div key={m.label} style={{ padding: "10px 8px", background: "rgba(239,230,214,0.035)", border: "1px solid rgba(239,230,214,0.08)", textAlign: "center" }}>
                    <div style={{ fontSize: "0.54rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontFamily: "var(--font-display)", marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: "0.82rem", fontFamily: "var(--font-data)", fontWeight: 500, color: m.color || "var(--chalk)", fontFeatureSettings: "\"tnum\"" }}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div style={{ position: "relative", height: 160, background: "rgba(239,230,214,0.02)", border: "1px solid rgba(239,230,214,0.08)", overflow: "hidden" }}>
              <svg viewBox={`0 0 ${Math.max(snapshots.length - 1, 1)} 1`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-copper)" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="rgba(239,230,214,0.15)" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="var(--accent-steel)" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#replayGrad)" />
                <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke="rgba(239,230,214,0.2)" strokeWidth="0.005" strokeDasharray="0.02" />
                {snapshots.length > 1 && (
                  <polyline points={snapshots.map((s, i) => { const range = maxProb - minProb || 1; const y = 1 - (s.avgProbability - minProb) / range; return `${i},${y}`; }).join(" ")} fill="none" stroke="var(--accent-copper)" strokeWidth="0.015" vectorEffect="non-scaling-stroke" />
                )}
                {snapshots.map((s, i) => {
                  const range = maxProb - minProb || 1;
                  const y = 1 - (s.avgProbability - minProb) / range;
                  return <circle key={i} cx={i} cy={y} r="0.02" fill={stateColor(s.state)} vectorEffect="non-scaling-stroke" stroke="var(--tape)" strokeWidth="2" />;
                })}
              </svg>
              <div style={{ position: "absolute", top: 6, right: 8, fontSize: "0.6rem", color: "var(--muted-foreground)" }}>↑ Higher ↓ Lower</div>
            </div>

            {/* History */}
            <section>
              <p className="kicker" style={{ marginBottom: 8 }}>History</p>
              <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid rgba(239,230,214,0.08)" }}>
                {[...snapshots].reverse().map((s, i) => (
                  <div key={i} className="flex items-center gap-3 horizon-row" style={{ padding: "6px 14px", borderBottom: "1px solid rgba(239,230,214,0.06)", fontSize: "0.72rem" }}>
                    <span style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-data)", width: 64, fontFeatureSettings: "\"tnum\"" }}>{new Date(s.timestamp).toLocaleTimeString()}</span>
                    <span style={{ fontWeight: 500, width: 144, color: stateColor(s.state) }}>{s.stateLabel}</span>
                    <span style={{ fontFamily: "var(--font-data)", width: 64, fontFeatureSettings: "\"tnum\"", color: "var(--chalk)" }}>{(s.avgProbability * 100).toFixed(1)}%</span>
                    <span style={{ fontFamily: "var(--font-data)", width: 80, fontFeatureSettings: "\"tnum\"", color: s.velocity > 0 ? "var(--accent-copper)" : s.velocity < 0 ? "var(--accent-steel)" : "var(--chalk)" }}>
                      {s.velocity > 0 ? "+" : ""}{(s.velocity * 100).toFixed(2)}%/hr
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>

      <section style={{ borderTop: "1px solid rgba(239,230,214,0.14)", paddingTop: 24, marginTop: 32 }}>
        <p className="kicker" style={{ marginBottom: 8 }}>About</p>
        <p style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          Trajectory Replay captures periodic snapshots of the temporal trajectory. Each snapshot records Market State, average probability, velocity, persistence, and divergence across all active horizons.
        </p>
      </section>
    </div>
  );
}
