# Horizon — Demo Script

**Project:** Horizon — Temporal Intelligence for Event Contracts
**Hackathon:** Somnia × DreamDEX Event Contracts Hackathon
**Duration:** ~3 minutes
**Language:** English

---

## Pre-Demo Checklist

- [ ] Wallet connected (MetaMask on Somnia Shannon testnet)
- [ ] Dev server running or Vercel production loaded
- [ ] `/markets` page loads with BTC data
- [ ] `/analyze/BTC` shows multi-horizon trajectory
- [ ] Browser zoom at 100%, font size default

---

## Scene 1 — Opening (0:00 – 0:20)

**Screen:** Landing page `/` with particle animation and "HORIZON" branding.

**Script:**

> "DreamDEX gives traders event probabilities — will BTC be up or down in the next hour? But here's the problem: those probabilities are isolated. A 70% on the 5-minute and a 53% on the 4-hour — what does that *mean* together?
>
> **Horizon** is a temporal intelligence layer that turns those isolated probabilities into a *trajectory of market conviction* across time."

**Action:** Click **Markets** in the navbar.

---

## Scene 2 — Market Explorer (0:20 – 0:50)

**Screen:** `/markets` — BTC card with live probability bars, trajectory state, confidence, reversal risk.

**Script:**

> "This is the Market Explorer. For BTC, we see multiple event contract horizons — 5 minutes, 1 hour, 4 hours — all updating in real time.
>
> Each card shows not just the probability, but the *temporal trajectory* — is conviction accelerating, decaying, or reversing? And a confidence score based on data quality and cross-horizon consistency.
>
> Let's dig deeper into BTC."

**Action:** Click **BTC** or **Analyze** to go to `/analyze/BTC`.

---

## Scene 3 — Temporal Analysis (0:50 – 1:40)

**Screen:** `/analyze/BTC` — Event Context card, TemporalChart (D3 line chart), Market Narrative, Temporal Signal, Evidence, Why, Invalidation.

**Script:**

> "This is the core of Horizon. At the top: the **Event Context** — we see YES and NO prices across every active horizon, with real orderbook data.
>
> Below that: the **Temporal Trajectory Chart**. This line shows how market conviction *evolves* from short to long horizons. Right now we see [describe what you see — e.g. 'conviction decaying: 55% at 5 minutes dropping to 48% at 4 hours'].
>
> **Market State** tells us the regime: [e.g. 'Bearish Decay']. **Velocity** shows conviction is changing at minus 2.58 percent per hour. **Persistence** is 100% — the bearish direction is consistent across all horizons.
>
> The **Evidence** section explains *why* the trajectory is classified this way — what the data supports, and what would invalidate the thesis."

**Action:** Scroll down to Strategy Composer.

---

## Scene 4 — Strategy Composer + Trade Execution (1:40 – 2:20)

**Screen:** `/analyze/BTC` (lower section) — Strategy Composer with Conservative/Balanced/Aggressive tabs, Trade Preview, Execute button.

**Script:**

> "Now the actionable part. The **Strategy Composer** generates three strategies based on the current temporal analysis.
>
> **Conservative** — smaller size, tighter risk. **Balanced** — standard approach. **Aggressive** — larger position when conviction is strong.
>
> I'll select Balanced. It suggests: [e.g. 'Direction DOWN, Entry at current price, Size 1 contract']. The thesis says: [read the temporal thesis line].
>
> Clicking **Execute** sends a real trade to DreamDEX on Somnia Shannon testnet."

**Action:** Click **Execute Trade**. Wait for the progress indicators: validating → preflight passed → simulating → token approved → broadcasting → **FILLED**.

**Script (after fill):**

> "Trade filled. There's the transaction hash — you can verify it on Somnia Shannon explorer. Real order, real on-chain execution."

**Action:** Optionally click the TX hash to show the explorer.

---

## Scene 5 — Positions + Thesis Tracker (2:20 – 2:50)

**Screen:** `/portfolio` — Open Positions, Active Theses, Redeemable.

**Script:**

> "Over in Portfolio, our new position appears as **Open** — tracked on-chain.
>
> The **Thesis Tracker** stores the original rationale: when we entered, what the market state was, the confidence and reversal risk at entry. Now it compares that snapshot to live data — showing whether our thesis is strengthening, weakening, or unchanged.
>
> This is the feedback loop: not just *what* you traded, but *why* — and whether the market still agrees."

---

## Scene 6 — Closing (2:50 – 3:00)

**Screen:** Any page — preferably landing or a clean view of the analyze page.

**Script:**

> "Horizon transforms isolated event probabilities into temporal intelligence. We don't only ask *Up or Down?* — we ask **how does conviction evolve across time?**
>
> DreamDEX provides the event probability. **Horizon provides the trajectory of conviction.**"

---

## Fallback Lines

If something fails during live demo, use these:

| Issue | Fallback |
|-------|----------|
| Trade fails (InsufficientBalance) | "The trade flow works end-to-end — on this testnet, the server wallet needs funded tUSDC. The key point: real on-chain execution, real TX hash." |
| Market data slow to load | "The indexer sometimes lags a few seconds — in production this would be a WebSocket subscription for instant updates." |
| Chart doesn't render | "The temporal trajectory chart shows probability across horizons — let me show the data here instead." (point to the probability numbers) |
| Wallet not connecting | "On testnet, the server executor handles signing — in production, the user's own wallet signs via MetaMask." |

---

## Key Phrases to Remember

1. **"Temporal intelligence"** — the product category
2. **"Trajectory of conviction"** — the core concept
3. **"We don't only ask Up or Down — we ask HOW conviction evolves"** — the differentiation
4. **"Real DreamDEX, real testnet, real TX hash"** — credibility
5. **"Decision support, not guaranteed prediction"** — responsible framing

---

## After Demo

- Answer judge questions
- Point to repository: `https://github.com/bayuapriansyah/DreamDex`
- Point to live app: `https://horizon-dex.vercel.app`
- Mention: 198 tests, TypeScript clean, production build successful
