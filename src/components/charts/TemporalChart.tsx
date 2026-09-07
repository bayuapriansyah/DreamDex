"use client";

import { useEffect, useRef, useMemo } from "react";
import { createChart, createSeriesMarkers, LineSeries, AreaSeries, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time } from "lightweight-charts";
import { stateColor, probColor, formatHorizon, pctStr } from "@/lib/dreamdex/formatting";

interface HorizonPoint {
  horizonMinutes: number;
  marketId: string;
  yesProbability: number | null;
  bidProbability: number | null;
  askProbability: number | null;
  midProbability: number | null;
  spread: number | null;
  volume: number | null;
  secondsLeft: number;
  dataQuality: "high" | "medium" | "low" | "none";
  quoteDecimals: number;
  status: string;
}

interface TemporalChartProps {
  asset: string;
  horizons: HorizonPoint[];
  state: string;
  selectedHorizon: number | null;
  forecastProjections?: Array<{
    offsetMinutes: number;
    projectedProbability: number | null;
    upperBound: number;
    lowerBound: number;
  }>;
}

/* ═══════════════════════════════════════════════════════ */
/* Horizon → pseudo-time mapping                          */
/* ═══════════════════════════════════════════════════════ */

const HORIZON_ORDER = [5, 15, 30, 60, 240, 1440, 10080];

function horizonToTime(minutes: number): Time {
  const idx = HORIZON_ORDER.indexOf(minutes);
  return ((idx >= 0 ? idx : HORIZON_ORDER.length) + 1) as Time;
}

function timeToHorizonLabel(t: Time, sorted: HorizonPoint[]): string {
  const idx = (t as number) - 1;
  if (idx >= 0 && idx < sorted.length) {
    return formatHorizon(sorted[idx].horizonMinutes);
  }
  return String(t);
}

/* ═══════════════════════════════════════════════════════ */
/* Component                                              */
/* ═══════════════════════════════════════════════════════ */

