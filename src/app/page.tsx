"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  stateColor,
  formatHorizon,
  probBarBg,
  pctStr,
} from "@/lib/dreamdex/formatting";

const ParticleNetwork = dynamic(
  () => import("@/components/particles/ParticleNetwork"),
  { ssr: false }
);

interface HorizonPreview {
  horizonMinutes: number;
  midProbability: number | null;
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

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animated.current) {
          animated.current = true;
          const start = Date.now();
          const duration = 800;
          const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(value * eased * 10) / 10);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toFixed(1)}{suffix}
    </span>
  );
}

export default function Home() {
  const [pulses, setPulses] = useState<AssetPulse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        const assets = ["BTC", "ETH"];
        const results: AssetPulse[] = [];
        for (const asset of assets) {
          const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!fetchedRef.current && data.ok && data.trajectory) {
            const t = data.trajectory;
            results.push({
              asset,
              state: t.state,
              stateLabel: t.stateLabel,
              horizons: t.horizons.map(
                (h: {
                  horizonMinutes: number;
                  midProbability: number | null;
                }) => ({
                  horizonMinutes: h.horizonMinutes,
                  midProbability: h.midProbability,
                })
              ),
              velocityPerHour: t.metrics.velocityPerHour,
              confidence: t.confidence,
              trajectoryScore: t.trajectoryScore,
              reversalRisk: t.reversalRisk,
            });
          }
        }
        if (!fetchedRef.current) {
          setPulses(results);
          if (results.length === 0) setError("No live markets found.");
        }
      } catch (e) {
        if (!fetchedRef.current) {
          setError(
            e instanceof Error
              ? `Unable to load market intelligence: ${e.message}`
              : "Unable to load market intelligence."
          );
        }
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, 30000);
    return () => {
      fetchedRef.current = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* ══════════════════════════════════════════════════ */}
      {/* HERO — Full viewport, massive type                */}
      {/* ══════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 overflow-hidden"
        style={{ minHeight: "88vh" }}
      >
        {/* Particle network background */}
        <ParticleNetwork />

        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            filter: "blur(60px)",
            zIndex: 1,
          }}
        />

        {/* Badge */}
        <div
          className="relative animate-fade-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: "var(--radius-full)",
            background: "var(--accent-muted)",
            border: "1px solid rgba(245, 158, 11, 0.15)",
            marginBottom: 32,
            zIndex: 2,
          }}
        >
          <span className="live-dot" style={{ fontSize: 11 }}>
            Live on Somnia Shannon
          </span>
        </div>

        {/* MASSIVE Headline */}
        <h1
          className="relative animate-fade-up delay-1"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(44px, 9vw, 96px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)",
            marginBottom: 24,
            maxWidth: 900,
            zIndex: 2,
          }}
        >
          Trade the
          <br />
          <span className="text-gradient">Trajectory</span>
        </h1>

        {/* Sub-headline */}
        <p
          className="relative animate-fade-up delay-2"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(16px, 2.5vw, 20px)",
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            maxWidth: 560,
            marginBottom: 40,
            zIndex: 2,
          }}
        >
          See how market conviction evolves across time horizons.
          DreamDEX gives you the probability. We give you the edge.
        </p>

        {/* CTAs */}
        <div className="relative flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0 animate-fade-up delay-3" style={{ zIndex: 2 }}>
          <Link href="/markets" className="btn-primary btn-lg w-full sm:w-auto text-center">
            Start Analyzing
          </Link>
          <Link href="/analyze/BTC" className="btn-secondary btn-lg w-full sm:w-auto text-center">
            View Contracts
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* STATS BAR — Animated counters                     */}
      {/* ══════════════════════════════════════════════════ */}
      <section
        className="mx-auto px-4 animate-fade-up delay-4"
        style={{ maxWidth: 900, paddingBottom: 80 }}
      >
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-6"
          style={{
            padding: "32px 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {[
            { label: "Horizons Tracked", value: 3, suffix: "" },
            { label: "Assets Covered", value: 2, suffix: "" },
            { label: "Avg Confidence", value: 50, suffix: "%" },
            { label: "Data Refresh", value: 30, suffix: "s" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "clamp(28px, 4vw, 40px)",
                  lineHeight: 1,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}
              >
                <AnimatedNumber value={stat.value} suffix={stat.suffix} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-data)",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* MARKET PULSE — Live data cards                    */}
      {/* ══════════════════════════════════════════════════ */}
      <section
        className="mx-auto px-4"
        style={{ maxWidth: 1100, paddingBottom: 100 }}
      >
        <div className="flex items-center gap-3 mb-8">
          <span className="live-dot" style={{ fontSize: 12 }}>
            Market Pulse
          </span>
          <span
            style={{
              fontSize: 13,
              fontFamily: "var(--font-data)",
              color: "var(--text-tertiary)",
            }}
          >
            Real-time multi-horizon data
          </span>
        </div>

        {loading && pulses.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[0, 1].map((i) => (
              <div key={i} className="card" style={{ padding: 32 }}>
                <div className="skeleton" style={{ height: 24, width: 100, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 18, width: 200, marginBottom: 28 }} />
                <div className="flex gap-3 mb-6">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="skeleton" style={{ height: 100, flex: 1 }} />
                  ))}
                </div>
                <div className="skeleton" style={{ height: 14, width: "100%" }} />
              </div>
            ))}
          </div>
        )}

        {error && pulses.length === 0 && (
          <div className="card text-center" style={{ padding: 64 }}>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Retry
            </button>
          </div>
        )}

        {pulses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pulses.map((pulse, idx) => {
              const sorted = [...pulse.horizons].sort(
                (a, b) => a.horizonMinutes - b.horizonMinutes
              );
              return (
                <Link
                  key={pulse.asset}
                  href={`/analyze/${pulse.asset}`}
                  className="card card-interactive no-underline animate-fade-up"
                  style={{
                    padding: 32,
                    animationDelay: `${0.1 + idx * 0.1}s`,
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 28,
                          color: "var(--text-primary)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {pulse.asset}
                      </span>
                      <span
                        className="status-pill"
                        style={{
                          color: stateColor(pulse.state),
                          background: `${stateColor(pulse.state)}15`,
                          border: `1px solid ${stateColor(pulse.state)}25`,
                        }}
                      >
                        {pulse.stateLabel}
                      </span>
                    </div>
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {pctStr(pulse.confidence, 0)}% confidence
                    </span>
                  </div>

                  {/* Horizon Bars — Bigger */}
                  <div className="flex gap-3 mb-6">
                    {sorted.map((h) => (
                      <div key={h.horizonMinutes} className="flex-1 text-center">
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-data)",
                            color: "var(--text-tertiary)",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {formatHorizon(h.horizonMinutes)}
                        </div>
                        <div
                          className="relative overflow-hidden"
                          style={{
                            height: 90,
                            borderRadius: "var(--radius-md)",
                            background: "var(--surface-2)",
                          }}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 metric-fill"
                            style={{
                              height: `${(h.midProbability ?? 0.5) * 100}%`,
                              background: probBarBg(h.midProbability),
                              borderRadius:
                                "var(--radius-md) var(--radius-md) 0 0",
                            }}
                          />
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: 20,
                            fontFamily: "var(--font-data)",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginTop: 10,
                          }}
                        >
                          {h.midProbability !== null
                            ? `${pctStr(h.midProbability, 0)}%`
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Metrics */}
                  <div
                    className="flex items-center gap-5"
                    style={{
                      paddingTop: 16,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Velocity:{" "}
                      <span
                        style={{
                          color:
                            pulse.velocityPerHour > 0
                              ? "var(--accent)"
                              : "var(--accent-secondary)",
                        }}
                      >
                        {pulse.velocityPerHour > 0 ? "+" : ""}
                        {pctStr(pulse.velocityPerHour, 2)}%/hr
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Score:{" "}
                      <span style={{ color: "var(--text-primary)" }}>
                        {pctStr(pulse.trajectoryScore, 0)}%
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-data)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Rev Risk:{" "}
                      <span
                        style={{
                          color:
                            pulse.reversalRisk > 0.5
                              ? "var(--accent-warn)"
                              : "var(--text-primary)",
                        }}
                      >
                        {pctStr(pulse.reversalRisk, 0)}%
                      </span>
                    </span>
                  </div>

                  {/* CTA */}
                  <div
                    className="flex items-center gap-2 mt-5"
                    style={{
                      fontSize: 14,
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                      color: "var(--accent)",
                    }}
                  >
                    Analyze {pulse.asset}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* HOW IT WORKS — 3 steps                           */}
      {/* ══════════════════════════════════════════════════ */}
      <section
        className="mx-auto px-4"
        style={{ maxWidth: 1100, paddingBottom: 100 }}
      >
        <h2
          className="text-center animate-fade-up"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(24px, 4vw, 36px)",
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          How it works
        </h2>
        <p
          className="text-center animate-fade-up delay-1"
          style={{
            fontSize: 16,
            color: "var(--text-secondary)",
            maxWidth: 480,
            margin: "0 auto 48px",
          }}
        >
          Three horizons. One trajectory. Real conviction.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Discover Markets",
              desc: "Browse live Event Contracts across 5m, 1h, and 4h horizons on Somnia Shannon testnet.",
              icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
            },
            {
              step: "02",
              title: "Read the Trajectory",
              desc: "See how conviction evolves. Acceleration, decay, reversal risk — all in one view.",
              icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
            },
            {
              step: "03",
              title: "Execute with Confidence",
              desc: "Choose a strategy. Preview the trade. Execute on DreamDEX with one click.",
              icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
            },
          ].map((f, i) => (
            <div
              key={f.step}
              className="card animate-fade-up"
              style={{
                padding: 36,
                animationDelay: `${0.15 + i * 0.1}s`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-data)",
                  fontWeight: 600,
                  color: "var(--accent)",
                  marginBottom: 16,
                  letterSpacing: "0.08em",
                }}
              >
                STEP {f.step}
              </div>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 20,
                  color: "var(--text-primary)",
                  marginBottom: 12,
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "var(--text-secondary)",
                }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ */}
      {/* CALL TO ACTION — Helm-styled conversion banner    */}
      {/* ══════════════════════════════════════════════════ */}
      <section
        className="mx-auto px-4"
        style={{ maxWidth: 1100, paddingBottom: 110 }}
      >
        <div
          className="relative overflow-hidden text-center"
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 24,
            padding: "clamp(48px, 7vw, 72px) 24px",
          }}
        >
          {/* Ambient Glow */}
          <div
            className="pointer-events-none absolute"
            style={{
              width: 450,
              height: 450,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245, 158, 11, 0.07) 0%, transparent 70%)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              filter: "blur(50px)",
              zIndex: 1,
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            {/* Pill Tag */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 9999,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "0.75rem",
                fontFamily: "var(--font-data)",
                color: "rgba(255, 255, 255, 0.8)",
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 8px #22c55e",
                }}
              />
              Somnia Shannon Testnet
            </div>

            {/* Headline */}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "clamp(28px, 4.5vw, 44px)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "#ffffff",
                maxWidth: 640,
                marginBottom: 16,
              }}
            >
              Ready to Map Market Conviction?
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                lineHeight: 1.6,
                color: "rgba(255, 255, 255, 0.65)",
                maxWidth: 540,
                marginBottom: 36,
                fontFamily: "var(--font-body)",
              }}
            >
              Transform isolated Up/Down probabilities into a real-time trajectory of market conviction across rolling horizons.
            </p>

            {/* Pill CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/markets"
                className="no-underline transition-transform active:scale-95"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 44,
                  padding: "0 26px",
                  background: "#ffffff",
                  color: "#09090b",
                  borderRadius: 9999,
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  fontFamily: "var(--font-body)",
                  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
                }}
              >
                Explore Live Markets
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>

              <Link
                href="/analyze/BTC"
                className="no-underline transition-colors"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 44,
                  padding: "0 22px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  borderRadius: 9999,
                  fontWeight: 500,
                  fontSize: "0.88rem",
                  fontFamily: "var(--font-body)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                }}
              >
                View BTC Trajectory
              </Link>

              <Link
                href="/trade"
                className="no-underline transition-colors"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 44,
                  padding: "0 18px",
                  color: "rgba(255, 255, 255, 0.6)",
                  borderRadius: 9999,
                  fontWeight: 500,
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-body)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ffffff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                }}
              >
                Trade Terminal →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
