"use client";

import { useEffect, useState, useRef } from "react";
import { formatProb } from "@/lib/dreamdex/formatting";

interface OBLevel {
  price: number | null;
  size: number | null;
}

interface OrderbookData {
  ok: boolean;
  bids: OBLevel[];
  asks: OBLevel[];
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spread: number | null;
  timestamp?: string;
  error?: string;
}

function fmtSize(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toFixed(2);
}

export function OrderbookPanel({ pool, symbol }: { pool?: string; symbol?: string }) {
  const [book, setBook] = useState<OrderbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      if (!pool && !symbol) return;
      setLoading(true);
      try {
        const q = pool ? `pool=${encodeURIComponent(pool)}` : `symbol=${encodeURIComponent(symbol!)}`;
        const res = await fetch(`/api/dreamdex/orderbook?${q}`);
        const data = await res.json();
        if (!fetchedRef.current) {
          setBook(data.ok ? data : null);
          if (data.timestamp) setLastUpdate(data.timestamp);
        }
      } catch {
        if (!fetchedRef.current) setBook(null);
      } finally {
        if (!fetchedRef.current) setLoading(false);
      }
    }
    void load();
    const t = setInterval(load, 10000);
    return () => { fetchedRef.current = true; clearInterval(t); };
  }, [pool, symbol]);

  if (loading && !book) {
    return (
      <div style={{ padding: "12px 14px" }}>
        <div className="skeleton" style={{ height: 12, width: "40%", borderRadius: 4, marginBottom: 8 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 14, borderRadius: 3, marginBottom: 4 }} />
        ))}
      </div>
    );
  }

  if (!book || !book.ok) {
    return (
      <div style={{ padding: "16px 14px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 4 }}>ORDERBOOK UNAVAILABLE</div>
        <div style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--text-tertiary)" }}>Data could not be retrieved from DreamDEX</div>
      </div>
    );
  }

  const asks = [...(book.asks || [])].reverse().slice(0, 6);
  const bids = (book.bids || []).slice(0, 6);
  const maxSize = Math.max(
    ...asks.map((l) => l.size ?? 0),
    ...bids.map((l) => l.size ?? 0),
    1
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Orderbook</span>
        {lastUpdate && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9, color: "var(--text-tertiary)" }}>
            {(() => {
              const diff = Date.now() - new Date(lastUpdate).getTime();
              const sec = Math.floor(diff / 1000);
              if (sec < 5) return "just now";
              if (sec < 60) return `${sec}s ago`;
              return `${Math.floor(sec / 60)}m ago`;
            })()}
          </span>
        )}
      </div>

      <div style={{ padding: "8px 14px" }}>
        {/* Column Headers */}
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Price</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Size</span>
        </div>

        {/* SELL (Asks) */}
        <div style={{ marginBottom: 4 }}>
          {asks.map((level, i) => {
            const pct = level.size != null ? (level.size / maxSize) * 100 : 0;
            return (
              <div key={`ask-${i}`} className="relative flex items-center justify-between" style={{ height: 20, borderRadius: 3 }}>
                <div className="absolute inset-0 rounded" style={{ background: "rgba(239,68,68,0.06)", width: `${pct}%` }} />
                <span className="relative z-10" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--accent-warn)" }}>
                  {level.price != null ? formatProb(level.price) : "—"}
                </span>
                <span className="relative z-10" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-secondary)" }}>
                  {fmtSize(level.size)}
                </span>
              </div>
            );
          })}
        </div>

        {/* MID */}
        <div className="flex items-center justify-between" style={{ padding: "5px 0", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", margin: "4px 0" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 9, letterSpacing: "0.08em", color: "var(--text-tertiary)" }}>MID</span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            {book.mid != null ? formatProb(book.mid) : "—"}
          </span>
        </div>

        {/* BUY (Bids) */}
        <div>
          {bids.map((level, i) => {
            const pct = level.size != null ? (level.size / maxSize) * 100 : 0;
            return (
              <div key={`bid-${i}`} className="relative flex items-center justify-between" style={{ height: 20, borderRadius: 3 }}>
                <div className="absolute inset-0 rounded" style={{ background: "rgba(34,197,94,0.06)", width: `${pct}%` }} />
                <span className="relative z-10" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--accent-success)" }}>
                  {level.price != null ? formatProb(level.price) : "—"}
                </span>
                <span className="relative z-10" style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--text-secondary)" }}>
                  {fmtSize(level.size)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Spread */}
        {book.spread != null && (
          <div className="flex items-center justify-between" style={{ marginTop: 8, padding: "4px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 4 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 9, color: "var(--text-tertiary)" }}>Spread</span>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>{formatProb(book.spread)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
