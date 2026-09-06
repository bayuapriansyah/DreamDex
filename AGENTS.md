# AGENTS.md --- DreamDEX Temporal Hackathon

## 0. Project Identity

Project working name:

**DreamDex Temporal**

Core positioning:

> A temporal intelligence layer for DreamDEX Event Contracts.

Product thesis:

> DreamDEX gives traders event probabilities. We turn those
> probabilities into a map of how market conviction evolves over time.

Do **NOT** rename the project to "EventChain". That name is
intentionally not used because it belongs to a different concept/event.

This is a Somnia × DreamDEX Event Contracts Hackathon project.

Current goal: - Build a working testnet prototype first. - Then build
the temporal-intelligence product layer. - Prioritize a real, verifiable
DreamDEX integration over mock/demo-only functionality.

------------------------------------------------------------------------

# 1. Hackathon Context

Hackathon: - Somnia × DreamDEX Event Contracts Hackathon - Prize pool:
\$5,000 - Submission deadline: 2026-09-09 01:00 - Tags: DeFi, Event
Contracts, Prediction Markets, DreamDEX

Judging priorities: - Innovation: 20% - Technical Implementation: 25% -
UX: 20% - Business/Ecosystem Impact: 20% - Presentation/Demo: 15%

The prototype must be demonstrably working on testnet and should have: -
repository - working prototype - 2--3 minute demo - clear product
story - real DreamDEX integration

Official references: - DreamDEX Event Contracts docs:
https://docs.dreamdex.io/developers/event-contracts - DreamDEX Bot Kit:
https://github.com/somnia-chain/dreamdex-bot-kit - Hackathon starter:
https://github.com/IronicDeGawd/ec-dreamdex-hackathon-template

When implementing SDK functionality, verify the actual installed SDK/API
and official documentation. Never invent methods.

------------------------------------------------------------------------

# 2. Core Product Concept

The product is NOT another basic Up/Down trading UI.

DreamDEX Event Contracts expose probabilities for individual horizons.

Our differentiation is to aggregate multiple rolling horizons for the
same asset and interpret the evolution of market conviction.

Example:

-   5m: 70%
-   1h: 65%
-   4h: 53%

Interpretation: - Short-term bullish - Conviction decays with horizon -
The market is less confident about sustained upside
Another example:

- 5m: 55%
- 1h: 57%
- 4h: 83%

Interpretation:
- Bullish conviction accelerates at longer horizons
- Delayed bullish trajectory

The key insight:

> We do not only ask "Up or Down?" We ask "How does conviction evolve
> across time?"

------------------------------------------------------------------------

# 3. Temporal Intelligence Features

## P0 --- Core

Must work before advanced features.

1.  DreamDEX market discovery
2.  Real-time/live market data
3.  Real orderbook data
4.  Multi-horizon probability aggregation
5.  Temporal trajectory
6.  Market state
7.  Deterministic explanation of trajectory
8.  Trade preview
9.  Real testnet trade execution
10. Basic position/result visibility

## P1

After P0 is stable:

-   Probability velocity
-   Persistence
-   Conviction decay
-   Cross-horizon divergence
-   "What Changed"
-   Strategy Composer
    -   Conservative
    -   Balanced
    -   Aggressive
-   Position tracking
-   Better trading UX

## P2

Only if P0/P1 are stable and there is time:

-   Thesis Monitor
-   Market Replay
-   Scenario/future-branch view
-   "MAP THE NEXT HOUR"
-   State transition visualization:
    -   Neutral
    -   Expansion
    -   Trending
    -   Deceleration
    -   Reversal

## P3 --- Optional only

Do not sacrifice core functionality for: - social features -
leaderboard - notifications - advanced ML - multi-chain support

------------------------------------------------------------------------

# 4. Temporal Analytics Model

Use real market data.

Market-implied probability: - Prefer mid-price from best bid/ask when
both exist. - If only one side exists, use that value with reduced
confidence. - Last trade may be used with lower confidence if
appropriate. - Never fabricate missing probability.

Core metrics:

### Probability velocity

Δ probability / Δ time

Measures how quickly conviction changes.

### Persistence

Measures whether direction remains consistent across horizons.

### Conviction decay

Measures how much directional probability weakens as horizon increases.

### Cross-horizon divergence

Measures disagreement between short and long horizons.

