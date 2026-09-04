"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const isWrongChain = isConnected && chainId !== somniaShannon.id;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex justify-between items-center px-7 py-4"
      style={{ background: "linear-gradient(180deg, rgba(17,15,34,0.92), transparent)", backdropFilter: "blur(8px)" }}>
      <Link href="/" className="brand" style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "0.2em", color: "var(--tape)" }}>
        <svg width="17" height="17" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" style={{ color: "var(--accent-copper)" }}>
          <path d="M15.2 3.2 A12.8 12.8 0 0 0 15.2 28.8 Z" />
          <path d="M16.8 3.2 A12.8 12.8 0 0 1 16.8 28.8 Z" opacity="0.45" />
          <circle cx="16" cy="16" r="14.6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
        </svg>
        <b>TEMPORAL</b>
      </Link>

      <nav className="flex items-center gap-7">
        {[
          { href: "/markets", label: "Markets" },
          { href: "/analyze/BTC", label: "Analyze" },
          { href: "/trade", label: "Trade" },
          { href: "/positions", label: "Positions" },
          { href: "/replay", label: "Replay" },
          { href: "/thesis", label: "Thesis" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm hover:text-chalk transition-colors"
            style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-5 text-sm">
        {mounted && (
          <>
            {isWrongChain && (
              <span className="text-[10px] font-mono px-2 py-1 rounded"
                style={{ color: "var(--accent-warn)", background: "rgba(196,92,58,0.12)" }}>
                WRONG NETWORK
              </span>
            )}
            {isConnected ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: "var(--muted-foreground)", fontFeatureSettings: "\"tnum\"" }}>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <Button variant="outline" size="sm" onClick={() => disconnect()}
                  className="text-[10px] h-6 px-2" style={{ borderColor: "rgba(239,230,214,0.16)" }}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => connect({ connector: connectors[0] })} disabled={isPending}
                className="solid text-xs h-7 px-4">
                {isPending ? "..." : "Connect"}
              </Button>
            )}
          </>
        )}
        {!mounted && (
          <div className="w-20 h-7 rounded" style={{ background: "rgba(239,230,214,0.06)" }} />
        )}
      </div>
    </header>
  );
}
