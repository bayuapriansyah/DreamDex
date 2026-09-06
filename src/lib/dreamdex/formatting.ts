export function stateColor(state: string): string {
  if (state.includes("bullish")) return "var(--accent-copper)";
  if (state.includes("bearish")) return "var(--accent-steel)";
  if (state === "reversal-warning") return "var(--accent-warn)";
  if (state === "cross-horizon-conflict") return "var(--accent-ember)";
  return "var(--muted-foreground)";
}

export function probColor(p: number | null): string {
  if (p === null) return "var(--muted-foreground)";
  if (p > 0.6) return "var(--accent-copper)";
  if (p < 0.4) return "var(--accent-steel)";
  return "var(--chalk)";
}

export function probBarBg(p: number | null): string {
  if (p === null) return "rgba(255,255,255,0.08)";
  if (p > 0.6) return "var(--accent-copper)";
  if (p < 0.4) return "var(--accent-steel)";
  return "var(--muted-foreground)";
}

export function formatHorizon(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(0)}h`;
  return `${(mins / 1440).toFixed(0)}d`;
}

/** Format forecast offset minutes (always shows Xm for consistency). */
export function formatForecastOffset(mins: number): string {
  return `${mins}m`;
}

export function formatProb(p: number | null): string {
  if (p === null) return "—";
  const pct = Math.round(p * 1000) / 10;
  return `${pct.toFixed(1)}%`;
}

/** Convert probability (0-1) to percentage number with proper rounding.
 *  Use inside template literals: `${pctNum(v, 1)}%` */
export function pctNum(p: number, decimals = 1): number {
  const multiplier = Math.pow(10, decimals + 2);
  return Math.round(p * multiplier) / Math.pow(10, decimals);
}

/** Convert probability (0-1) to percentage string with proper rounding (no % sign).
 *  Use where you need just the number: `${pctStr(v, 1)}%` */
export function pctStr(p: number, decimals = 1): string {
  return pctNum(p, decimals).toFixed(decimals);
}

/** Convert a raw percentage-point delta to properly rounded pp string. */
export function ppStr(delta: number, decimals = 1): string {
  const v = pctNum(delta, decimals);
  return `${v > 0 ? "+" : ""}${v.toFixed(decimals)}pp`;
}

export function formatVelocity(v: number): string {
  return `${v > 0 ? "+" : ""}${pctStr(v, 2)}/hr`;
}

export function safePct(p: number | null | undefined, decimals = 1): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  const multiplier = Math.pow(10, decimals + 2);
  const pct = Math.round(p * multiplier) / Math.pow(10, decimals);
  return `${pct.toFixed(decimals)}%`;
}

export function safeNum(p: number | null | undefined, decimals = 2): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return p.toFixed(decimals);
}

/** Format probability as percentage with proper rounding. Alias for formatProb. */
export const formatPct = formatProb;

/** Format a percentage-point difference. */
export function formatPP(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 1000) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}pp`;
}

export function statusBadge(status: string): { color: string; bg: string } {
  if (status === "active") return { color: "var(--accent-copper)", bg: "rgba(245,158,11,0.12)" };
  if (status === "weakening") return { color: "var(--accent-warn)", bg: "rgba(239,68,68,0.12)" };
  return { color: "var(--accent-warn)", bg: "rgba(239,68,68,0.16)" };
}