### Underlying confirmation

If available, use: - spot price movement - volume - orderbook
imbalance - volatility

These should confirm or challenge the Event Contract trajectory, not
replace it.

Suggested trajectory score:

-   30% direction strength
-   25% momentum
-   20% persistence
-   15% cross-horizon consistency
-   10% liquidity

These are heuristic weights, NOT scientifically validated constants.
Keep them configurable and clearly treat them as product heuristics.

Confidence:

trajectory score × data quality

Reversal risk can use: - velocity - cross-horizon divergence -
volatility - weak underlying confirmation

Do not claim guaranteed prediction or profit.

------------------------------------------------------------------------

# 5. Trajectory Labels

Potential states/patterns:

-   Bullish acceleration
-   Bullish persistence
-   Bullish decay
-   Bearish acceleration
-   Bearish persistence
-   Bearish decay
-   Reversal warning
-   Cross-horizon conflict
-   Neutral / insufficient data

Avoid overly simplistic labels when data quality is poor.

If there are fewer than enough valid horizons, explicitly show:

> INSUFFICIENT DATA

Never invent a trajectory from missing data.

------------------------------------------------------------------------

# 6. UX / Product Flow

Target flow:

Landing → Connect Wallet → Market Explorer → Select Asset → Trajectory
Analysis → AI Explanation → Strategy → Trade Preview → Execute on
DreamDEX → Position Tracking → Thesis Monitor

Market Explorer should eventually show:

-   asset
-   shortest/longest probability
-   trajectory
-   confidence
-   reversal risk
-   data freshness

Trajectory page should eventually contain:

1.  Temporal probability chart
2.  Market State
3.  What Changed
4.  Why?
5.  Evidence
6.  Strategy Composer
7.  Trade Preview
8.  Execute

AI should explain deterministic analytics.

AI must NOT: - calculate raw market data - invent probabilities - invent
market state - guarantee profit - execute trades autonomously

If AI is unavailable, deterministic explanation must still work.

------------------------------------------------------------------------

# 7. Technical Stack

Current intended stack:

-   Next.js 16+
-   App Router
-   TypeScript
-   Tailwind CSS v4
-   shadcn/ui
-   DreamDEX/Somnia Markets SDK
-   wagmi v3
-   viem 2.x
-   TanStack Query v5
-   Lightweight Charts for market-style/underlying charts
-   D3.js for custom temporal probability trajectory visualization
-   Supabase Postgres
-   OpenRouter for optional AI explanation
-   Vercel deployment

Do not overengineer.

Use Lightweight Charts for trading-terminal-like visuals.

Use D3 only where custom temporal visualization is genuinely useful.

------------------------------------------------------------------------

# 8. Somnia Network

Target network:

**Somnia Shannon Testnet**

Chain ID:

`50312`

RPC:

`https://api.infra.testnet.somnia.network`

WebSocket:

`wss://api.infra.testnet.somnia.network/ws`

Indexer:

`https://dev.smk.somnia.host/v1/graphql`

Explorer:

`https://shannon-explorer.somnia.network`

Native testnet token:

`STT`

SDK chain should use:

`somniaShannon`

from:

`@somnia-chain/markets-sdk/chains`

Do not silently substitute another Somnia chain.

------------------------------------------------------------------------

# 9. DreamDEX SDK

Current SDK dependency should be verified against npm/official docs
before changing versions.

The audit previously identified: - starter: `^0.28.1` - newer SDK
observed: `0.29.0`

Do not blindly pin a version. Verify the installed/current compatible
version.

Known SDK concepts/methods that were verified during the project audit
include:

``` ts
exchange.client.listLiveBinaryMarkets({ limit: 50 })
exchange.client.getMarketOnchain(marketId)
exchange.fetchOrderBook(symbol, depth)
exchange.client.getOutcomeBalance(...)
exchange.trader.redeem(...)
```

Trade-related APIs must be verified against the installed SDK before
implementation.

Important: - HTTP API is spot-only and does not provide Event Contract
endpoints. - Event Contracts are on the on-chain CLOB. - Up and Down
share an order book. - Down price is related to Up probability. - Market
lifecycle: - Listed - Trading - Locked - Resolved / Voided

Indexer data can lag on-chain state by seconds.

Always gate critical state using on-chain data where appropriate.

------------------------------------------------------------------------

