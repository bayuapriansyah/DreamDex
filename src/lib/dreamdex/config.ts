// Server-side only — DreamDEX / Somnia Shannon testnet configuration
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";

export const CHAIN = somniaShannon;
export const CHAIN_ID = 50312;
export const ADDRESSES = SOMNIA_TESTNET_ADDRESSES;
// Prefer `collateral` over legacy `testUsdc` — SDK may deprecate the alias
export const COLLATERAL = SOMNIA_TESTNET_ADDRESSES.collateral ?? SOMNIA_TESTNET_ADDRESSES.testUsdc;

/**
 * Default collateral decimals — used as FALLBACK ONLY.
 * Per-market `quoteDecimals` from the SDK should be preferred.
 * Testnet tUSDC = 6 decimals. Mainnet USDso = 18 decimals.
 */
export const COLLATERAL_DECIMALS = 6;

/**
 * 1 whole contract in base units.
 * Derived from COLLATERAL_DECIMALS — must stay consistent.
 */
export const ONE = BigInt(10 ** COLLATERAL_DECIMALS);

// RPC / Indexer — from environment only, no silent hardcoded fallbacks
export const INDEXER_URL = process.env.SOMNIA_INDEXER_URL;
export const WS_RPC_URL = process.env.SOMNIA_WS_RPC_URL;

// AI configuration — from environment
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
