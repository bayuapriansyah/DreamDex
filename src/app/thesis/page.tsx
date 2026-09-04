"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface Thesis {
  id: string;
  asset: string;
  side: "up" | "down";
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

function stateColor(state: string): string {
  if (state.includes("bullish")) return "var(--accent-copper)";
  if (state.includes("bearish")) return "var(--accent-steel)";
  if (state === "reversal-warning") return "var(--accent-warn)";
  return "var(--muted-foreground)";
}

function statusStyle(status: string): { color: string; bg: string } {
  if (status === "active") return { color: "var(--accent-copper)", bg: "rgba(232,160,96,0.12)" };
  if (status === "weakening") return { color: "var(--accent-warn)", bg: "rgba(196,92,58,0.12)" };
  return { color: "var(--accent-warn)", bg: "rgba(196,92,58,0.16)" };
}

export default function ThesisMonitorPage() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [statuses, setStatuses] = useState<ThesisStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      setLoading(true);
      try {
        const stored = localStorage.getItem("dreamdex-theses");
        if (stored) { const parsed = JSON.parse(stored) as Thesis[]; if (!fetchedRef.current) setTheses(parsed); }
      } catch { /* silent */ }
      setLoading(false);
    }
    void load();
    return () => { fetchedRef.current = true; };
  }, []);

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
            if (thesis.side === "up") {
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
    localStorage.setItem("dreamdex-theses", JSON.stringify(next));
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "36px 28px 96px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.4rem", letterSpacing: "-0.02em", color: "var(--tape)", margin: 0 }}>Thesis Monitor</h1>
        <span style={{ fontSize: "0.62rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontFamily: "var(--font-display)" }}>{statuses.length} active</span>
      </div>

      {loading ? (
        <div className="py-12 text-center"><div className="h-8 w-48 mx-auto skeleton rounded" /></div>
      ) : statuses.length === 0 ? (
        <div className="py-16 text-center" style={{ color: "var(--muted-foreground)" }}>
          <p style={{ fontSize: "1rem", marginBottom: 8 }}>No theses tracked.</p>
          <p style={{ fontSize: "0.78rem" }}>Execute a trade from the Analysis page to create a thesis.</p>
        </div>
      ) : (
        <section>
          <p className="kicker" style={{ marginBottom: 12 }}>Active Theses</p>
          <div style={{ display: "grid", gap: 8 }}>
            {statuses.map((s) => {
              const ss = statusStyle(s.status);
              return (
                <div key={s.thesis.id} style={{ padding: "16px 18px", background: "rgba(239,230,214,0.035)", borderLeft: `3px solid ${stateColor(s.currentState)}` }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--tape)" }}>{s.thesis.asset}</span>
                      <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-data)", fontWeight: 500, color: s.thesis.side === "up" ? "var(--accent-copper)" : "var(--accent-steel)" }}>{s.thesis.side.toUpperCase()}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", fontFamily: "var(--font-data)" }}>{s.thesis.horizon}m</span>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: "0.58rem", letterSpacing: "0.12em", textTransform: "uppercase", color: ss.color, background: ss.bg }}>{s.status}</span>
                    </div>
                    <button onClick={() => removeThesis(s.thesis.id)} style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer", fontSize: "1rem", padding: "0 4px" }}>×</button>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", marginBottom: 10 }}>{s.thesis.thesis}</p>
                  <div className="grid grid-cols-5 gap-3" style={{ textAlign: "center" }}>
                    {[
                      { label: "Entry", value: `${(s.thesis.entryProbability * 100).toFixed(1)}%` },
                      { label: "Current", value: `${(s.currentProbability * 100).toFixed(1)}%` },
                      { label: "State", value: s.stateLabel, color: stateColor(s.currentState) },
                      { label: "Confidence", value: `${(s.confidence * 100).toFixed(0)}%` },
                      { label: "Rev Risk", value: `${(s.reversalRisk * 100).toFixed(0)}%`, color: s.reversalRisk > 0.5 ? "var(--accent-warn)" : "var(--chalk)" },
                    ].map((m) => (
                      <div key={m.label}>
                        <div style={{ fontSize: "0.54rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)", fontFamily: "var(--font-display)", marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: "0.78rem", fontFamily: "var(--font-data)", fontWeight: 500, color: m.color || "var(--chalk)", fontFeatureSettings: "\"tnum\"" }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  {s.status === "weakening" && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(196,92,58,0.12)", border: "1px solid rgba(196,92,58,0.3)", fontSize: "0.72rem", color: "var(--accent-warn)" }}>
                      Thesis Weakening — probability moved against your thesis by &gt;10%.
                    </div>
                  )}
                  {s.status === "invalidated" && (
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(196,92,58,0.16)", border: "1px solid rgba(196,92,58,0.3)", fontSize: "0.72rem", color: "var(--accent-warn)" }}>
                      Thesis Invalidated — probability moved significantly against your thesis.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section style={{ borderTop: "1px solid rgba(239,230,214,0.14)", paddingTop: 24, marginTop: 32 }}>
        <p className="kicker" style={{ marginBottom: 8 }}>About</p>
        <p style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          Thesis Monitor tracks your trade thesis against live market state. Weakening = moved against by &gt;10%. Invalidated = &gt;30%.
        </p>
      </section>
    </div>
  );
}