# 9.5 Canonical Data Model (Phase 1)

All data flowing through the system uses canonical types from
`src/lib/dreamdex/types.ts`.

## Core Types

| Type | Definition | Notes |
|---|---|---|
| `Probability` | `number` | 0..1, null = "data unavailable" |
| `RawPrice` | `string` | Raw SDK fixed-point |
| `HorizonMinutes` | `number` | 15, 30, 60, 240, 1440 |
| `TokenAmount` | `number` | Normalized by decimals |
| `QuoteVolume` | `number` | Normalized by quoteDecimals |
| `BasisPoints` | `number` | 1 bp = 0.01% |

## Canonical Normalization

All normalization goes through `src/lib/dreamdex/normalization.ts`:

- `normalizePrice(raw, decimals)` → Probability | null
- `normalizeLastPrice(raw, decimals)` → Probability | null
- `normalizeBookLevel(level, decimals)` → { price, size }
- `normalizeQuoteVolume(raw, decimals)` → QuoteVolume | null
- `midFromBidAsk(bid, ask)` → Probability | null
- `sortByHorizon(items)` → sorted copy

## Per-Market Decimals

CRITICAL: Each `MarketData` carries its own `quoteDecimals` from the
SDK's `BaseMarket.quoteDecimals`. Never use a global
`COLLATERAL_DECIMALS` for normalizing per-market data.

`COLLATERAL_DECIMALS = 6` in config.ts is FALLBACK ONLY.

## SDK Field Reference

Verified fields from `@somnia-chain/markets-sdk`:

``` ts
BaseMarket.quoteDecimals: number      // e.g. 6 for testnet tUSDC
BaseMarket.lastPrice: string | null   // raw fixed-point
BaseMarket.cumulativeQuoteVolume: string
BaseMarket.baseDecimals: number
BaseMarket.status: BinaryMarketStatus

BookLevel { price: bigint, quantity: bigint }
BinaryOrderBook { yesBids, yesAsks, noBids, noAsks }
```

## Data Flow

SDK raw → normalizePrice/normalizeBookLevel → canonical types →
temporal engine → trajectory → UI

## Temporal Intelligence Pipeline

``` text
Temporal Engine (computeTemporalTrajectory)
  ↓
Market Regime (classifyRegime)
  ↓
Trajectory (metrics + state classification)
  ↓
What Changed (generateWhatChanged)
  ↓
Evidence (generateEvidence)
  ↓
Decision Context (buildDecisionContext)
  ↓
MAP THE NEXT HOUR (mapNextHour — forecast.ts)
  ↓
Strategy Composer (composeStrategies)
  ↓
Trade Preview → Execute
```

### Pipeline Modules

| Module | File | Purpose |
|---|---|---|
| Temporal Engine | `temporal.ts` | Multi-horizon probability aggregation, metrics |
| Forecast | `forecast.ts` | MAP THE NEXT HOUR — heuristic projection |
| Decision Context | `decision.ts` | Unified pipeline output, regime, quality |
| Strategy | `strategy.ts` | Conservative/balanced/aggressive composition |
| AI Explanation | `ai.ts` | Optional OpenRouter explanation |

### Decision Context Output

The `DecisionContext` (from `decision.ts`) is the unified pipeline
output. It contains:

-   `trajectory` — full TemporalTrajectory
-   `regime` — MarketRegime (state, strength, durationHint)
-   `forecast` — HourForecast (7-point projection for next 60min)
-   `decisionQuality` — composite score + tier
-   `strategies` — 3 strategies (conservative/balanced/aggressive)
-   `recommendedStrategy` — best fit for current conditions
-   `pipelineSummary` — plain-language summary
-   `verdict` — one-line actionable verdict

### MAP THE NEXT HOUR

The forecast engine (`forecast.ts`) projects the current trajectory
forward using:

-   Velocity (rate of probability change)
-   Momentum (acceleration/deceleration)
-   Persistence (directional consistency)
-   Conviction decay (how conviction weakens over time)
-   Cross-horizon divergence (uncertainty)

Outputs 7 forecast points at 5, 10, 15, 20, 30, 45, 60 minutes.
Each point has projected probability, upper/lower bounds, and
confidence level.

Confidence shrinks with:
-   Lower data quality
-   Higher cross-horizon divergence
-   Longer forecast horizon
-   Reversal/cross-horizon-conflict states

