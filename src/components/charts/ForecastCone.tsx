"use client";

import { useMemo } from "react";
import { stateColor, probColor, formatForecastOffset, pctStr } from "@/lib/dreamdex/formatting";

interface ForecastPoint {
  offsetMinutes: number;
  projectedProbability: number | null;
  upperBound: number;
  lowerBound: number;
  confidence: string;
}

interface ForecastConeProps {
  projections: ForecastPoint[];
  currentProbability: number | null;
  state: string;
  width?: number;
  height?: number;
}

export function ForecastCone({
  projections,
  currentProbability,
  state,
  width = 680,
  height = 180,
}: ForecastConeProps) {
  const valid = useMemo(
    () => projections.filter((p) => p.projectedProbability !== null),
    [projections]
  );

  if (valid.length < 2 || currentProbability === null) {
    return (
      <div
        className="flex items-center justify-center text-[10px] font-mono"
        style={{ width, height, color: "var(--text-secondary)" }}
      >
        Insufficient forecast data
      </div>
    );
  }

  const pad = { top: 24, bottom: 32, left: 48, right: 16 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  // Build data points: [current, ...projections]
  const points = [
    { offset: 0, prob: currentProbability, upper: currentProbability, lower: currentProbability },
    ...valid.map((p) => ({
      offset: p.offsetMinutes,
      prob: p.projectedProbability!,
      upper: Math.min(p.upperBound, 1),
      lower: Math.max(p.lowerBound, 0),
    })),
  ];

  const maxOffset = points[points.length - 1].offset;
  const allProbs = points.flatMap((p) => [p.prob, p.upper, p.lower]);
  const minP = Math.max(0, Math.min(...allProbs) - 0.05);
  const maxP = Math.min(1, Math.max(...allProbs) + 0.05);

  function x(offset: number) {
    return pad.left + (offset / maxOffset) * cw;
  }
  function y(prob: number) {
    return pad.top + ((maxP - prob) / (maxP - minP)) * ch;
  }

  // Build SVG path strings
  const centerPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.offset).toFixed(1)},${y(p.prob).toFixed(1)}`).join(" ");

  // Upper cone path (center line + upper bound, closed)
  const upperPath =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.offset).toFixed(1)},${y(p.upper).toFixed(1)}`).join(" ") +
    " " +
    [...points].reverse().map((p, i) => `${i === 0 ? "L" : "L"}${x(p.offset).toFixed(1)},${y(p.prob).toFixed(1)}`).join(" ") +
    " Z";

  // Lower cone path (center line + lower bound, closed)
  const lowerPath =
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.offset).toFixed(1)},${y(p.prob).toFixed(1)}`).join(" ") +
    " " +
    [...points].reverse().map((p, i) => `${i === 0 ? "L" : "L"}${x(p.offset).toFixed(1)},${y(p.lower).toFixed(1)}`).join(" ") +
    " Z";

  const accentColor = stateColor(state);

  // Grid lines
  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const prob = minP + (i / gridSteps) * (maxP - minP);
    return { y: y(prob), label: `${pctStr(prob, 0)}%` };
  });

  // Time labels
  const timeLabels = points.filter((p) => p.offset > 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ maxWidth: "100%", height: "auto" }}
    >
      <defs>
        <linearGradient id="coneUpper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="coneLower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.05" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x={pad.left} y={pad.top} width={cw} height={ch} fill="rgba(255,255,255,0.02)" rx="2" />

      {/* Horizontal grid lines */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={pad.left} y1={g.y} x2={pad.left + cw} y2={g.y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" strokeDasharray="4,4" />
          <text x={pad.left - 6} y={g.y + 3} textAnchor="end" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-data)">
            {g.label}
          </text>
        </g>
      ))}

      {/* Time labels on x-axis */}
      {timeLabels.map((p) => (
        <text key={p.offset} x={x(p.offset)} y={height - 6} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="var(--font-data)">
          {formatForecastOffset(p.offset)}
        </text>
      ))}

      {/* Upper uncertainty cone */}
      <path d={upperPath} fill="url(#coneUpper)" />

      {/* Lower uncertainty cone */}
      <path d={lowerPath} fill="url(#coneLower)" />

      {/* Center projection line */}
      <path d={centerPath} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinejoin="round" />

      {/* Data points on center line */}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.offset)} cy={y(p.prob)} r="3" fill={accentColor} stroke="var(--surface-1)" strokeWidth="1.5" />
      ))}

      {/* Current probability marker */}
      <g>
        <line x1={x(0) - 4} y1={y(currentProbability)} x2={x(0) + 4} y2={y(currentProbability)} stroke={probColor(currentProbability)} strokeWidth="2" />
        <text x={x(0)} y={y(currentProbability) - 8} textAnchor="middle" fill={probColor(currentProbability)} fontSize="10" fontWeight="bold" fontFamily="var(--font-data)">
          {pctStr(currentProbability, 1)}%
        </text>
      </g>

      {/* End probability marker */}
      {points.length > 1 && (
        <g>
          <text
            x={x(points[points.length - 1].offset)}
            y={y(points[points.length - 1].prob) - 8}
            textAnchor="end"
            fill={probColor(points[points.length - 1].prob)}
            fontSize="10"
            fontWeight="bold"
            fontFamily="var(--font-data)"
          >
            {pctStr(points[points.length - 1].prob, 1)}%
          </text>
        </g>
      )}
    </svg>
  );
}
