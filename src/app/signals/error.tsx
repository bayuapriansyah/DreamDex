"use client";

export default function SignalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="mx-auto px-4 text-center"
      style={{ maxWidth: 1100, paddingTop: 80 }}
    >
      <div className="card" style={{ padding: 48 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
          Signals Unavailable
        </div>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          {error.message || "Failed to load temporal signals."}
        </p>
        <button onClick={reset} className="btn-primary">
          Try Again
        </button>
      </div>
    </div>
  );
}