------------------------------------------------------------------------

# 10. Current Milestone 1 Implementation

Milestone 1 code has already been created.

Important files:

``` text
src/lib/dreamdex/config.ts
src/lib/dreamdex/client.ts
src/lib/dreamdex/markets.ts
src/lib/dreamdex/orderbook.ts
src/lib/dreamdex/trade.ts
src/lib/wagmi/config.ts
src/components/providers/WagmiProvider.tsx
src/components/layout/Header.tsx
src/components/markets/MarketCard.tsx
src/components/markets/MarketList.tsx
src/app/api/dreamdex/markets/route.ts
src/app/api/dreamdex/orderbook/route.ts
src/app/api/dreamdex/trade/route.ts
src/app/page.tsx
src/app/markets/page.tsx
src/app/trade/page.tsx
src/app/positions/page.tsx
src/app/replay/page.tsx
src/app/analyze/[asset]/page.tsx
src/lib/utils.ts
```

Current pages:

``` text
/
 /markets
 /trade
 /positions
 /replay
 /analyze/[asset]
```

------------------------------------------------------------------------

# 11. Current Verification Status

CODE VERIFIED:

-   TypeScript: 0 errors
-   ESLint: 0 errors / 0 warnings
-   Production build: successful with webpack
-   Routes compile successfully
-   `somniaShannon` import verified
-   chain ID 50312 verified
-   HTTP/WS RPC verified
-   private key environment variable is server-side only
-   no private key found in HTML/JS/build output during audit

LIVE INTEGRATION VERIFIED:

The dev server and UI routes work.

However, actual DreamDEX live market/orderbook/trade integration was
BLOCKED at the last test because:

``` text
DREAMDEX_PRIVATE_KEY not set
```

Therefore the following are NOT yet live-verified:

-   real DreamDEX market discovery
-   real orderbook data
-   real testnet trade
-   transaction hash
-   transaction receipt/explorer verification
-   trade signing attribution

Wallet connection also requires browser/MetaMask testing.

Do NOT claim these are live verified until they are actually tested.

------------------------------------------------------------------------

# 12. Environment Variables

`.env.local` should contain:

``` env
DREAMDEX_PRIVATE_KEY=0x<PRIVATE_TESTNET_KEY>

SOMNIA_CHAIN_ID=50312
SOMNIA_WS_RPC_URL=wss://api.infra.testnet.somnia.network/ws
SOMNIA_INDEXER_URL=https://dev.smk.somnia.host/v1/graphql

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

OPENROUTER_API_KEY=
```

Never put private secrets under:

``` text
NEXT_PUBLIC_*
```

Never print or log:

``` text
DREAMDEX_PRIVATE_KEY
```

Never put the private key into: - source code - README - GitHub -
screenshots - API responses - browser bundles - client components

`.env.local` must not be committed.

------------------------------------------------------------------------

# 13. Wallet Architecture

Preferred architecture:

### Browser writes

Use: - wagmi - viem - connected user wallet - walletClient

If technically feasible, the user's browser wallet should sign their own
trade transaction.

### Server reads

The server-side DreamDEX SDK can be used for: - market discovery -
orderbook reads - on-chain market state - other safe read operations

### Server executor fallback

A server-side testnet private key is allowed ONLY as a clearly labeled
hackathon/demo fallback.

The UI and API must say something equivalent to:

> Demo/Testnet Executor --- transaction is not signed by your connected
> wallet.

Never say: - "MetaMask signed this" - "Your wallet signed this" - "User
signed transaction"

unless the connected wallet actually performed the signing.

------------------------------------------------------------------------

# 14. Security Rules

Absolute rules:

1.  Never expose private keys.
2.  Never log private keys.
3.  Never return private keys from APIs.
4.  Never place private keys in `NEXT_PUBLIC_*`.
5.  Never commit `.env.local`.
6.  Never fake blockchain transaction hashes.
7.  Never fake fills.
8.  Never claim a transaction was user-signed if server signed it.
9.  Never fabricate market data.
10. Never fabricate AI evidence.

For server-side demo execution: - use a dedicated testnet wallet - use
minimal test amounts - never use a valuable production wallet

------------------------------------------------------------------------

# 15. Trade Validation

Before executing a trade:

