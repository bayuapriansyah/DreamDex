"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

interface HorizonPoint {
  horizonMinutes: number;
  midProbability: number;
  bestBid: number | null;
  bestAsk: number | null;
  volume: number;
  dataQuality: string;
}

interface TemporalTrajectoryChartProps {
  horizons: HorizonPoint[];
  state: string;
  width?: number;
  height?: number;
}

function stateColor(state: string): string {
  if (state.includes("bullish")) return "#22c55e";
  if (state.includes("bearish")) return "#ef4444";
  if (state === "reversal-warning") return "#eab308";
  if (state === "cross-horizon-conflict") return "#f97316";
  return "#9ca3af";
}

function stateGlowColor(state: string): string {
  if (state.includes("bullish")) return "rgba(34,197,94,0.15)";
  if (state.includes("bearish")) return "rgba(239,68,68,0.15)";
  if (state === "reversal-warning") return "rgba(234,179,8,0.15)";
  if (state === "cross-horizon-conflict") return "rgba(249,115,22,0.15)";
  return "rgba(156,163,175,0.1)";
}

export function TemporalTrajectoryChart({
  horizons,
  state,
  width = 560,
  height = 280,
}: TemporalTrajectoryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || horizons.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 24, right: 32, bottom: 40, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const sorted = [...horizons].sort(
      (a, b) => a.horizonMinutes - b.horizonMinutes
    );

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(sorted, (d) => d.horizonMinutes) as [number, number])
      .range([0, innerW]);

    const yExtent = d3.extent(sorted, (d) => d.midProbability) as [
      number,
      number,
    ];
    const yPad = (yExtent[1] - yExtent[0]) * 0.15 || 0.05;
    const yScale = d3
      .scaleLinear()
      .domain([
        Math.max(yExtent[0] - yPad, 0),
        Math.min(yExtent[1] + yPad, 1),
      ])
      .range([innerH, 0]);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const color = stateColor(state);
    const glowColor = stateGlowColor(state);

    // Grid lines
    const yTicks = yScale.ticks(5);
    g.selectAll(".grid-line")
      .data(yTicks)
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "#374151")
      .attr("stroke-dasharray", "3,3")
      .attr("stroke-opacity", 0.4);

    // 50% reference line
    if (yScale.domain()[0] < 0.5 && yScale.domain()[1] > 0.5) {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", yScale(0.5))
        .attr("y2", yScale(0.5))
        .attr("stroke", "#6b7280")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "6,4")
        .attr("opacity", 0.5);

      g.append("text")
        .attr("x", innerW + 4)
        .attr("y", yScale(0.5))
        .attr("dy", "0.35em")
        .attr("fill", "#6b7280")
        .attr("font-size", "10px")
        .text("50%");
    }

    // Area gradient
    const defs = svg.append("defs");
    const gradient = defs
      .append("linearGradient")
      .attr("id", `areaGrad-${state}`)
      .attr("x1", "0")
      .attr("y1", "0")
      .attr("x2", "0")
      .attr("y2", "1");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.25);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.02);

    // Area
    const area = d3
      .area<HorizonPoint>()
      .x((d) => xScale(d.horizonMinutes))
      .y0(innerH)
      .y1((d) => yScale(d.midProbability))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(sorted)
      .attr("d", area)
      .attr("fill", `url(#areaGrad-${state})`);

    // Line
    const line = d3
      .line<HorizonPoint>()
      .x((d) => xScale(d.horizonMinutes))
      .y((d) => yScale(d.midProbability))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(sorted)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 2.5)
      .attr("filter", `drop-shadow(0 0 4px ${glowColor})`);

    // Data points with bid/ask error bars
    sorted.forEach((d) => {
      const cx = xScale(d.horizonMinutes);
      const cy = yScale(d.midProbability);

      // Error bar (bid-ask spread)
      if (d.bestBid !== null && d.bestAsk !== null) {
        const yBid = yScale(d.bestBid);
        const yAsk = yScale(d.bestAsk);
        g.append("line")
          .attr("x1", cx)
          .attr("x2", cx)
          .attr("y1", yBid)
          .attr("y2", yAsk)
          .attr("stroke", color)
          .attr("stroke-width", 1)
          .attr("opacity", 0.4);
        g.append("circle")
          .attr("cx", cx)
          .attr("cy", yBid)
          .attr("r", 2)
          .attr("fill", color)
          .attr("opacity", 0.4);
        g.append("circle")
          .attr("cx", cx)
          .attr("cy", yAsk)
          .attr("r", 2)
          .attr("fill", color)
          .attr("opacity", 0.4);
      }

      // Main dot
      g.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", 5)
        .attr("fill", color)
        .attr("stroke", "#0f172a")
        .attr("stroke-width", 2);

      // Probability label
      g.append("text")
        .attr("x", cx)
        .attr("y", cy - 12)
        .attr("text-anchor", "middle")
        .attr("fill", color)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("font-family", "ui-monospace, monospace")
        .text(`${(d.midProbability * 100).toFixed(1)}%`);
    });

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(sorted.length)
          .tickFormat((d) => `${d}m`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "#374151")
          .attr("stroke-opacity", 0.4)
      )
      .call((g) =>
        g.selectAll(".tick text").attr("fill", "#9ca3af").attr("font-size", "11px")
      );

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => `${(d as number) * 100}%`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .attr("stroke", "#374151")
          .attr("stroke-opacity", 0.4)
      )
      .call((g) =>
        g.selectAll(".tick text").attr("fill", "#9ca3af").attr("font-size", "11px")
      );
  }, [horizons, state, width, height]);

  if (horizons.length < 2) {
    return (
      <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
        Insufficient horizon data for trajectory chart
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full h-auto"
      viewBox={`0 0 ${width} ${height}`}
    />
  );
}
