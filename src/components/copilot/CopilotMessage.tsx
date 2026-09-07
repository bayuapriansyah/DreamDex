"use client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function CopilotMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: isUser ? "flex-end" : "flex-start",
      }}
    >
      {/* Role label + timestamp */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 2px",
        }}
      >
        {!isUser && (
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent-secondary)",
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: isUser ? "var(--text-tertiary)" : "var(--accent-secondary)",
          }}
        >
          {isUser ? "You" : "Copilot"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 8,
            color: "var(--text-tertiary)",
            opacity: 0.5,
          }}
        >
          {time}
        </span>
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "88%",
          padding: "8px 10px",
          borderRadius: isUser
            ? "var(--radius-md) var(--radius-md) 2px var(--radius-md)"
            : "var(--radius-md) var(--radius-md) var(--radius-md) 2px",
          background: isUser
            ? "var(--surface-3)"
            : "var(--accent-secondary-muted)",
          border: `1px solid ${
            isUser ? "var(--border)" : "rgba(56, 189, 248, 0.12)"
          }`,
          fontFamily: "var(--font-body)",
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--text-primary)",
          wordBreak: "break-word",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