-   verify pool/market identifier is correct
-   verify market status is Trading
-   verify not finalized
-   verify expiry
-   verify valid side
-   verify probability range
-   verify positive quantity
-   verify liquidity/orderbook when using IOC
-   verify expected decimal/base-unit handling
-   use correct collateral decimals

Testnet tUSDC has been documented as:

`6 decimals`

Mainnet USDso may differ.

Never assume decimals across networks.

Trade result should include: - success/failure - tx hash when
available - order ID when available - fills when available - executor
attribution - useful error

------------------------------------------------------------------------

# 16. Important Next.js Rules

This is Next.js 16.

Remember:

-   `params` and `searchParams` can be async and must be awaited where
    required.
-   Use current Next.js 16 conventions.
-   Next.js 16 uses `proxy.ts` instead of the older middleware naming
    convention where applicable.
-   Do not rely on `next lint`; use the project's actual ESLint
    configuration/command.
-   Node.js must satisfy the current Next.js requirement.

For charts: - Lightweight Charts and D3 are client-side libraries. - Use
`"use client"` and dynamic/SSR-safe loading where needed.

------------------------------------------------------------------------

# 17. WebSocket / Realtime

DreamDEX WebSocket may timeout after inactivity.

If using a persistent WebSocket: - send a ping/heartbeat approximately
every 30 seconds - reconnect on disconnect - clean up timers/listeners
correctly

Do not assume a WebSocket connection remains alive forever.

For early MVP: - polling is acceptable if necessary - realtime WebSocket
should be added where it materially improves the product

------------------------------------------------------------------------

# 18. Database / Supabase

Supabase Postgres is the intended production/deployment database.

Do NOT use SQLite as the production database on Vercel.

Because wagmi wallet addresses are not automatically Supabase Auth
users:

`auth.uid()` does NOT automatically correspond to a connected wallet.

For MVP: - application-level wallet filtering can be used - avoid
overengineering authentication

For a more robust production version: - implement SIWE or equivalent
wallet authentication - connect authenticated wallet identity to
Supabase RLS

Do not pretend wallet connection alone is Supabase authentication.

------------------------------------------------------------------------

# 19. AI / OpenRouter

AI is optional and belongs after deterministic analytics are working.

Use OpenRouter if an API key/model is available.

Do not hardcode an assumed free model without checking current
availability.

AI prompt should receive structured deterministic data such as:

``` text
asset
horizons
probabilities
velocity
persistence
decay
divergence
confidence
market state
underlying confirmation
```

AI output should explain:

-   what changed
-   why the trajectory is classified that way
-   supporting evidence
-   uncertainty
-   possible invalidation conditions

AI should NOT: - generate raw market values - invent missing data -
promise outcomes - give guaranteed financial advice - automatically
trade

If OpenRouter is unavailable, deterministic templates must continue
working.

------------------------------------------------------------------------

# 20. Market Data Rules

Use actual DreamDEX data.

Probability source priority:

1.  best bid + best ask → mid
2.  one-sided book → one-sided price with lower confidence
3.  last trade only if necessary → low confidence
4.  missing data → null / insufficient data

Never turn missing data into fake 50%.

Market freshness should be visible where useful.

Indexer may lag. Use on-chain status for critical decisions.

------------------------------------------------------------------------

# 21. UI Direction

The UI should feel like a real market/trading terminal, not a generic
SaaS dashboard.

Desired characteristics: - compact market cards - probability
percentages - horizon timeline - trajectory visualization - orderbook
information - clear state/confidence - trade preview - transaction
status - responsive layout - strong visual hierarchy

Avoid: - excessive rounded cards everywhere - meaningless gradients -
fake metrics - decorative charts with no real data - excessive animation

Every chart should represent actual data or be explicitly labeled as
replay/simulation.

------------------------------------------------------------------------

# 22. Demo Story

Target 2--3 minute demo:

1.  Open landing page.
2.  Explain the problem:
    -   DreamDEX gives isolated Up/Down probabilities.
    -   Traders need to understand how conviction evolves across
        horizons.
3.  Open Market Explorer.
4.  Select BTC/ETH.
5.  Show multiple horizons.
6.  Show temporal trajectory.
7.  Show Market State.
8.  Show "What Changed".
9.  Show deterministic/AI explanation.
10. Select strategy.
11. Show Trade Preview.
12. Execute testnet trade.
13. Show TX hash / transaction confirmation.
14. Explain that the product transforms raw event probabilities into
    temporal intelligence.

