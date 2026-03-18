import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, sentenceCase } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  const current = await requirePageUser({
    role: UserRole.SUPER_ADMIN
  });

  const logs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  return (
    <AppShell title="Audit Logs" activeHref="/audit" user={current.user}>
      <section className="card panel stack">
        <div>
          <p className="eyebrow">Security Visibility</p>
          <h2 style={{ margin: 0 }}>Recent audit events</h2>
        </div>
        <div className="data-list">
          {logs.map((entry) => (
            <div key={entry.id} className="list-row">
              <div>
                <strong>{sentenceCase(entry.eventType)}</strong>
                <div className="muted">
                  {entry.entityType}
                  {entry.entityId ? ` • ${entry.entityId}` : ""}
                  {entry.actorLabel ? ` • ${entry.actorLabel}` : ""}
                </div>
              </div>
              <div className="muted">{formatDateTime(entry.createdAt)}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
