"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { stateColor, pctStr } from "@/lib/dreamdex/formatting";

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

const STORAGE_KEY = "dreamdex-replay-snapshots";

function loadSnapshots(): Snapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSnapshots(snapshots: Snapshot[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  } catch {
    // quota exceeded — silently drop
  }
}

export default function ReplayPage() {
  const [asset, setAsset] = useState("BTC");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const recordingRef = useRef(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshots(loadSnapshots());
  }, []);

  // Persist to sessionStorage on change
  useEffect(() => {
    saveSnapshots(snapshots);
  }, [snapshots]);

  const collectSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.ok && data.trajectory) {
        setError(null);
        const t = data.trajectory;
        const validHorizons = t.horizons.filter((h: { midProbability: number | null }) => h.midProbability !== null);
        const avgProb = validHorizons.length > 0 ? validHorizons.reduce((a: number, h: { midProbability: number }) => a + h.midProbability, 0) / validHorizons.length : 0;
        setSnapshots((prev) => {
          const next = [...prev, { timestamp: new Date().toISOString(), state: t.state, stateLabel: t.stateLabel, avgProbability: avgProb, velocity: t.metrics.velocityPerHour, persistence: t.metrics.persistence, divergence: t.metrics.crossHorizonDivergence, confidence: t.confidence, reversalRisk: t.reversalRisk }];
          if (next.length > 100) next.shift();
          return next;
        });
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `Snapshot failed: ${e.message}`
          : "Snapshot failed. Check network and try again."
      );
    }
  }, [asset]);

  useEffect(() => {
    fetchedRef.current = false;
    recordingRef.current = false;
    async function load() { setLoading(true); setIsRecording(false); setError(null); await collectSnapshot(); setLoading(false); }
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
            Signal Replay
          </h1>
          <div className="flex items-center gap-3">
            {isRecording && <span className="live-dot" style={{ color: "var(--accent-warn)" }}>RECORDING</span>}
            <span style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
              {snapshots.length} snapshots
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {["BTC", "ETH"].map((a) => (
            <button
              key={a}
              onClick={() => { setAsset(a); setSnapshots([]); }}
              className={asset === a ? "btn-primary btn-sm" : "btn-ghost btn-sm"}
            >
              {a}
            </button>
          ))}
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={isRecording ? "btn-sm" : "btn-secondary btn-sm"}
            style={isRecording ? {
              background: "var(--accent-warn-muted)",
              color: "var(--accent-warn)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            } : {}}
          >
            {isRecording ? "STOP" : "RECORD"}
          </button>
          <button
            onClick={() => void collectSnapshot()}
            disabled={loading}
            className="btn-ghost btn-sm"
          >
            SNAPSHOT
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card animate-fade-up" style={{ padding: 20, borderLeft: "3px solid var(--accent-warn)", marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontFamily: "var(--font-data)", color: "var(--accent-warn)" }}>{error}</p>
        </div>
      )}

      {/* Empty / Waiting */}
      {snapshots.length === 0 ? (
        <div className="card text-center animate-fade-up" style={{ padding: 64 }}>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
            No snapshots yet. Click Record to auto-collect every 5s, or Snapshot for a single capture.
          </p>
        </div>
      ) : snapshots.length < 2 ? (
        <div className="card text-center animate-fade-up" style={{ padding: 64 }}>
          <div className="form-label" style={{ color: "var(--accent-secondary)", marginBottom: 12 }}>REPLAY UNAVAILABLE</div>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 16 }}>
            Only {snapshots.length} snapshot captured. Record more snapshots to replay temporal conviction.
          </p>
          <button onClick={() => void collectSnapshot()} className="btn-primary">
            RECORD SNAPSHOT
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Latest snapshot */}
          {latest && (
            <section className="card animate-fade-up" style={{ padding: 28 }}>
              <div className="form-label" style={{ marginBottom: 16 }}>LATEST SNAPSHOT</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "State", value: latest.stateLabel.toUpperCase(), color: stateColor(latest.state) },
                  { label: "Avg Prob", value: `${pctStr(latest.avgProbability, 1)}%` },
                  { label: "Velocity", value: `${latest.velocity > 0 ? "+" : ""}${pctStr(latest.velocity, 2)}%/hr`, color: latest.velocity > 0 ? "var(--accent)" : latest.velocity < 0 ? "var(--accent-secondary)" : "var(--text-primary)" },
                  { label: "Confidence", value: `${pctStr(latest.confidence, 0)}%` },
                  { label: "Rev Risk", value: `${pctStr(latest.reversalRisk, 0)}%`, color: latest.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--text-primary)" },
                ].map((m) => (
                  <div key={m.label} style={{
                    padding: 14,
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}>
                    <div className="form-label" style={{ marginBottom: 6 }}>{m.label}</div>
                    <div style={{
                      fontSize: 16,
                      fontFamily: "var(--font-data)",
                      fontWeight: 700,
                      color: m.color || "var(--text-primary)",
                    }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Chart */}
          <section className="card animate-fade-up" style={{ padding: 28 }}>
            <div className="form-label" style={{ marginBottom: 16 }}>PROBABILITY TRAJECTORY</div>
            <div className="relative" style={{ height: 160 }}>
              <svg viewBox={`0 0 ${Math.max(snapshots.length - 1, 1)} 1`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <linearGradient id="replayGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#replayGrad)" rx="2" />
                <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke="rgba(255,255,255,0.1)" strokeWidth="0.005" strokeDasharray="0.02" />
                {snapshots.length > 1 && (
                  <polyline points={snapshots.map((s, i) => { const range = maxProb - minProb || 1; const y = 1 - (s.avgProbability - minProb) / range; return `${i},${y}`; }).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="0.015" vectorEffect="non-scaling-stroke" />
                )}
                {snapshots.map((s, i) => {
                  const range = maxProb - minProb || 1;
                  const y = 1 - (s.avgProbability - minProb) / range;
                  return <circle key={i} cx={i} cy={y} r="0.02" fill={stateColor(s.state)} vectorEffect="non-scaling-stroke" stroke="var(--surface-1)" strokeWidth="2" />;
                })}
              </svg>
              <div className="absolute top-1 right-2" style={{ fontSize: 10, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                ↑ Higher ↓ Lower
              </div>
            </div>
          </section>

          {/* History */}
          <section className="card animate-fade-up" style={{ padding: 28 }}>
            <div className="form-label" style={{ marginBottom: 16 }}>HISTORY</div>
            <div style={{ maxHeight: 192, overflowY: "auto" }}>
              {[...snapshots].reverse().map((s, i) => (
                <div key={i} className="flex items-center justify-between" style={{ padding: "6px 0" }}>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-tertiary)" }}>
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", fontWeight: 500, color: stateColor(s.state), width: 100 }}>
                    {s.stateLabel.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: "var(--text-primary)" }}>
                    {pctStr(s.avgProbability, 1)}%
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-data)", color: s.velocity > 0 ? "var(--accent)" : s.velocity < 0 ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                    {s.velocity > 0 ? "+" : ""}{pctStr(s.velocity, 2)}%/hr
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* About */}
      <section className="card" style={{ padding: 24, marginTop: 24 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>ABOUT</div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          Signal Replay captures periodic snapshots of the temporal trajectory. Each snapshot records Market State, average probability, velocity, persistence, and divergence across all active horizons.
        </p>
      </section>
    </div>
  );
}
