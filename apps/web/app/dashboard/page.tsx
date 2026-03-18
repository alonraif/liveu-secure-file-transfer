import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, sentenceCase } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
  };
}) {
  const current = await requirePageUser();
  const [myShareCount, activeShareCount, recentShares, totalUsers, recentAuditLogs] = await Promise.all([
    prisma.share.count({
      where: {
        senderId: current.user.id
      }
    }),
    prisma.share.count({
      where: {
        senderId: current.user.id,
        revokedAt: null
      }
    }),
    prisma.share.findMany({
      where:
        current.user.role === UserRole.SUPER_ADMIN
          ? undefined
          : {
              senderId: current.user.id
            },
      include: {
        sender: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    }),
    current.user.role === UserRole.SUPER_ADMIN ? prisma.user.count() : Promise.resolve(0),
    current.user.role === UserRole.SUPER_ADMIN
      ? prisma.auditLog.findMany({
          orderBy: {
            createdAt: "desc"
          },
          take: 5
        })
      : Promise.resolve([])
  ]);

  return (
    <AppShell title="Dashboard" activeHref="/dashboard" user={current.user}>
      <div className="section-grid">
        <section className="card panel span-8 stack">
          <div>
            <p className="eyebrow">System Status</p>
            <h2 style={{ margin: 0 }}>Operational overview</h2>
          </div>
          {searchParams?.error ? <div className="notice notice-danger">{sentenceCase(searchParams.error)}</div> : null}
          <table className="table-placeholder">
            <thead>
              <tr>
                <th>Share</th>
                <th>Sender</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentShares.length === 0 ? (
                <tr>
                  <td colSpan={3}>No shares yet.</td>
                </tr>
              ) : (
                recentShares.map((share) => (
                  <tr key={share.id}>
                    <td>{share.title || share.id}</td>
                    <td>{share.sender.email}</td>
                    <td>
                      <StatusBadge value={share.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
        <section className="card panel span-4 stack">
          <div>
            <p className="eyebrow">At A Glance</p>
            <h2 style={{ margin: 0 }}>Current account scope</h2>
          </div>
          <div className="metric-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="metric">
              <strong>{myShareCount}</strong>
              Shares created by your account
            </div>
            <div className="metric">
              <strong>{activeShareCount}</strong>
              Shares currently active
            </div>
            {current.user.role === UserRole.SUPER_ADMIN ? (
              <>
                <div className="metric">
                  <strong>{totalUsers}</strong>
                  Internal users managed by the platform
                </div>
                <div className="metric">
                  <strong>{recentAuditLogs.length}</strong>
                  Recent audit events loaded below
                </div>
              </>
            ) : null}
          </div>
        </section>
        {current.user.role === UserRole.SUPER_ADMIN ? (
          <section className="card panel span-12 stack">
            <div>
              <p className="eyebrow">Audit Trail</p>
              <h2 style={{ margin: 0 }}>Recent critical events</h2>
            </div>
            <div className="data-list">
              {recentAuditLogs.map((entry) => (
                <div key={entry.id} className="list-row">
                  <div>
                    <strong>{sentenceCase(entry.eventType)}</strong>
                    <div className="muted">
                      {entry.entityType}
                      {entry.entityId ? ` • ${entry.entityId}` : ""}
                    </div>
                  </div>
                  <div className="muted">{formatDateTime(entry.createdAt)}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
