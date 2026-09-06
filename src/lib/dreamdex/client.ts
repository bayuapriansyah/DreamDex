// Server-side only — DreamDEX SDK singleton
// Uses testnet private key for demo trade execution.
// Browser wallet signing (user's wallet) is TODO for post-hackathon.
import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { CHAIN, ADDRESSES, WS_RPC_URL, INDEXER_URL } from "./config";

let exchange: SomniaMarkets | null = null;

/**
 * Get the singleton SomniaMarkets instance.
 * Server-side only — initializes with DREAMDEX_PRIVATE_KEY for demo trades.
 *
 * TODO: Add browser wallet signing via setSigner({ walletClient })
 */
export function getExchange(): SomniaMarkets {
  if (exchange) return exchange;

  const privateKey = process.env.DREAMDEX_PRIVATE_KEY;
  if (!privateKey || privateKey === "0x..." || privateKey === "0xYOUR_TESTNET_PRIVATE_KEY_HERE") {
    throw new Error(
      "DREAMDEX_PRIVATE_KEY not set in .env.local. " +
        "Add a funded Shannon testnet private key."
    );
  }

  if (!WS_RPC_URL) {
    throw new Error(
      "SOMNIA_WS_RPC_URL not set in .env.local. " +
        "Required for SDK initialization."
    );
  }

  if (!INDEXER_URL) {
    throw new Error(
      "SOMNIA_INDEXER_URL not set in .env.local. " +
        "Required for market discovery."
    );
  }

  exchange = new SomniaMarkets({
    chain: CHAIN,
    addresses: ADDRESSES,
    privateKey: privateKey as `0x${string}`,
    wsRpcUrl: WS_RPC_URL,
    indexerUrl: INDEXER_URL,
  });

  return exchange;
}
