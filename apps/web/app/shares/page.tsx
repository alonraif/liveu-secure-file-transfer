import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { getFlashShareLink } from "@/lib/flash";
import { formatBytes, formatDateTime, sentenceCase } from "@/lib/format";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SharesPage({
  searchParams
}: {
  searchParams?: {
    message?: string;
    error?: string;
  };
}) {
  const current = await requirePageUser();
  const flashShareLink = await getFlashShareLink();
  const shares = await prisma.share.findMany({
    where:
      current.user.role === UserRole.SUPER_ADMIN
        ? undefined
        : {
            senderId: current.user.id
          },
    include: {
      recipients: true,
      files: true,
      sender: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    <AppShell title="My Shares" activeHref="/shares" user={current.user}>
      <div className="stack">
        <Notice message={searchParams?.message ? sentenceCase(searchParams.message) : null} tone="success" />
        <Notice message={searchParams?.error ? sentenceCase(searchParams.error) : null} tone="danger" />
        {flashShareLink ? (
          <div className="notice notice-success">
            Latest generated link:
            <div style={{ marginTop: 8 }}>
              <code>{flashShareLink}</code>
            </div>
          </div>
        ) : null}
        <div className="data-list">
          {shares.length === 0 ? (
            <div className="card panel">No shares created yet.</div>
          ) : (
            shares.map((share) => {
              const totalSize = share.files.reduce((sum, file) => sum + Number(file.sizeBytes), 0);

              return (
                <div key={share.id} className="card panel stack">
                  <div className="list-row" style={{ paddingTop: 0 }}>
                    <div>
                      <strong>{share.title || share.id}</strong>
                      <div className="muted">
                        Sender: {share.sender.email} • Created {formatDateTime(share.createdAt)}
                      </div>
                    </div>
                    <div className="inline-form">
                      <StatusBadge value={share.status} />
                      <form action={`/api/shares/${share.id}/revoke`} method="post">
                        <button className="button button-secondary" type="submit">
                          Revoke
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className="metric-grid">
                    <div className="metric">
                      <strong>{share.recipients.length}</strong>
                      Recipients
                    </div>
                    <div className="metric">
                      <strong>{share.files.length}</strong>
                      Files
                    </div>
                    <div className="metric">
                      <strong>{formatBytes(totalSize)}</strong>
                      Total size
                    </div>
                    <div className="metric">
                      <strong>{share.expiresAt ? formatDateTime(share.expiresAt) : "First download"}</strong>
                      Expiration
                    </div>
                  </div>
                  <div className="data-list">
                    <div>
                      <strong>Recipients</strong>
                      <div className="muted">{share.recipients.map((recipient) => recipient.email).join(", ")}</div>
                    </div>
                    <div>
                      <strong>Files</strong>
                      <div className="muted">{share.files.map((file) => file.originalName).join(", ")}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
