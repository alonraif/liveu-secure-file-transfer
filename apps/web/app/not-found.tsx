import Link from "next/link";

export default function NotFound() {
  return (
    <div className="recipient-shell">
      <div className="card panel" style={{ width: "100%", maxWidth: 640 }}>
        <div className="stack">
          <div className="pill">Not Found</div>
          <h1 style={{ margin: 0 }}>The requested page could not be found.</h1>
          <p className="subtitle">Use the main entry point to continue navigating the platform.</p>
          <Link href="/" className="button button-primary">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
