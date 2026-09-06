"use client";

interface SuggestedPromptsProps {
  asset: string;
  state: string;
  confidence: number;
  onSelect: (question: string) => void;
}

function buildPrompts(
  asset: string,
  state: string,
  confidence: number
): { label: string; question: string }[] {
  const prompts: { label: string; question: string }[] = [];

  prompts.push({
    label: `Why is ${asset} ${state.includes("bullish") ? "bullish" : state.includes("bearish") ? "bearish" : state}?`,
    question: `Why is ${asset} ${state.includes("bullish") ? "bullish" : state.includes("bearish") ? "bearish" : state}?`,
  });

  prompts.push({
    label: "What changed since the last snapshot?",
    question: "What changed since the last snapshot?",
  });

  if (state === "reversal-warning" || state === "cross-horizon-conflict") {
    prompts.push({
      label: "Why did the regime change?",
      question: "Why did the regime change?",
    });
  }

  prompts.push({
    label: "What would invalidate this signal?",
    question: "What would invalidate this signal?",
  });

  if (confidence < 0.5) {
    prompts.push({
      label: "Why is confidence low?",
      question: "Why is confidence low?",
    });
  }

  const otherAsset = asset === "BTC" ? "ETH" : "BTC";
  prompts.push({
    label: `Compare ${asset} vs ${otherAsset}`,
    question: `Compare ${asset} vs ${otherAsset}`,
  });

  prompts.push({
    label: "Explain the next-hour scenario",
    question: "What is the next hour scenario?",
  });

  prompts.push({
    label: "What data is limiting confidence?",
    question: "What data is limiting confidence?",
  });

  return prompts;
}

export function SuggestedPrompts({
  asset,
  state,
  confidence,
  onSelect,
}: SuggestedPromptsProps) {
  const prompts = buildPrompts(asset, state, confidence);

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: "0.62rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 8,
        }}
      >
        SUGGESTED QUESTIONS
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p.question)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-full)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-data)",
              fontSize: "0.68rem",
              cursor: "pointer",
              transition: "all 150ms ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(245,158,11,0.08)";
              e.currentTarget.style.borderColor = "rgba(245,158,11,0.2)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
