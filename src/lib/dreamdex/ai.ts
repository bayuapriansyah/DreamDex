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
        return generateDeterministicFallback(trajectory, question);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return parseAIResponse(content, trajectory, question)
      ?? generateDeterministicFallback(trajectory, question);
  } catch {
    return generateDeterministicFallback(trajectory, question);
  }
}

function parseAIResponse(
  content: string,
  trajectory: TrajectoryInput,
  question?: string
): AIExplanation | null {
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
    return null;
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

  const noData = shortProb === null || longProb === null;

  if (noData) {
    const q = (question || "").toLowerCase();
    const isGreeting = /^(hai|halo|hello|hi|hey|yo|sup|halo|apa|kabar|thanks|thank|ok|got it|bye|dadah)/i.test(q);

    if (isGreeting) {
      return {
        summary: `Hey! I'm Horizon Copilot — your ${trajectory.asset} market intelligence assistant. Live probability data is temporarily unavailable, but I'm here when the data comes back online. Ask me anything about the market!`,
        keyEvidence: [],
        uncertainty: "Market data may be delayed or unavailable.",
        invalidation: "",
      };
    }

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

  const q = (question || "").toLowerCase();

  // ── Question-aware responses ──

  if (q.includes("next hour") || q.includes("scenario") || q.includes("map")) {
    return {
      summary: `PROJECTED SCENARIO — ${trajectory.asset} (${trajectory.stateLabel}): Probability at ${pctStr(shortProb, 0)} (short) vs ${pctStr(longProb, 0)} (long), spread ${pp}pp. Conviction ${trend}. Velocity: ${trajectory.metrics.velocityPerHour > 0 ? "+" : ""}${pctStr(trajectory.metrics.velocityPerHour, 2)}/hr. Scenario: ${direction} trajectory likely to continue in the near term, but with ${pctStr(trajectory.confidence, 0)}% confidence.`,
      keyEvidence: [
        `Short-term probability: ${pctStr(shortProb, 0)}`,
        `Conviction ${trend} (decay: ${pctStr(trajectory.metrics.convictionDecay, 2)})`,
        `Cross-horizon spread: ${pp}pp`,
        `Velocity: ${trajectory.metrics.velocityPerHour > 0 ? "+" : ""}${pctStr(trajectory.metrics.velocityPerHour, 2)}/hr`,
      ],
      uncertainty: `Confidence at ${pctStr(trajectory.confidence, 0)}%. This is a heuristic projection, not a prediction.`,
      invalidation: `A shift in underlying price or orderbook balance would invalidate this scenario.`,
    };
  }

  if (q.includes("compare") || q.includes("vs") || q.includes("versus")) {
    return {
      summary: `ASSET COMPARISON — ${trajectory.asset}: ${trajectory.stateLabel}, ${direction} conviction with ${pctStr(trajectory.confidence, 0)}% confidence. Short: ${pctStr(shortProb, 0)}, Long: ${pctStr(longProb, 0)}, Spread: ${pp}pp.`,
      keyEvidence: [
        `${trajectory.asset} state: ${trajectory.stateLabel}`,
        `Direction strength: ${pctStr(trajectory.metrics.directionStrength, 0)}%`,
        `Persistence: ${pctStr(trajectory.metrics.persistence, 0)}%`,
        `Data points: ${trajectory.horizons.length}`,
      ],
      uncertainty: `Single-asset analysis. Compare with another asset's trajectory for full context.`,
      invalidation: `Cross-asset correlation may break during high-volatility events.`,
    };
  }

  if (q.includes("invalidat") || q.includes("invalidate") || q.includes("revers")) {
    return {
      summary: `INVALIDATION CONDITIONS — ${trajectory.asset} (${trajectory.stateLabel}) would be invalidated by: 1) Probability crossing below ${direction === "bearish" ? "50%" : "40%"}, 2) Conviction decay turning negative beyond -5%, 3) Cross-horizon divergence exceeding 20pp.`,
      keyEvidence: [
        `Current short prob: ${pctStr(shortProb, 0)} — margin to invalidation: ${pctStr(Math.abs(shortProb - 0.4), 0)}`,
        `Conviction decay: ${pctStr(trajectory.metrics.convictionDecay, 2)}`,
        `Cross-horizon divergence: ${pctStr(trajectory.metrics.crossHorizonDivergence, 0)}%`,
      ],
      uncertainty: `Invalidation thresholds are heuristic. Market conditions can shift rapidly.`,
      invalidation: `Monitor probability levels and conviction decay for early warning signals.`,
    };
  }

  if (q.includes("confidence") || q.includes("low") || q.includes("limiting")) {
    return {
      summary: `CONFIDENCE ANALYSIS — ${trajectory.asset} confidence at ${pctStr(trajectory.confidence, 0)}%. ${trajectory.confidence < 0.5 ? "Low confidence due to limited data points, cross-horizon divergence, or inconsistent direction signals." : "Confidence supported by data quality and cross-horizon consistency."}`,
      keyEvidence: [
        `Confidence score: ${pctStr(trajectory.confidence, 0)}%`,
        `Data points: ${trajectory.horizons.length} horizon(s)`,
        `Cross-horizon divergence: ${pctStr(trajectory.metrics.crossHorizonDivergence, 0)}%`,
        `Direction consistency: ${pctStr(trajectory.metrics.persistence, 0)}%`,
      ],
      uncertainty: `Confidence is a composite metric — ${trajectory.confidence < 0.5 ? "additional horizons would improve reliability" : "current data is sufficient for directional analysis"}.`,
      invalidation: `A sudden shift in orderbook dynamics would rapidly reduce confidence.`,
    };
  }

  if (q.includes("changed") || q.includes("snapshot") || q.includes("what change")) {
    return {
      summary: `WHAT CHANGED — ${trajectory.asset}: State is ${trajectory.stateLabel}. Short-term: ${pctStr(shortProb, 0)}, Long-term: ${pctStr(longProb, 0)}. Conviction ${trend} across horizons. Velocity: ${trajectory.metrics.velocityPerHour > 0 ? "+" : ""}${pctStr(trajectory.metrics.velocityPerHour, 2)}/hr.`,
      keyEvidence: [
        `Short prob: ${pctStr(shortProb, 0)}`,
        `Long prob: ${pctStr(longProb, 0)}`,
        `Spread: ${pp}pp`,
        `Velocity: ${trajectory.metrics.velocityPerHour > 0 ? "+" : ""}${pctStr(trajectory.metrics.velocityPerHour, 2)}/hr`,
      ],
      uncertainty: `Deterministic analysis — snapshot-based, not continuous.`,
      invalidation: `New orderbook data may shift the trajectory.`,
    };
  }

  if (q.includes("single") || q.includes("horizon") || q.includes("only one")) {
    return {
      summary: `HORIZON ANALYSIS — ${trajectory.asset} currently has ${trajectory.horizons.length} active horizon(s). ${trajectory.horizons.length <= 1 ? "Limited data — only one horizon available. Cross-horizon analysis requires 2+ horizons." : "Multiple horizons available for trajectory analysis."}`,
      keyEvidence: [
        `Active horizons: ${trajectory.horizons.length}`,
        `Available: ${trajectory.horizons.map((h) => `${h.horizonMinutes}m`).join(", ")}`,
      ],
      uncertainty: `Additional horizons would improve trajectory reliability and enable persistence/divergence analysis.`,
      invalidation: `New market listings or increased trading activity may add horizons.`,
    };
  }

  if (q.includes("direction") || q.includes("up or down") || q.includes("bullish") || q.includes("bearish")) {
    return {
      summary: `DIRECTION ANALYSIS — ${trajectory.asset} is ${direction} (short: ${pctStr(shortProb, 0)}, long: ${pctStr(longProb, 0)}). Direction strength: ${pctStr(trajectory.metrics.directionStrength, 0)}%. Persistence: ${pctStr(trajectory.metrics.persistence, 0)}%. Conviction ${trend}.`,
      keyEvidence: [
        `Short-term probability: ${pctStr(shortProb, 0)}`,
        `Direction strength: ${pctStr(trajectory.metrics.directionStrength, 0)}%`,
        `Persistence: ${pctStr(trajectory.metrics.persistence, 0)}%`,
        `Conviction decay: ${pctStr(trajectory.metrics.convictionDecay, 2)}`,
      ],
      uncertainty: `Direction is derived from market-implied probabilities, not price prediction.`,
      invalidation: `A shift below 50% at short horizons would flip the direction signal.`,
    };
  }

  // ── Default fallback ──
  return {
    summary: `${trajectory.asset} shows ${direction} short-term conviction that ${trend} across longer horizons, with a ${pp}pp spread between shortest and longest horizon.`,
    keyEvidence: trajectory.evidence.slice(0, 3),
    uncertainty: `The ${trajectory.stateLabel.toLowerCase()} state may not persist if orderbook dynamics shift. Confidence is at ${pctStr(trajectory.confidence, 0)}%.`,
    invalidation: `A significant move in the underlying ${trajectory.asset} price or a shift in orderbook balance would invalidate this trajectory.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat response (POST with messages[])
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generateChatResponse(
  trajectory: TrajectoryInput,
  messages: ChatMessage[]
): Promise<AIExplanation> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

  const hasData = trajectory.horizons.some((h) => h.midProbability !== null);

  if (!apiKey) {
    return generateDeterministicFallback(trajectory, lastUserMsg?.content);
  }

  const horizonStr = sortByHorizon(trajectory.horizons)
    .map(
      (h) =>
        `${formatHorizon(h.horizonMinutes)}: ${h.midProbability !== null ? `${pctStr(h.midProbability, 1)}%` : "N/A"}`
    )
    .join(", ");

  const systemPrompt = hasData
    ? `You are Horizon Copilot, a market intelligence analyst for prediction markets. Answer the user's question concisely using the data below. Be direct. Reference actual numbers. If the user sends a greeting or casual message, respond conversationally in 1-2 sentences and briefly mention the current market state. Don't force analysis.

ASSET: ${trajectory.asset}
STATE: ${trajectory.stateLabel}
CONFIDENCE: ${pctStr(trajectory.confidence, 0)}%
REVERSAL RISK: ${pctStr(trajectory.reversalRisk, 0)}%
HORIZONS: ${horizonStr}
VELOCITY: ${pctStr(trajectory.metrics.velocityPerHour, 2)}/hr
PERSISTENCE: ${pctStr(trajectory.metrics.persistence, 0)}%
CONVICTION DECAY: ${pctStr(trajectory.metrics.convictionDecay, 1)}pp
DIVERGENCE: ${pctStr(trajectory.metrics.crossHorizonDivergence, 1)}pp
WHAT CHANGED: ${trajectory.whatChanged}
WHY: ${trajectory.why}`
    : `You are Horizon Copilot, a market intelligence assistant for DreamDEX prediction markets. The user is asking about ${trajectory.asset}. Currently there is no live probability data available for this asset. Respond conversationally — acknowledge the greeting or question, let them know data is temporarily unavailable, and suggest they check back later. Be friendly and brief.`;

  const chatHistory = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://horizon-dex.vercel.app",
      "X-Title": "Horizon Copilot",
    },
    body: JSON.stringify({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    return generateDeterministicFallback(trajectory, lastUserMsg?.content);
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content;

  if (!answer) {
    return generateDeterministicFallback(trajectory, lastUserMsg?.content);
  }

  const parsed = parseAIResponse(answer, trajectory, lastUserMsg?.content);
  if (parsed) return parsed;

  return {
    summary: answer,
    keyEvidence: trajectory.evidence.slice(0, 3),
    uncertainty: "AI-generated response — verify with market data.",
    invalidation: `Monitor ${trajectory.asset} probability levels and orderbook dynamics.`,
  };
}
