"use client";

import { useMemo } from "react";

interface FreshnessIndicatorProps {
  /** ISO timestamp of when data was last updated */
  updatedAt?: string;
  /** Optional explicit freshness label */
  freshness?: "live" | "recent" | "stale" | "unavailable";
  /** Show compact version */
  compact?: boolean;
}

const FRESHNESS_CONFIG = {
  live: { label: "LIVE", color: "var(--accent-success)", bg: "rgba(34, 197, 94, 0.1)" },
  recent: { label: "RECENT", color: "var(--accent)", bg: "rgba(245, 158, 11, 0.1)" },
  stale: { label: "STALE", color: "var(--accent-warn)", bg: "rgba(239, 68, 68, 0.1)" },
  unavailable: { label: "UNAVAILABLE", color: "var(--text-tertiary)", bg: "rgba(255, 255, 255, 0.04)" },
} as const;

function classifyByAge(updatedAt?: string): "live" | "recent" | "stale" | "unavailable" {
  if (!updatedAt) return "unavailable";
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs < 0 || ageMs > 300_000) return "unavailable"; // > 5 min
  if (ageMs > 60_000) return "stale";
  if (ageMs > 15_000) return "recent";
  return "live";
}

function timeDiffLabel(updatedAt?: string): string {
  if (!updatedAt) return "";
  const diff = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
  if (diff < 0) return "just now";
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function FreshnessIndicator({
  updatedAt,
  freshness: explicitFreshness,
  compact = false,
}: FreshnessIndicatorProps) {
  const freshness = explicitFreshness ?? classifyByAge(updatedAt);
  const config = FRESHNESS_CONFIG[freshness];
  const timeLabel = useMemo(() => timeDiffLabel(updatedAt), [updatedAt]);

  if (compact) {
    return (
      <span
        className="status-pill"
        style={{
          color: config.color,
          background: config.bg,
          fontSize: 10,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: config.color,
            display: "inline-block",
          }}
        />
        {config.label}
        {timeLabel && ` · ${timeLabel}`}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: "var(--radius-full)",
        background: config.bg,
        border: `1px solid ${config.color}20`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.color,
          boxShadow: freshness === "live" ? `0 0 6px ${config.color}80` : "none",
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--font-data)",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: config.color,
        }}
      >
        {config.label}
      </span>
      {timeLabel && (
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-data)",
            color: "var(--text-tertiary)",
          }}
        >
          {timeLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Network/Data/Execution status bar.
 * Shows three separate status indicators.
 */
interface SystemStatusProps {
  networkStatus?: "connected" | "degraded" | "disconnected";
  dataFreshness?: "live" | "recent" | "stale" | "unavailable";
  executionMode?: "live" | "demo";
}

export function SystemStatus({
  networkStatus = "connected",
  dataFreshness = "live",
  executionMode = "demo",
}: SystemStatusProps) {
  const networkConfig = {
    connected: { label: "Shannon", sub: "Connected", color: "var(--accent-success)" },
    degraded: { label: "Shannon", sub: "Degraded", color: "var(--accent)" },
    disconnected: { label: "Shannon", sub: "Disconnected", color: "var(--accent-warn)" },
  }[networkStatus];

  const dataConfig = FRESHNESS_CONFIG[dataFreshness];
  const execConfig = executionMode === "live"
    ? { label: "Execution", sub: "Live", color: "var(--accent-success)" }
    : { label: "Execution", sub: "Demo/Testnet", color: "var(--accent)" };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "8px 14px",
        background: "var(--surface-1)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
      }}
    >
      {[
        { key: "Network", label: networkConfig.label, sub: networkConfig.sub, color: networkConfig.color },
        { key: "Data", label: "Data", sub: dataConfig.label, color: dataConfig.color },
        { key: "Execution", label: execConfig.label, sub: execConfig.sub, color: execConfig.color },
      ].map((item) => (
        <div key={item.key} className="flex items-center gap-2">
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: item.color,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 9,
                fontFamily: "var(--font-data)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-data)",
                fontWeight: 500,
                color: item.color,
              }}
            >
              {item.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
