# SDK & Documentation Feedback — Somnia Markets SDK

> Feedback from building **Horizon** — a temporal intelligence layer for DreamDEX Event Contracts — during the Somnia × DreamDEX Event Contracts Hackathon.

---

## Overall Impression

The `@somnia-chain/markets-sdk` is a powerful, well-structured SDK. The unified exchange API (`SomniaMarkets`) provides a clean abstraction over binary Event Contracts, and the `setSigner()` pattern for browser wallets is well-designed. Building a full trading intelligence product on top of it was feasible in a hackathon timeframe, which speaks to the SDK's solid foundations.

---

## What Works Well

### Unified Exchange API
The `exchange.createOrder()`, `exchange.fetchOrderBook()`, `exchange.client.listLiveBinaryMarkets()` API is intuitive and consistent. The CCXT-inspired symbol resolution (`resolve()`) makes market lookup straightforward.

### Binary Market Support
The SDK correctly handles binary pool mechanics — YES/NO outcome tokens, ERC-6909 escrow, and the `#NO` suffix for bearish trading. Once understood, the model is elegant.

### `setSigner()` Pattern
The documented pattern — construct at boot for reads, call `setSigner({ walletClient })` on wallet connect, `setSigner({})` on disconnect — is exactly the right architecture for browser dApps.

### Market Discovery
`listLiveBinaryMarkets()` with cadence filtering makes it easy to find relevant Event Contracts. The `isValidEventContract()` helper is useful.

### Orderbook Depth
`fetchOrderBook()` returns clean bid/ask data with proper normalization. The `midFromBidAsk()` helper simplifies probability computation.

---

## SDK Feedback

### 1. Error Messages Lack Context

**Issue:** When a trade reverts with `InsufficientBalance`, the error doesn't explain *what* balance is insufficient — collateral (tUSDC) or outcome tokens (YES/NO).

**Example:** A `SELL_YES` order fails with `InsufficientBalance` because the wallet has no YES outcome tokens. The error looks identical to having insufficient tUSDC for a `BUY_YES`.

**Suggestion:** Include context in error messages:
```
InsufficientBalance: requires 100 YES outcome tokens (erc6909), wallet has 0
```
Or provide typed error classes:
```typescript
class InsufficientCollateralError extends SomniaMarketsError { ... }
class InsufficientOutcomeTokenError extends SomniaMarketsError { ... }
```

### 2. `outcomeIndex` Resolution is Non-Obvious

**Issue:** When using `exchange.createOrder(symbol, type, side, amount, price)`, the SDK internally resolves `outcomeIndex` based on whether the symbol includes `#YES` or `#NO`. Without the suffix, it defaults to `outcomeIndex: 0` (YES).

**Problem:** There's no obvious way to create a `BUY_NO` order without knowing to append `#NO` to the symbol. The documentation doesn't explain this.

**Suggestion:** Document the `#NO` suffix behavior explicitly. Consider adding a helper:
```typescript
exchange.createBinaryOrder("BTC/USDC", "limit", "buy_no", amount, price)
```

### 3. `buildPlaceOrder()` is Undocumented

**Issue:** The `Trader.buildPlaceOrder()` method returns `UnsignedOrder` with `{ order, approval }` — perfect for browser wallet signing. But this isn't documented anywhere.

**Discovery:** Found by reading source code. This is the ideal API for browser dApps but invisible to developers.

**Suggestion:** Document `buildPlaceOrder()` as the recommended approach for browser wallet integration.

### 4. Binary Side Mapping is Hidden

**Issue:** The internal mapping from `side: "buy" | "sell"` to `BinarySide: "BUY_YES" | "SELL_YES" | "BUY_NO" | "SELL_NO"` happens inside `createOrder()` based on `outcomeIndex`. Developers can't control this mapping.

**Example:** To bet bearish, you need to:
1. Know that `SELL_YES` requires YES tokens (which you may not have)
2. Know that `BUY_NO` achieves the same exposure with collateral
3. Know to append `#NO` to the symbol

