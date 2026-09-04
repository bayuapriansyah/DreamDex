"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface HorizonPreview {
  horizonMinutes: number;
  midProbability: number;
}

interface AssetPulse {
  asset: string;
  state: string;
  stateLabel: string;
  horizons: HorizonPreview[];
  velocityPerHour: number;
  confidence: number;
  trajectoryScore: number;
  reversalRisk: number;
}

function stateColor(state: string): string {
  if (state.includes("bullish")) return "var(--accent-copper)";
  if (state.includes("bearish")) return "var(--accent-steel)";
  if (state === "reversal-warning") return "var(--accent-warn)";
  return "var(--muted-foreground)";
}

function formatHorizon(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(0)}h`;
  return `${(mins / 1440).toFixed(0)}d`;
}

function probBarColor(p: number): string {
  if (p > 0.6) return "var(--accent-copper)";
  if (p < 0.4) return "var(--accent-steel)";
  return "rgba(239,230,214,0.25)";
}

export default function Home() {
  const [pulses, setPulses] = useState<AssetPulse[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        const assets = ["BTC", "ETH"];
        const results: AssetPulse[] = [];
        for (const asset of assets) {
          const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
          const data = await res.json();
          if (!fetchedRef.current && data.ok && data.trajectory) {
            const t = data.trajectory;
            results.push({
              asset,
              state: t.state,
              stateLabel: t.stateLabel,
              horizons: t.horizons.map((h: { horizonMinutes: number; midProbability: number }) => ({
                horizonMinutes: h.horizonMinutes,
                midProbability: h.midProbability,
              })),
              velocityPerHour: t.metrics.velocityPerHour,
              confidence: t.confidence,
              trajectoryScore: t.trajectoryScore,
              reversalRisk: t.reversalRisk,
            });
          }
        }
        if (!fetchedRef.current) setPulses(results);
      } catch {
        // silent
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    return () => { fetchedRef.current = true; };
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-68px)]">
      {/* Grain overlay */}
      <div className="grain" aria-hidden="true" />

      {/* Hero section */}
      <section className="relative min-h-[calc(100svh-68px)] flex items-center"
        style={{ padding: "12px 28px 120px" }}>
        <div className="relative z-10 w-full" style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="grid gap-9" style={{ gridTemplateColumns: "1.08fr .92fr", alignItems: "center" }}>
            {/* Left — Copy */}
            <div>
              <p className="kicker" style={{ marginBottom: 12 }}>Temporal Intelligence</p>
              <h1 style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3.2rem, 9vw, 6.4rem)",
                fontWeight: 800,
                lineHeight: 0.88,
                letterSpacing: "-0.03em",
                color: "var(--tape)",
                margin: "0 0 18px",
              }}>
                Map conviction across time.
              </h1>
              <p style={{
                maxWidth: "36rem",
                fontSize: "1.05rem",
                lineHeight: 1.55,
                color: "var(--chalk)",
                margin: "0 0 28px",
              }}>
                DreamDEX gives you isolated Up or Down probabilities. DreamDex Temporal shows how
                the market&apos;s belief evolves across horizons — velocity, decay, persistence, and reversal risk.
              </p>
              <div className="flex flex-wrap gap-5 items-center">
                <Link href="/markets" className="solid" style={{ padding: "14px 24px", fontSize: "1.02rem" }}>
                  Explore Markets
                </Link>
                <Link href="/analyze/BTC" className="ghost" style={{ fontSize: "0.95rem" }}>
                  Analyze BTC
                </Link>
              </div>
            </div>

            {/* Right — Live Visual */}
            <div className="flex flex-col items-center gap-6">
              {loading ? (
                <div className="w-full space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-lg skeleton"
                      style={{ background: "rgba(239,230,214,0.035)" }} />
                  ))}
                </div>
              ) : pulses.length > 0 ? (
                pulses.map((p) => (
                  <Link key={p.asset} href={`/analyze/${p.asset}`}
                    className="block w-full rounded-lg transition-all group"
                    style={{
                      padding: "22px 24px",
                      background: "rgba(239,230,214,0.035)",
                      borderLeft: `3px solid ${stateColor(p.state)}`,
                    }}>
                    {/* Header */}
                    <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                      <div className="flex items-center gap-3">
                        <span style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 800,
                          fontSize: "1.1rem",
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--tape)",
                        }}>{p.asset}</span>
                        <span style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          color: stateColor(p.state),
                        }}>{p.stateLabel}</span>
                      </div>
                      <div className="flex items-center gap-3" style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", fontFeatureSettings: "\"tnum\"" }}>
                        <span>Score <b style={{ color: "var(--tape)" }}>{(p.trajectoryScore * 100).toFixed(0)}%</b></span>
                        <span>Conf <b style={{ color: "var(--tape)" }}>{(p.confidence * 100).toFixed(0)}%</b></span>
                        {p.reversalRisk > 0.5 && (
                          <span style={{ color: "var(--accent-warn)" }}>
                            Rev {(p.reversalRisk * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Horizon bars */}
                    <div className="flex items-end gap-2" style={{ height: 56 }}>
                      {p.horizons
                        .sort((a, b) => a.horizonMinutes - b.horizonMinutes)
                        .map((h) => (
                          <div key={h.horizonMinutes} className="flex-1 flex flex-col items-center gap-1">
                            <span style={{
                              fontSize: "0.6rem",
                              color: "var(--muted-foreground)",
                              fontFeatureSettings: "\"tnum\"",
                            }}>
                              {(h.midProbability * 100).toFixed(0)}%
                            </span>
                            <div className="w-full rounded-sm metric-fill"
                              style={{
                                height: `${Math.max(h.midProbability * 48, 3)}px`,
                                background: probBarColor(h.midProbability),
                                opacity: 0.5 + h.midProbability * 0.5,
                              }} />
                            <span style={{ fontSize: "0.56rem", color: "var(--muted-foreground)" }}>
                              {formatHorizon(h.horizonMinutes)}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between"
                      style={{
                        marginTop: 14,
                        paddingTop: 10,
                        borderTop: "1px solid rgba(239,230,214,0.1)",
                        fontSize: "0.72rem",
                        color: "var(--muted-foreground)",
                        fontFeatureSettings: "\"tnum\"",
                      }}>
                      <span>
                        Velocity {p.velocityPerHour > 0 ? "+" : ""}{(p.velocityPerHour * 100).toFixed(2)}%/hr
                      </span>
                      <span style={{ color: "var(--accent-copper)" }} className="group-hover:translate-x-0.5 transition-transform">
                        Analyze →
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12" style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
                  No live markets found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Watermark */}
        <div aria-hidden="true" style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "calc(120px - 0.176em)",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "min(15.5vw, 24svh)",
          lineHeight: 1,
          letterSpacing: "0.02em",
          textAlign: "center",
          whiteSpace: "nowrap",
          color: "transparent",
          WebkitTextStroke: "1px rgba(239,230,214,0.06)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 50%)",
          maskImage: "linear-gradient(180deg, transparent 0, #000 50%)",
          userSelect: "none",
          pointerEvents: "none",
        }}>
          TEMPORAL
        </div>
      </section>

      {/* Ticker tape */}
      <div style={{
        position: "relative",
        zIndex: 2,
        height: 44,
        overflow: "clip",
        color: "#1e1a14",
        background: "var(--tape)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(30,26,20,0.14)",
      }}>
        <div style={{
          display: "flex",
          height: "100%",
          width: "max-content",
          animation: "marquee 64s linear infinite",
        }}>
          {[0, 1].map((loop) => (
            <div key={loop} className="flex shrink-0 items-center" style={{ height: "100%" }}>
              {[
                { k: "Chain", v: "Somnia Shannon 50312" },
                { k: "Venue", v: "DreamDEX BTC" },
                { k: "Type", v: "Event Contracts" },
                { k: "Up", v: "BUY_YES", color: "var(--accent-copper)" },
                { k: "Down", v: "BUY_NO", color: "var(--accent-steel)" },
                { k: "Horizons", v: "15m · 30m · 45m · 60m" },
                { k: "SDK", v: "markets-sdk 0.29.0" },
                { k: "Analysis", v: "Temporal Trajectory" },
                { k: "Confidence", v: "Signal Quality" },
                { k: "Velocity", v: "Conviction Speed" },
              ].map((item, i) => (
                <span key={`${loop}-${i}`} className="inline-flex items-baseline whitespace-nowrap"
                  style={{ padding: "0 26px", position: "relative" }}>
                  <span style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: "0.58rem",
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "rgba(30,26,20,0.5)",
                    marginRight: 10,
                    fontStyle: "normal",
                  }}>{item.k}</span>
                  <span style={{
                    fontFamily: "var(--font-data)",
                    fontWeight: 500,
                    fontSize: "0.8rem",
                    fontFeatureSettings: "\"tnum\"",
                    color: item.color || "#1e1a14",
                  }}>{item.v}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* What section */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "108px 28px" }}>
        <p className="kicker" style={{ marginBottom: 12 }}>What this is</p>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
          fontWeight: 700,
          lineHeight: 1.1,
          color: "var(--tape)",
          margin: "0 0 22px",
        }}>
          Not just Up or Down.<br />The trajectory of belief.
        </h2>
        <p style={{
          maxWidth: "40rem",
          lineHeight: 1.65,
          color: "var(--chalk)",
          margin: "0 0 36px",
        }}>
          DreamDEX already lets traders express directional view on Event Contracts. DreamDex Temporal
          aggregates multiple rolling horizons into a conviction trajectory — showing how market belief
          evolves, accelerates, decays, or reverses across time.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {[
            { label: "DreamDEX", title: "Isolated probabilities", desc: "Each horizon is a separate market. Up or Down. No context across time.", highlight: false },
            { label: "Analysis", title: "Single snapshot", desc: "One probability at one moment. No velocity, no decay, no trajectory.", highlight: false },
            { label: "TEMPORAL", title: "Conviction trajectory", desc: "Aggregate horizons. Measure velocity, persistence, decay. See the full picture.", highlight: true },
          ].map((item) => (
            <div key={item.label} style={{
              padding: "20px 18px 18px",
              background: item.highlight ? "var(--tape)" : "rgba(22,19,42,0.7)",
              border: `1px solid ${item.highlight ? "transparent" : "rgba(239,230,214,0.08)"}`,
              color: item.highlight ? "var(--ink)" : "inherit",
            }}>
              <span style={{
                display: "block",
                fontFamily: "var(--font-display)",
                fontSize: "0.68rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: item.highlight ? "var(--accent-ember)" : "var(--muted-foreground)",
                marginBottom: 8,
              }}>{item.label}</span>
              <strong style={{
                display: "block",
                fontFamily: "var(--font-display)",
                fontSize: "1.15rem",
                color: item.highlight ? "var(--ink)" : "var(--tape)",
                marginBottom: 10,
              }}>{item.title}</strong>
              <p style={{
                margin: 0,
                lineHeight: 1.5,
                fontSize: "0.9rem",
                color: item.highlight ? "#3a3428" : "var(--muted-foreground)",
              }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA section */}
      <section style={{
        textAlign: "center",
        padding: "140px 28px 160px",
        background: "radial-gradient(ellipse 60% 50% at 50% 80%, rgba(201,132,58,0.12), transparent 70%)",
      }}>
        <p className="kicker" style={{ marginBottom: 12 }}>The next window is 15 minutes</p>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.9rem, 4vw, 3rem)",
          fontWeight: 700,
          lineHeight: 1.08,
          color: "var(--tape)",
          margin: "0 0 22px",
        }}>
          The window is open.
        </h2>
        <p style={{ margin: "0 0 28px", color: "var(--muted-foreground)" }}>
          Connect a Shannon wallet. Analyze temporal trajectories. Trade with intelligence.
        </p>
        <Link href="/markets" className="solid" style={{ padding: "14px 28px", fontSize: "1.02rem" }}>
          Open the Terminal
        </Link>
      </section>

    </div>
  );
}
