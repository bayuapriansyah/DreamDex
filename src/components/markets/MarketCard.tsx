"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HorizonData {
  horizonMinutes: number;
  lastPrice: number | null;
  secondsLeft: number;
  marketId: string;
}

interface TemporalSnapshot {
  state: string;
  stateLabel: string;
  confidence: number;
  reversalRisk: number;
  velocityPerHour: number;
}

interface MarketCardProps {
  asset: string;
  horizons: HorizonData[];
}

function formatProb(p: number | null): string {
  if (p === null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatHorizon(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${(mins / 60).toFixed(0)}h`;
  return `${(mins / 1440).toFixed(0)}d`;
}

function stateTextColor(state: string): string {
  if (state.includes("bullish")) return "text-accent-green";
  if (state.includes("bearish")) return "text-accent-red";
  if (state === "reversal-warning") return "text-accent-yellow";
  if (state === "cross-horizon-conflict") return "text-orange-500";
  return "text-muted-foreground";
}

function stateBadgeVariant(
  state: string
): "default" | "destructive" | "secondary" | "outline" {
  if (state.includes("bullish")) return "default";
  if (state.includes("bearish")) return "destructive";
  if (state === "reversal-warning") return "outline";
  return "secondary";
}

export function MarketCard({ asset, horizons }: MarketCardProps) {
  const [temporal, setTemporal] = useState<TemporalSnapshot | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    fetchedRef.current = false;
    async function load() {
      try {
        const res = await fetch(`/api/dreamdex/temporal?asset=${asset}`);
        const data = await res.json();
        if (!fetchedRef.current && data.ok && data.trajectory) {
          const t = data.trajectory;
          setTemporal({
            state: t.state,
            stateLabel: t.stateLabel,
            confidence: t.confidence,
            reversalRisk: t.reversalRisk,
            velocityPerHour: t.metrics.velocityPerHour,
          });
        }
      } catch {
        // silent
      }
    }
    void load();
    return () => {
      fetchedRef.current = true;
    };
  }, [asset]);

  const validPrices = horizons
    .filter((h) => h.lastPrice !== null)
    .map((h) => h.lastPrice!);

  const trajectory =
    validPrices.length >= 2
      ? validPrices[0] > validPrices[validPrices.length - 1]
        ? "WEAKENING"
        : validPrices[0] < validPrices[validPrices.length - 1]
          ? "STRENGTHENING"
          : "STABLE"
      : "INSUFFICIENT DATA";

  return (
    <Card className="w-full bg-card border-card-border hover:border-muted/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono font-bold">{asset}</CardTitle>
          <div className="flex items-center gap-2">
            {temporal ? (
              <>
                <Badge
                  variant={stateBadgeVariant(temporal.state)}
                  className={`${stateTextColor(temporal.state)} text-[10px] font-mono`}
                >
                  {temporal.stateLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {(temporal.confidence * 100).toFixed(0)}%
                </Badge>
                {temporal.reversalRisk > 0.5 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-accent-yellow border-accent-yellow/30"
                  >
                    REV
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="secondary" className="text-[10px] font-mono">{trajectory}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Horizon probability bars */}
        <div className="grid grid-cols-2 gap-2">
          {horizons.map((h) => (
            <div key={h.marketId} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-mono w-8">
                {formatHorizon(h.horizonMinutes)}
              </span>
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    (h.lastPrice ?? 0.5) > 0.5
                      ? "bg-accent-green"
                      : (h.lastPrice ?? 0.5) < 0.5
                      ? "bg-accent-red"
                      : "bg-muted-foreground"
                  }`}
                  style={{ width: `${Math.max((h.lastPrice ?? 0.5) * 100, 2)}%` }}
                />
              </div>
              <span className="text-xs font-mono font-medium tabular-nums min-w-[3rem] text-right">
                {formatProb(h.lastPrice)}
              </span>
            </div>
          ))}
        </div>

        {temporal && (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
            <span>
              <span className="text-foreground">V</span>{" "}
              {temporal.velocityPerHour > 0 ? "+" : ""}
              {(temporal.velocityPerHour * 100).toFixed(2)}%/hr
            </span>
            <span>
              <span className="text-foreground">R</span>{" "}
              {(temporal.reversalRisk * 100).toFixed(0)}%
            </span>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground font-mono">
          Expires in {formatTimeLeft(Math.min(...horizons.map((h) => h.secondsLeft)))}
        </div>

        <Link href={`/analyze/${asset}`}>
          <Button className="w-full" variant="outline" size="sm">
            Analyze
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
