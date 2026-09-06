"use client";

import { useEffect, useState, useCallback } from "react";

interface ActivityEvent {
  id: string;
  asset: string;
  type: string;
  title: string;
  subtitle: string;
  severity: "info" | "warning" | "significant";
  timestamp: number;
}

type ActivityFilter = "ALL" | "MARKET" | "SIGNAL" | "REGIME" | "RISK";

const FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: "ALL", label: "ALL" },
  { value: "MARKET", label: "MARKET" },
  { value: "SIGNAL", label: "SIGNAL" },
  { value: "REGIME", label: "REGIME" },
  { value: "RISK", label: "RISK" },
];

function matchesFilter(filter: ActivityFilter, event: ActivityEvent): boolean {
  if (filter === "ALL") return true;
  if (filter === "MARKET") return event.type === "probability-shift" || event.type === "data-quality-change" || event.type === "lifecycle-change";
  if (filter === "SIGNAL") return event.type === "confidence-change";
  if (filter === "REGIME") return event.type === "regime-change" || event.type === "divergence-change";
  if (filter === "RISK") return event.type === "reversal-risk-change";
  return true;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const SEVERITY_STYLES: Record<string, { border: string; dot: string }> = {
  significant: { border: "var(--accent)", dot: "var(--accent)" },
  warning: { border: "var(--accent-ember)", dot: "var(--accent-ember)" },
  info: { border: "var(--border)", dot: "var(--text-tertiary)" },
};

export function TemporalActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>("ALL");
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/dreamdex/activity", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
    const interval = setInterval(() => void fetchEvents(), 10000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const filtered = events.filter((e) => matchesFilter(filter, e));

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={filter === f.value ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            style={{ fontSize: 11, padding: "4px 12px", height: 28 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Events */}
      {loading && events.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div className="skeleton" style={{ height: 16, width: 200, margin: "0 auto" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Belum ada perubahan temporal yang berarti.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((event) => {
            const sev = SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.info;
            return (
              <div
                key={event.id}
                className="card animate-fade-up"
                style={{
                  padding: "14px 18px",
                  borderLeft: `3px solid ${sev.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: sev.dot,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-data)",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {event.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 2,
                      }}
                    >
                      {event.subtitle}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-data)",
                    color: "var(--text-tertiary)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {timeAgo(event.timestamp)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
