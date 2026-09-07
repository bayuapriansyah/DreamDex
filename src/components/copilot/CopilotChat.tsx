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
            ? data.explanation.summary
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
                borderRadius: "var(--radius-full)",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-data)",
                fontSize: 9,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                transition: "all var(--duration-normal) var(--ease-out)",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-secondary-muted)";
                e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.2)";
                e.currentTarget.style.color = "var(--accent-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-3)";
                e.currentTarget.style.borderColor = "var(--border)";
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
          gap: 12,
          padding: "4px 0",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--surface-4) transparent",
        }}
      >
        {messages.length === 0 && !loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 0",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 18,
                  marginBottom: 6,
                  opacity: 0.3,
                }}
              >
                ◈
              </div>
              <p
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                  lineHeight: 1.6,
                }}
              >
                Ask about {asset} trajectory,
                <br />
                conviction, or market state.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <CopilotMessage key={msg.id} message={msg} />
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--accent-secondary)",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--accent-secondary)",
                letterSpacing: "0.1em",
              }}
            >
              THINKING
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    background: "var(--accent-secondary)",
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
          borderTop: "1px solid var(--border)",
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
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            outline: "none",
            transition: "border-color var(--duration-normal) var(--ease-out)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(56, 189, 248, 0.3)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        />
        <button
          onClick={() => void sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-sm)",
            border: "1px solid",
            borderColor:
              loading || !input.trim() ? "var(--border)" : "rgba(56, 189, 248, 0.2)",
            background:
              loading || !input.trim() ? "var(--surface-2)" : "var(--accent-secondary-muted)",
            color:
              loading || !input.trim()
                ? "var(--text-tertiary)"
                : "var(--accent-secondary)",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all var(--duration-normal) var(--ease-out)",
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
            marginTop: 6,
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontFamily: "var(--font-data)",
            fontSize: 9,
            fontWeight: 600,
            textAlign: "center",
            padding: 4,
            opacity: 0.5,
            transition: "opacity var(--duration-normal) var(--ease-out)",
            letterSpacing: "0.04em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.5";
          }}
        >
          CLEAR CONVERSATION
        </button>
      )}
    </div>
  );
}
