// DreamDEX SDK singleton
// Hybrid mode: browser wallet signs when connected, server fallback for demo.
import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { WalletClient } from "viem";
import { CHAIN, ADDRESSES, WS_RPC_URL, INDEXER_URL } from "./config";

let exchange: SomniaMarkets | null = null;

/**
 * Get the singleton SomniaMarkets instance.
 * Initializes without signer for public reads.
 * Signer is set dynamically via setExchangeSigner() on wallet connect.
 */
export function getExchange(): SomniaMarkets {
  if (exchange) return exchange;

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

  // Try to initialize with server key for demo fallback
  const privateKey = process.env.DREAMDEX_PRIVATE_KEY;
  const hasServerKey = privateKey && privateKey !== "0x..." && privateKey !== "0xYOUR_TESTNET_PRIVATE_KEY_HERE";

  exchange = new SomniaMarkets({
    chain: CHAIN,
    addresses: ADDRESSES,
    ...(hasServerKey ? { privateKey: privateKey as `0x${string}` } : {}),
    wsRpcUrl: WS_RPC_URL,
    indexerUrl: INDEXER_URL,
  });

  return exchange;
}

/**
 * Connect a browser wallet to the SDK for trade signing.
 * Call this when wagmi's useWalletClient returns a wallet client.
 * After this, exchange.createOrder() will sign via the browser wallet.
 */
export function setExchangeSigner(walletClient: WalletClient): void {
  const ex = getExchange();
  ex.setSigner({ walletClient });
}

/**
 * Disconnect the browser wallet signer.
 * Returns the exchange to server-side signing (if available) or unauthenticated reads.
 */
export function clearExchangeSigner(): void {
  const ex = getExchange();
  ex.setSigner({});
}

/**
 * Check if the exchange has a browser wallet signer attached.
 */
export function hasBrowserSigner(): boolean {
  const ex = getExchange();
  return !!ex.walletAddress;
}
