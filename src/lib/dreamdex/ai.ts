import { sortByHorizon } from "./normalization";
import { formatHorizon, pctStr } from "./formatting";
import { OPENROUTER_MODEL, APP_URL } from "./config";

interface TrajectoryInput {
  asset: string;
  state: string;
  stateLabel: string;
  horizons: {
    horizonMinutes: number;
    midProbability: number | null;
    bestBid: number | null;
    bestAsk: number | null;
    volume: number;
    dataQuality: string;
  }[];
  metrics: {
    velocityPerHour: number;
    persistence: number;
    convictionDecay: number;
    crossHorizonDivergence: number;
    directionStrength: number;
    momentum: number;
    dataQuality: number;
    liquidity: number;
  };
  trajectoryScore: number;
  confidence: number;
  reversalRisk: number;
  whatChanged: string;
  why: string;
  evidence: string[];
}

interface AIExplanation {
  summary: string;
  keyEvidence: string[];
  uncertainty: string;
  invalidation: string;
}

export async function generateAIExplanation(
  trajectory: TrajectoryInput,
  question?: string
): Promise<AIExplanation> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return generateDeterministicFallback(trajectory, question);
  }

  const horizonStr = sortByHorizon(trajectory.horizons)
    .map(
      (h) =>
        `${formatHorizon(h.horizonMinutes)}: ${h.midProbability !== null ? `${pctStr(h.midProbability, 1)}%` : "N/A"} (bid ${h.bestBid !== null ? `${pctStr(h.bestBid, 1)}%` : "N/A"}, ask ${h.bestAsk !== null ? `${pctStr(h.bestAsk, 1)}%` : "N/A"}, vol ${h.volume !== null ? h.volume.toFixed(1) : "N/A"})`
    )
    .join("\n");

  const prompt = `You are a market intelligence analyst for prediction markets. Analyze the following temporal trajectory data and provide a concise explanation.

ASSET: ${trajectory.asset}
MARKET STATE: ${trajectory.stateLabel}
CONFIDENCE: ${pctStr(trajectory.confidence, 0)}%
REVERSAL RISK: ${pctStr(trajectory.reversalRisk, 0)}%

HORIZON PROBABILITIES:
${horizonStr}

METRICS:
- Velocity: ${pctStr(trajectory.metrics.velocityPerHour, 2)}/hr
- Persistence: ${pctStr(trajectory.metrics.persistence, 0)}%
- Conviction Decay: ${pctStr(trajectory.metrics.convictionDecay, 1)}pp
- Cross-Horizon Divergence: ${pctStr(trajectory.metrics.crossHorizonDivergence, 1)}pp
- Direction Strength: ${pctStr(trajectory.metrics.directionStrength, 0)}%
- Momentum: ${pctStr(trajectory.metrics.momentum, 1)}%

WHAT CHANGED: ${trajectory.whatChanged}
WHY: ${trajectory.why}${question ? `\n\nUSER QUESTION: ${question}` : ""}

Provide exactly 4 sections, each on a new line starting with the label:

SUMMARY: One sentence explaining the trajectory in plain language.${question ? " Address the user's question directly." : ""}
KEY_EVIDENCE: 2-3 key data points that support the analysis, separated by |.
UNCERTAINTY: What could invalidate this analysis.
INVALIDATION: Specific conditions that would change the market state.

Rules:
- Be concise (1-2 sentences per section)
- Reference actual numbers from the data
- Do NOT make predictions or guarantee outcomes
- Do NOT invent data not provided
- Focus on what the temporal pattern reveals about market conviction
- Do NOT provide financial advice or guaranteed outcomes`;

  try {
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": APP_URL,
          "X-Title": "DreamDex Temporal",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      }
    );

    if (!res.ok) {
      return generateDeterministicFallback(trajectory);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return parseAIResponse(content, trajectory, question);
  } catch {
    return generateDeterministicFallback(trajectory, question);
  }
}

function parseAIResponse(
  content: string,
  trajectory: TrajectoryInput,
  question?: string
): AIExplanation {
  const lines = content.split("\n").filter((l: string) => l.trim());

  let summary = "";
  let keyEvidence: string[] = [];
  let uncertainty = "";
  let invalidation = "";

  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    if (upper.startsWith("SUMMARY:")) {
      summary = line.split(":").slice(1).join(":").trim();
    } else if (upper.startsWith("KEY_EVIDENCE:")) {
      const raw = line.split(":").slice(1).join(":").trim();
      keyEvidence = raw
        .split("|")
        .map((s: string) => s.trim())
        .filter(Boolean);
    } else if (upper.startsWith("UNCERTAINTY:")) {
      uncertainty = line.split(":").slice(1).join(":").trim();
    } else if (upper.startsWith("INVALIDATION:")) {
      invalidation = line.split(":").slice(1).join(":").trim();
    }
  }

  if (!summary) {
    return generateDeterministicFallback(trajectory, question);
  }

  return {
    summary,
    keyEvidence: keyEvidence.length > 0 ? keyEvidence : trajectory.evidence.slice(0, 3),
    uncertainty: uncertainty || "Market conditions can change rapidly. This analysis is based on current orderbook state.",
    invalidation: invalidation || `A significant shift in the ${trajectory.asset} orderbook or external catalyst would change this trajectory.`,
  };
}

function generateDeterministicFallback(
  trajectory: TrajectoryInput,
  question?: string
): AIExplanation {
  const sorted = sortByHorizon(trajectory.horizons);
  const shortProb = sorted[0]?.midProbability ?? null;
  const longProb = sorted[sorted.length - 1]?.midProbability ?? null;

  // Handle null probabilities honestly
  if (shortProb === null || longProb === null) {
    return {
      summary: `${trajectory.asset} — insufficient probability data across horizons for a meaningful trajectory analysis.`,
      keyEvidence: trajectory.evidence.slice(0, 3),
      uncertainty: "Data unavailable or incomplete. No reliable trajectory can be determined.",
      invalidation: "A complete orderbook across multiple horizons would enable trajectory analysis.",
    };
  }

  const pp = pctStr(shortProb - longProb, 0);

  const direction = shortProb > 0.5 ? "bullish" : shortProb < 0.5 ? "bearish" : "neutral";
  const trend =
    trajectory.metrics.convictionDecay < -0.03
      ? "weakens"
      : trajectory.metrics.convictionDecay > 0.03
      ? "strengthens"
      : "remains stable";

  return {
    summary: `${trajectory.asset} shows ${direction} short-term conviction that ${trend} across longer horizons, with a ${pp}pp spread between shortest and longest horizon.`,
    keyEvidence: trajectory.evidence.slice(0, 3),
    uncertainty: `The ${trajectory.stateLabel.toLowerCase()} state may not persist if orderbook dynamics shift. Confidence is at ${pctStr(trajectory.confidence, 0)}%.`,
    invalidation: `A significant move in the underlying ${trajectory.asset} price or a shift in orderbook balance would invalidate this trajectory.`,
  };
}