export function TemporalChart({
  asset,
  horizons,
  state,
  selectedHorizon,
  forecastProjections,
}: TemporalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const areaRef = useRef<ISeriesApi<"Area"> | null>(null);
  const forecastLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  const color = useMemo(() => {
    if (state.includes("bullish")) return "#22c55e";
    if (state.includes("bearish")) return "#ef4444";
    if (state === "reversal-warning") return "#eab308";
    if (state === "cross-horizon-conflict") return "#f97316";
    return "#9ca3af";
  }, [state]);

  const sorted = useMemo(
    () =>
      [...horizons]
        .filter((h) => h.midProbability !== null)
        .sort((a, b) => a.horizonMinutes - b.horizonMinutes),
    [horizons]
  );

  /* ── Create chart ──────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || sorted.length < 2) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "var(--font-data)",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "#1e293b", style: 1 },
        horzLines: { color: "#1e293b", style: 1 },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#475569", width: 1, style: 2, labelBackgroundColor: "#18181b" },
        horzLine: { color: "#475569", width: 1, style: 2, labelBackgroundColor: "#18181b" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    /* ── Observed line series ───────────────────── */
    const lineSeries = chart.addSeries(LineSeries, {
      color,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBackgroundColor: color,
      crosshairMarkerBorderColor: "#0f172a",
      crosshairMarkerBorderWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    lineRef.current = lineSeries;

    /* ── Forecast area (uncertainty band) ──────── */
    const areaSeries = chart.addSeries(AreaSeries, {
      topColor: `${color}15`,
      bottomColor: `${color}03`,
      lineColor: "transparent",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    areaRef.current = areaSeries;

    /* ── Forecast line (dashed projected path) ─── */
    const forecastLine = chart.addSeries(LineSeries, {
      color: `${color}60`,
      lineWidth: 2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    forecastLineRef.current = forecastLine;

    /* ── Resize observer ─────────────────────────── */
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (markersRef.current) {
        markersRef.current.detach();
        markersRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
      areaRef.current = null;
      forecastLineRef.current = null;
    };
  }, [sorted.length, color]);

  /* ── Update data ──────────────────────────────── */
  useEffect(() => {
    const lineSeries = lineRef.current;
    const areaSeries = areaRef.current;
    const forecastLine = forecastLineRef.current;
    const chart = chartRef.current;
    if (!lineSeries || !chart) return;

    /* Observed data */
    const lineData = sorted.map((h) => ({
      time: horizonToTime(h.horizonMinutes),
      value: h.midProbability as number,
    }));
    lineSeries.setData(lineData);

    /* Forecast projections */
    if (forecastProjections && forecastProjections.length > 1 && areaSeries && forecastLine) {
      const validForecasts = forecastProjections.filter(
        (p) => p.projectedProbability !== null
      );
      if (validForecasts.length > 1) {
        const lastObservedTime = horizonToTime(sorted[sorted.length - 1]?.horizonMinutes ?? 60);
        const baseTime = lastObservedTime as number;

        /* Area data: upper bound */
        const areaUpper = validForecasts.map((p, i) => ({
          time: (baseTime + 1 + i) as Time,
          value: p.upperBound,
        }));

        /* Area data: lower bound (reversed for fill) */
        const areaLower = validForecasts
          .map((p, i) => ({
            time: (baseTime + 1 + i) as Time,
            value: p.lowerBound,
          }))
          .reverse();

        /* Merge upper + lower for area fill */
        areaSeries.setData([...areaUpper, ...areaLower] as Parameters<typeof areaSeries.setData>[0]);

        /* Forecast line */
        forecastLine.setData(
          validForecasts.map((p, i) => ({
            time: (baseTime + 1 + i) as Time,
            value: p.projectedProbability as number,
          }))
        );

        /* Time scale: show horizon labels for observed, "Now +Xm" for forecast */
        chart.applyOptions({
          timeScale: {
            timeVisible: false,
            tickMarkFormatter: (time: Time) => {
              const idx = (time as number) - 1;
              if (idx >= 0 && idx < sorted.length) {
                return formatHorizon(sorted[idx].horizonMinutes);
              }
              const forecastIdx = (time as number) - baseTime - 1;
              if (forecastIdx >= 0 && forecastIdx < validForecasts.length) {
                return `+${validForecasts[forecastIdx].offsetMinutes}m`;
              }
              return String(time);
            },
          },
        });
      } else {
        areaSeries.setData([]);
        forecastLine.setData([]);
      }
    } else {
      if (areaSeries) areaSeries.setData([]);
      if (forecastLine) forecastLine.setData([]);
    }

    /* Fit content */
    chart.timeScale().fitContent();
  }, [sorted, forecastProjections, color]);

  /* ── Selected horizon highlight ────────────────── */
  useEffect(() => {
    const lineSeries = lineRef.current;
    if (!lineSeries || sorted.length < 2) return;

    if (selectedHorizon !== null) {
      const idx = sorted.findIndex((h) => h.horizonMinutes === selectedHorizon);
      if (idx >= 0) {
        const time = horizonToTime(sorted[idx].horizonMinutes);
        if (markersRef.current) {
          markersRef.current.detach();
        }
        markersRef.current = createSeriesMarkers(lineSeries, [
          {
            time,
            position: "aboveBar",
            color,
            shape: "circle",
            size: 6,
          },
        ]);
      } else {
        if (markersRef.current) {
          markersRef.current.detach();
          markersRef.current = null;
        }
      }
    } else {
      if (markersRef.current) {
        markersRef.current.detach();
        markersRef.current = null;
      }
    }
  }, [selectedHorizon, sorted, color]);

  /* ── 50% price line (neutral reference) ────────── */
  useEffect(() => {
    const lineSeries = lineRef.current;
    if (!lineSeries) return;

    lineSeries.createPriceLine({
      price: 0.5,
      color: "#475569",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "NEUTRAL",
    });
  }, []);

  /* ── Single horizon: fallback text ─────────────── */
  if (sorted.length === 1) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 32,
            fontWeight: 700,
            color: probColor(sorted[0].midProbability as number),
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          {pctStr(sorted[0].midProbability as number, 1)}%
        </div>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginBottom: 16,
          }}
        >
          {formatHorizon(sorted[0].horizonMinutes)} horizon
        </div>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            color: "#64748b",
            padding: "6px 12px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            display: "inline-block",
          }}
        >
          SINGLE HORIZON — multi-horizon trajectory requires 2+ data points
        </div>
      </div>
    );
  }

  /* ── No data ──────────────────────────────────── */
  if (sorted.length < 2) {
    return (
      <p className="text-center py-8" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
        No horizon data available for this asset.
      </p>
    );
  }

  /* ── Chart + Legend ────────────────────────────── */
  return (
    <div style={{ position: "relative" }}>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 8,
          fontFamily: "var(--font-data)",
          fontSize: 9,
          color: "#64748b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 2, background: color, display: "inline-block", borderRadius: 1 }} />
          Observed
        </div>
        {forecastProjections && forecastProjections.length > 1 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 12,
                  height: 2,
                  background: `${color}60`,
                  display: "inline-block",
                  borderRadius: 1,
                  borderTop: `1.5px dashed ${color}60`,
                }}
              />
              Scenario
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 12,
                  height: 6,
                  background: `${color}15`,
                  display: "inline-block",
                  borderRadius: 1,
                }}
              />
              Uncertainty
            </div>
          </>
        )}
      </div>

      {/* Chart container */}
      <div ref={containerRef} style={{ width: "100%", height: 300 }} />
    </div>
  );
}
