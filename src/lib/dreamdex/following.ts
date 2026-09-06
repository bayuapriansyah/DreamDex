import type { MarketState } from "./temporal";

export interface FollowedSignal {
  id: string;
  marketId: string;
  asset: string;
  horizonMinutes: number;
  baselineProbability: number;
  baselineRegime: MarketState;
  baselineRegimeLabel: string;
  baselineConfidence: number;
  baselineReversalRisk: number;
  baselineDivergence: number;
  baselineVelocity: number;
  baselineActionability: string;
  followedAt: string;
  lastCheckedAt: string;
  status: "active" | "closed";
}

export interface ChangeEntry {
  field: string;
  previous: number | string;
  current: number | string;
  delta: number | null;
  material: boolean;
}

const STORAGE_PREFIX = "dreamdex-following";

function walletKey(wallet: string): string {
  return `${STORAGE_PREFIX}:${wallet.slice(0, 10).toLowerCase()}`;
}

function readFollows(wallet: string): FollowedSignal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(walletKey(wallet));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FollowedSignal[];
  } catch {
    return [];
  }
}

function writeFollows(wallet: string, follows: FollowedSignal[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(walletKey(wallet), JSON.stringify(follows));
  } catch {
    // storage full or unavailable
  }
}

export function getFollows(wallet: string): FollowedSignal[] {
  return readFollows(wallet).filter((f) => f.status === "active");
}

export function getAllFollows(wallet: string): FollowedSignal[] {
  return readFollows(wallet);
}

export function isFollowing(
  wallet: string,
  asset: string,
  horizonMinutes: number
): boolean {
  const id = `${asset}-${horizonMinutes}`;
  return readFollows(wallet).some((f) => f.id === id && f.status === "active");
}

export function addFollow(
  wallet: string,
  follow: Omit<FollowedSignal, "id" | "followedAt" | "lastCheckedAt" | "status">
): FollowedSignal {
  const follows = readFollows(wallet);
  const id = `${follow.asset}-${follow.horizonMinutes}`;

  const existing = follows.find((f) => f.id === id);
  if (existing && existing.status === "active") {
    return existing;
  }

  const newFollow: FollowedSignal = {
    ...follow,
    id,
    followedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    status: "active",
  };

  follows.push(newFollow);
  writeFollows(wallet, follows);
  return newFollow;
}

export function removeFollow(wallet: string, followId: string): boolean {
  const follows = readFollows(wallet);
  const idx = follows.findIndex((f) => f.id === followId);
  if (idx === -1) return false;

  follows[idx].status = "closed";
  writeFollows(wallet, follows);
  return true;
}

export function updateFollowTimestamp(
  wallet: string,
  followId: string
): void {
  const follows = readFollows(wallet);
  const f = follows.find((f) => f.id === followId);
  if (f) {
    f.lastCheckedAt = new Date().toISOString();
    writeFollows(wallet, follows);
  }
}

const MATERIAL_THRESHOLDS = {
  probability: 0.05,
  confidence: 0.10,
  reversalRisk: 0.10,
  divergence: 0.05,
  velocity: 0.03,
} as const;

function isMaterial(delta: number, threshold: number): boolean {
  return Math.abs(delta) >= threshold;
}

export function detectMaterialChange(
  follow: FollowedSignal,
  current: {
    probability: number | null;
    state: MarketState;
    confidence: number;
    reversalRisk: number;
    divergence: number;
    velocity: number;
    actionability: string;
  }
): { changed: boolean; changes: ChangeEntry[] } {
  const changes: ChangeEntry[] = [];

  if (current.probability !== null) {
    const delta = current.probability - follow.baselineProbability;
    changes.push({
      field: "probability",
      previous: follow.baselineProbability,
      current: current.probability,
      delta,
      material: isMaterial(delta, MATERIAL_THRESHOLDS.probability),
    });
  }

  if (current.state !== follow.baselineRegime) {
    changes.push({
      field: "regime",
      previous: follow.baselineRegime,
      current: current.state,
      delta: null,
      material: true,
    });
  }

  const confDelta = current.confidence - follow.baselineConfidence;
  changes.push({
    field: "confidence",
    previous: follow.baselineConfidence,
    current: current.confidence,
    delta: confDelta,
    material: isMaterial(confDelta, MATERIAL_THRESHOLDS.confidence),
  });

  const riskDelta = current.reversalRisk - follow.baselineReversalRisk;
  changes.push({
    field: "reversalRisk",
    previous: follow.baselineReversalRisk,
    current: current.reversalRisk,
    delta: riskDelta,
    material: isMaterial(riskDelta, MATERIAL_THRESHOLDS.reversalRisk),
  });

  const divDelta = current.divergence - follow.baselineDivergence;
  changes.push({
    field: "divergence",
    previous: follow.baselineDivergence,
    current: current.divergence,
    delta: divDelta,
    material: isMaterial(divDelta, MATERIAL_THRESHOLDS.divergence),
  });

  const velDelta = current.velocity - follow.baselineVelocity;
  changes.push({
    field: "velocity",
    previous: follow.baselineVelocity,
    current: current.velocity,
    delta: velDelta,
    material: isMaterial(velDelta, MATERIAL_THRESHOLDS.velocity),
  });

  if (current.actionability !== follow.baselineActionability) {
    changes.push({
      field: "actionability",
      previous: follow.baselineActionability,
      current: current.actionability,
      delta: null,
      material: true,
    });
  }

  const changed = changes.some((c) => c.material);
  return { changed, changes };
}

export function deriveFollowStatus(
  follow: FollowedSignal,
  current: {
    probability: number | null;
    state: MarketState;
    confidence: number;
    reversalRisk: number;
  }
): {
  status: "STRENGTHENING" | "WEAKENING" | "UNCHANGED" | "INVALIDATED";
  delta: number;
} {
  const currentProb = current.probability ?? 0.5;
  const baseProb = follow.baselineProbability;
  const delta = currentProb - baseProb;
  const ppDelta = Math.round(delta * 100);

  const regimeImproved =
    (current.state.startsWith("bullish") &&
      (follow.baselineRegime.startsWith("bearish") ||
        follow.baselineRegime === "neutral" ||
        follow.baselineRegime === "insufficient-data")) ||
    (current.state.includes("acceleration") &&
      !follow.baselineRegime.includes("acceleration"));

  const regimeWeakened =
    (current.state.startsWith("bearish") &&
      follow.baselineRegime.startsWith("bullish")) ||
    (current.state.includes("decay") &&
      !follow.baselineRegime.includes("decay")) ||
    current.state === "reversal-warning" ||
    current.state === "cross-horizon-conflict";

  if (current.state === "insufficient-data") {
    return { status: "INVALIDATED", delta: ppDelta };
  }

  if (regimeWeakened && ppDelta < -3) {
    return { status: "WEAKENING", delta: ppDelta };
  }

  if (regimeImproved && ppDelta > 3) {
    return { status: "STRENGTHENING", delta: ppDelta };
  }

  if (ppDelta > 3) {
    return { status: "STRENGTHENING", delta: ppDelta };
  }

  if (ppDelta < -3) {
    return { status: "WEAKENING", delta: ppDelta };
  }

  return { status: "UNCHANGED", delta: ppDelta };
}
