import type { MarketState } from "./temporal";

export interface SignalResult {
  asset: string;
  trajectory: {
    state: MarketState;
    stateLabel: string;
    confidence: number;
    reversalRisk: number;
    trajectoryScore: number;
    asOf: string;
    horizons: { horizonMinutes: number; midProbability: number | null; marketId?: string }[];
    metrics: {
      velocityPerHour: number;
      crossHorizonDivergence: number;
      persistence: number;
      directionStrength: number;
    };
  };
  decisionContext?: {
    actionability: string;
  };
}

export type SignalGroup =
  | "bullish"
  | "bearish"
  | "reversal"
  | "conflict"
  | "insufficient";

const GROUP_LABELS: Record<SignalGroup, string> = {
  bullish: "BULLISH",
  bearish: "BEARISH",
  reversal: "REVERSAL WATCH",
  conflict: "CROSS-HORIZON CONFLICT",
  insufficient: "INSUFFICIENT DATA",
};

export const SIGNAL_GROUP_ORDER: SignalGroup[] = [
  "bullish",
  "bearish",
  "reversal",
  "conflict",
  "insufficient",
];

export function classifyGroup(state: MarketState): SignalGroup {
  if (state.startsWith("bullish")) return "bullish";
  if (state.startsWith("bearish")) return "bearish";
  if (state === "reversal-warning") return "reversal";
  if (state === "cross-horizon-conflict") return "conflict";
  return "insufficient";
}

export function groupByState(signals: SignalResult[]): {
  group: SignalGroup;
  label: string;
  count: number;
  signals: SignalResult[];
}[] {
  const map = new Map<SignalGroup, SignalResult[]>();

  for (const g of SIGNAL_GROUP_ORDER) {
    map.set(g, []);
  }

  for (const signal of signals) {
    const group = classifyGroup(signal.trajectory.state);
    map.get(group)!.push(signal);
  }

  return SIGNAL_GROUP_ORDER
    .filter((g) => map.get(g)!.length > 0)
    .map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      count: map.get(g)!.length,
      signals: map.get(g)!,
    }));
}

export function filterByGroup(
  signals: SignalResult[],
  group: SignalGroup
): SignalResult[] {
  return signals.filter((s) => classifyGroup(s.trajectory.state) === group);
}

export type SignalFilter =
  | "ALL"
  | "BULLISH"
  | "BEARISH"
  | "REVERSAL"
  | "CONFLICT"
  | "HIGH_CONFIDENCE";

export function filterSignals(
  signals: SignalResult[],
  filter: SignalFilter
): SignalResult[] {
  if (filter === "ALL") return signals;
  if (filter === "BULLISH")
    return signals.filter((s) => s.trajectory.state.startsWith("bullish"));
  if (filter === "BEARISH")
    return signals.filter((s) => s.trajectory.state.startsWith("bearish"));
  if (filter === "REVERSAL")
    return signals.filter((s) => s.trajectory.state === "reversal-warning");
  if (filter === "CONFLICT")
    return signals.filter(
      (s) => s.trajectory.state === "cross-horizon-conflict"
    );
  if (filter === "HIGH_CONFIDENCE")
    return signals.filter((s) => s.trajectory.confidence >= 0.7);
  return signals;
}

export type SortKey =
  | "strength"
  | "confidence"
  | "actionability"
  | "freshness";

function actionabilityScore(s: SignalResult): number {
  const a = s.decisionContext?.actionability ?? "low";
  if (a === "high") return 3;
  if (a === "medium") return 2;
  return 1;
}

function freshnessScore(s: SignalResult): number {
  const age = Date.now() - new Date(s.trajectory.asOf).getTime();
  return -age;
}

export function sortSignals(
  signals: SignalResult[],
  sortBy: SortKey
): SignalResult[] {
  const copy = [...signals];
  switch (sortBy) {
    case "strength":
      return copy.sort(
        (a, b) => b.trajectory.trajectoryScore - a.trajectory.trajectoryScore
      );
    case "confidence":
      return copy.sort(
        (a, b) => b.trajectory.confidence - a.trajectory.confidence
      );
    case "actionability":
      return copy.sort((a, b) => actionabilityScore(b) - actionabilityScore(a));
    case "freshness":
      return copy.sort((a, b) => freshnessScore(b) - freshnessScore(a));
    default:
      return copy;
  }
}