**Suggestion:** Either:
- Document the BUY_YES/SELL_YES vs BUY_NO/SELL_NO equivalence clearly
- Or add an explicit `binarySide` parameter to `createOrder()`

### 5. `getPortfolio()` Timeout Behavior

**Issue:** `exchange.client.getPortfolio()` frequently times out on Somnia Shannon Testnet. The timeout is not configurable and the error message is generic.

**Suggestion:** 
- Make timeout configurable: `exchange.client.getPortfolio(address, { timeout: 15000 })`
- Document expected indexer latency
- Provide a lightweight alternative (e.g., `getPosition(tokenId)` for single positions)

### 6. Cold Start Retry is Critical but Undocumented

**Issue:** The SDK's internal retry logic for cold starts (WebSocket reconnection, indexer warm-up) is essential for reliability but not documented.

**Suggestion:** Document retry behavior and recommended error handling patterns.

---

## Documentation Feedback

### 1. No Browser Wallet Integration Guide

**Gap:** The README mentions `setSigner()` in passing but provides no step-by-step guide for wagmi/viem integration.

**Needed:** A complete guide covering:
- Constructing `SomniaMarkets` without a signer
- Calling `setSigner({ walletClient })` on wallet connect
- Handling `SignerRequiredError`
- Disconnect flow
- Error handling for wallet-specific issues (chain switching, account changes)

### 2. No Event Contracts-Specific Guide

**Gap:** The docs focus on general SDK usage but don't explain Event Contract mechanics.

**Needed:** A guide covering:
- Binary pools (YES/NO outcome tokens)
- ERC-6909 outcome token model
- Market lifecycle (Trading → Locked → Resolved → Finalized → Redeemable)
- Settlement and redemption flow
- Oracle verification

### 3. ERC-6909 Outcome Token Model Not Explained

**Gap:** Developers need to understand that:
- `BUY_YES`/`BUY_NO` use ERC-20 collateral (tUSDC)
- `SELL_YES`/`SELL_NO` use ERC-6909 outcome tokens
- You can't sell what you don't hold

**This is critical** for understanding why `SELL_YES` fails with `InsufficientBalance` when the wallet has tUSDC but no YES tokens.

### 4. `#NO` Suffix for Bearish Trading Not Documented

**Gap:** The SDK automatically maps `buy` + `#NO` to `BUY_NO`. This is the correct way to bet bearish. But this behavior is invisible in the documentation.

### 5. Indexer Lag Not Documented

**Gap:** The Somnia indexer can lag behind on-chain state by seconds to minutes. `getPortfolio()` may not reflect recent trades immediately.

**Suggestion:** Document expected lag, recommended polling intervals, and how to use on-chain data for critical state verification.

### 6. No Example of Complete Trade Flow

**Gap:** There's no end-to-end example showing: market discovery → orderbook → strategy → execution → receipt → position monitoring → settlement.

**Suggestion:** Add a complete trading example in the docs.

---

## Suggestions for Improvement

### Typed Errors
Replace generic `Error` with specific error classes:
```typescript
SignerRequiredError      // No signer configured
InsufficientBalanceError // Balance too low (with context)
MarketNotTradingError    // Market status != Trading
InvalidPriceError        // Price off tick grid
InvalidQuantityError     // Quantity off lot grid
```

### Batch Operations
Add batch methods for common patterns:
```typescript
exchange.redeemMany(positionIds)
exchange.cancelMany(orderIds)
exchange.fetchManyOrderBooks(symbols)
```

### WebSocket Reconnection
Document WebSocket reconnection behavior and provide hooks for monitoring connection state.

### Event Emitter for Market Events
Consider an event emitter for real-time market updates:
```typescript
exchange.on("trade", (event) => { ... })
exchange.on("resolution", (event) => { ... })
```

---

## Summary

The SDK is production-quality with excellent architecture. The main gaps are in documentation (especially browser wallet integration and Event Contract mechanics) and error message clarity. The `setSigner()` pattern and `buildPlaceOrder()` API are particularly strong — they just need to be more visible to developers.

---

*Feedback from Horizon — Somnia × DreamDEX Event Contracts Hackathon*