Core pitch:

> Instead of asking only whether BTC will be up or down, DreamDex
> Temporal shows how the market's conviction evolves across time
> horizons.

------------------------------------------------------------------------

# 23. Current Immediate Task

Before Milestone 2:

### Complete live integration verification.

Required:

1.  `.env.local` contains a funded Shannon testnet wallet private key.
2.  Run dev server.
3.  Test market discovery.
4.  Test orderbook.
5.  Test `/markets`.
6.  Test MetaMask connection.
7.  Execute one small testnet trade.
8.  Verify transaction hash.
9.  Verify receipt/status on Somnia Shannon explorer.
10. Confirm signing attribution.
11. Confirm no secret leakage.
12. Re-run TypeScript.
13. Re-run ESLint.
14. Re-run production build.

Do not move to Milestone 2 until this is done.

------------------------------------------------------------------------

# 24. After Milestone 1: Milestone 2

Once live integration is verified:

Build the actual product differentiation.

Priority order:

1.  Temporal data model
2.  Multi-horizon trajectory calculation
3.  Probability velocity
4.  Persistence
5.  Conviction decay
6.  Cross-horizon divergence
7.  Confidence/data quality
8.  Market State
9.  Temporal trajectory visualization
10. What Changed
11. Evidence/explanation
12. Strategy Composer
13. Trade Preview connected to selected market
14. Position tracking

Only after these work: - OpenRouter explanation - Replay - Thesis
Monitor - advanced scenario features

------------------------------------------------------------------------

# 25. Development Method

Use milestone-based development, NOT rigid day-by-day development.

For every change:

``` text
Build
→ Run
→ Test
→ Verify
→ Fix
→ Re-test
→ Report
```

Do not mark a feature complete merely because TypeScript compiles.

Distinguish:

-   CODE VERIFIED
-   LIVE INTEGRATION VERIFIED
-   BLOCKED / NOT TESTED

Never fabricate test results.

------------------------------------------------------------------------

# 26. Agent Behavior Rules

When switching AI/coding models, the agent must continue from the
existing project state.

Before making major changes: - inspect current files - inspect
package.json - inspect existing implementation - inspect current SDK
version - inspect git diff if available - preserve working code

Do not rewrite working architecture without reason.

Do not restart the project from scratch.

Do not silently replace DreamDEX SDK APIs with invented wrappers.

Do not add unnecessary dependencies.

Do not implement P2/P3 features while P0 is broken.

When encountering an SDK mismatch: 1. inspect installed package/types 2.
inspect official docs 3. inspect starter/Bot Kit if useful 4. adjust
implementation 5. run typecheck 6. run build 7. run live test if
possible

When blocked: - report the exact blocker - say what is required - do not
fake success

------------------------------------------------------------------------

# 27. Git / Repository Hygiene

Never commit:

``` text
.env.local
private keys
API keys
wallet secrets
temporary logs
debug dumps
```

Recommended `.gitignore` entries should include:

``` text
.env*.local
*.log
node_modules/
.next/
```

Before committing: - `git status` - inspect diff - remove secrets - run
typecheck - run lint - run build

------------------------------------------------------------------------

# 28. Terminology

Use:

-   DreamDEX
-   Event Contracts
-   Up / Down
-   market-implied probability
-   temporal trajectory
-   market conviction
-   horizon
-   confidence
-   reversal risk
-   Market State
-   Temporal Intelligence

Avoid calling the product: - EventChain

Avoid claims such as: - guaranteed profit - guaranteed prediction -
risk-free trading - AI knows the future

This is a decision-support/trading-intelligence product, not a
guaranteed prediction engine.

------------------------------------------------------------------------

# 29. Success Definition

The project succeeds when a judge can see:

1.  Real DreamDEX Event Contracts.
2.  Real probabilities across horizons.
3.  A useful temporal interpretation that DreamDEX itself does not
    provide as the primary UX.
4.  Clear evidence for the interpretation.
5.  A professional trading-oriented interface.
6.  A working testnet transaction.
7.  A compelling explanation of why temporal intelligence is valuable.

The strongest product story is:

> DreamDEX provides the event probability. DreamDex Temporal provides
> the trajectory of conviction.
