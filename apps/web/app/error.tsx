"use client";

import Link from "next/link";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="recipient-shell">
      <div className="card panel" style={{ width: "100%", maxWidth: 640 }}>
        <div className="stack">
          <div className="pill">Application Error</div>
          <h1 style={{ margin: 0 }}>Something went wrong.</h1>
          <p className="subtitle">{error.message || "Unexpected application error."}</p>
          <div className="button-row">
            <button type="button" onClick={() => reset()} className="button button-primary">
              Retry
            </button>
            <Link href="/" className="button button-secondary">
              Return home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
