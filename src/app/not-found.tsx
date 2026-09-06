import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto px-4 text-center" style={{ maxWidth: 480, paddingTop: 64, paddingBottom: 64 }}>
      <div className="card animate-fade-up" style={{ padding: 32 }}>
        <div className="form-label" style={{ marginBottom: 12, color: "var(--accent-warn)" }}>
          404
        </div>
        <p style={{ fontFamily: "var(--font-data)", fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          Page not found.
        </p>
        <Link href="/" className="btn-primary" style={{ textDecoration: "none" }}>
          RETURN HOME
        </Link>
      </div>
    </div>
  );
}
