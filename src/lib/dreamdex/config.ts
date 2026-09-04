// Server-side only — DreamDEX / Somnia Shannon testnet configuration
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";

export const CHAIN = somniaShannon;
export const CHAIN_ID = 50312;
export const ADDRESSES = SOMNIA_TESTNET_ADDRESSES;
export const COLLATERAL = SOMNIA_TESTNET_ADDRESSES.testUsdc;
// Testnet tUSDC has 6 decimals; mainnet USDso has 18
export const COLLATERAL_DECIMALS = 6;
export const ONE = BigInt(1_000_000); // 1 whole contract in base units

export const INDEXER_URL =
  process.env.SOMNIA_INDEXER_URL || "https://dev.smk.somnia.host/v1/graphql";
export const WS_RPC_URL =
  process.env.SOMNIA_WS_RPC_URL ||
  "wss://api.infra.testnet.somnia.network/ws";
