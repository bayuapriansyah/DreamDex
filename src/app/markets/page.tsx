import { MarketList } from "@/components/markets/MarketList";

export default function MarketsPage() {
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 28px 96px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div className="flex items-center gap-3">
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "2.4rem",
            letterSpacing: "-0.02em",
            color: "var(--tape)",
            margin: 0,
          }}>Markets</h1>
          <div className="live-dot" />
        </div>
        <span style={{
          fontSize: "0.62rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--muted-foreground)",
          fontFamily: "var(--font-display)",
        }}>Live DreamDEX Event Contracts</span>
      </div>
      <MarketList />
    </div>
  );
}
