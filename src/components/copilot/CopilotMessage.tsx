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
        gap: 3,
        alignItems: isUser ? "flex-end" : "flex-start",
      }}
    >
      {/* Role label */}
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: isUser ? "var(--text-tertiary)" : "var(--accent)",
          padding: "0 2px",
        }}
      >
        {isUser ? "You" : "Copilot"}
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: "90%",
          padding: "8px 10px",
          borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
          background: isUser
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(245, 158, 11, 0.08)",
          border: `1px solid ${
            isUser ? "rgba(255, 255, 255, 0.08)" : "rgba(245, 158, 11, 0.15)"
          }`,
          fontFamily: "var(--font-body)",
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--text-primary)",
          wordBreak: "break-word",
        }}
      >
        {message.content}
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 8,
          color: "var(--text-tertiary)",
          padding: "0 2px",
          opacity: 0.6,
        }}
      >
        {time}
      </div>
    </div>
  );
}
