"use client";

export default function AnalyzeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto px-4 text-center" style={{ maxWidth: 480, paddingTop: 64, paddingBottom: 64 }}>
      <div className="card animate-fade-up" style={{ padding: 32 }}>
        <div className="form-label" style={{ marginBottom: 12, color: "var(--accent-warn)" }}>
          ANALYSIS ERROR
        </div>
        <p style={{ fontFamily: "var(--font-data)", fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          {error.message || "Failed to load analysis data."}
        </p>
        <button onClick={reset} className="btn-primary">
          RETRY
        </button>
      </div>
    </div>
  );
}
