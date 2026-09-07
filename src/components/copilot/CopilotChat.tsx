"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CopilotMessage, type Message } from "./CopilotMessage";

interface CopilotChatProps {
  asset: string;
  state: string;
  confidence: number;
}

function buildSuggestions(asset: string, state: string, confidence: number): string[] {
  const prompts: string[] = [];

  if (state.includes("bullish")) {
    prompts.push(`Why is ${asset} bullish?`);
  } else if (state.includes("bearish")) {
    prompts.push(`Why is ${asset} bearish?`);
  } else {
    prompts.push(`What is the ${asset} market state?`);
  }

  prompts.push("What changed since the last snapshot?");

  if (state === "reversal-warning" || state === "cross-horizon-conflict") {
    prompts.push("Why did the regime change?");
  }

  prompts.push("What would invalidate this signal?");

  if (confidence < 0.5) {
    prompts.push("Why is confidence low?");
  }

  const otherAsset = asset === "BTC" ? "ETH" : asset === "ETH" ? "BTC" : "BTC";
  prompts.push(`Compare ${asset} vs ${otherAsset}`);
  prompts.push("Explain the next-hour scenario");

  return prompts;
}

export function CopilotChat({ asset, state, confidence }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = buildSuggestions(asset, state, confidence);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/dreamdex/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset, messages: history }),
        });

        const data = await res.json();

        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.ok
            ? data.explanation.summary +
              (data.explanation.keyEvidence?.length
                ? "\n\n" + data.explanation.keyEvidence.map((e: string) => `• ${e}`).join("\n")
                : "") +
              (data.explanation.uncertainty
                ? "\n\n⚠ " + data.explanation.uncertainty
                : "")
            : data.error || "Failed to get response.",
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Network error. Please try again.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [messages, asset, loading]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        height: "100%",
      }}
    >
      {/* Suggested pills — only show when no messages yet */}
      {messages.length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "0 0 8px" }}>
          {suggestions.slice(0, 5).map((q, i) => (
            <button
              key={i}
              onClick={() => void sendMessage(q)}
              disabled={loading}
              style={{
                padding: "4px 8px",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-data)",
                fontSize: 9,
                cursor: loading ? "wait" : "pointer",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
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
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          maxHeight: 320,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "4px 0",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}
      >
        {messages.length === 0 && !loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 0",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 10,
                color: "var(--text-tertiary)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Ask about {asset} trajectory,
              <br />
              conviction, or market state.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <CopilotMessage key={msg.id} message={msg} />
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                color: "var(--accent)",
                letterSpacing: "0.06em",
              }}
            >
              THINKING
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    opacity: 0.4,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          marginTop: 8,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about ${asset}...`}
          disabled={loading}
          style={{
            flex: 1,
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            outline: "none",
            transition: "border-color 150ms ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background:
              loading || !input.trim()
                ? "rgba(255,255,255,0.04)"
                : "rgba(245,158,11,0.15)",
            color:
              loading || !input.trim()
                ? "var(--text-tertiary)"
                : "var(--accent)",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 150ms ease",
            flexShrink: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </div>

      {/* Clear chat */}
      {messages.length > 0 && (
        <button
          onClick={() => {
            setMessages([]);
            setInput("");
            inputRef.current?.focus();
          }}
          style={{
            marginTop: 4,
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontFamily: "var(--font-data)",
            fontSize: 9,
            textAlign: "center",
            padding: 2,
            opacity: 0.6,
            transition: "opacity 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.6";
          }}
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}
