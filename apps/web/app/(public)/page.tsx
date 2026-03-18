import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="pill">Internal delivery platform</div>
        <div className="button-row">
          <Link href="/login" className="button button-secondary">
            Admin Login
          </Link>
        </div>
      </header>
      <section className="hero">
        <div className="stack">
          <div className="pill">Phase 1-2 foundation</div>
          <h1 className="title">Secure external delivery with internal control.</h1>
          <p className="subtitle">
            A Docker-first platform for authenticated staff to send files to
            customers through expiring, auditable, branded download links.
          </p>
          <div className="button-row">
            <Link href="/dashboard" className="button button-primary">
              Open Console
            </Link>
            <Link href="/login" className="button button-secondary">
              View Login
            </Link>
          </div>
        </div>
        <div className="card panel stack">
          <div>
            <p className="eyebrow">Container Topology</p>
            <h2 style={{ margin: 0 }}>Web, worker, Postgres, MinIO, Mailpit, Caddy</h2>
          </div>
          <div className="metric-grid">
            <div className="metric">
              <strong>HTTPS-ready</strong>
              Reverse proxy and certificate state are isolated in Caddy.
            </div>
            <div className="metric">
              <strong>Auditable</strong>
              Prisma models cover shares, recipients, files, logs, and settings.
            </div>
            <div className="metric">
              <strong>Portable</strong>
              Local and production Compose flows share the same service model.
            </div>
            <div className="metric">
              <strong>Extensible</strong>
              Storage, email, and worker orchestration are abstracted early.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
