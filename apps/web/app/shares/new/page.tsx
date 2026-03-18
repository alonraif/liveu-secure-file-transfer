import { AppShell } from "@/components/layout/app-shell";
import { Notice } from "@/components/ui/notice";
import { requirePageUser } from "@/lib/auth";
import { sentenceCase } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function NewSharePage({
  searchParams
}: {
  searchParams?: {
    error?: string;
  };
}) {
  const current = await requirePageUser();
  const settings = await prisma.platformSetting.findUnique({
    where: {
      id: 1
    }
  });

  return (
    <AppShell title="New Share" activeHref="/shares/new" user={current.user}>
      <div className="section-grid">
        <section className="card panel span-8 stack">
          <div>
            <p className="eyebrow">Create Share</p>
            <h2 style={{ margin: 0 }}>Upload files and generate a secure recipient link</h2>
          </div>
          <Notice message={searchParams?.error ? sentenceCase(searchParams.error) : null} tone="danger" />
          <form action="/api/shares" method="post" encType="multipart/form-data" className="form-grid">
            <label className="field">
              <span>Share title</span>
              <input name="title" placeholder="Quarterly onboarding package" />
            </label>
            <label className="field">
              <span>Expiration mode</span>
              <select name="expirationMode" defaultValue="DAYS">
                <option value="DAYS">Expire after X days</option>
                <option value="FIRST_DOWNLOAD">Expire after first successful download</option>
              </select>
            </label>
            <label className="field">
              <span>Expiration days</span>
              <input
                name="expirationDays"
                type="number"
                min={1}
                max={365}
                defaultValue={settings?.defaultShareExpirationDays ?? 7}
              />
            </label>
            <label className="field">
              <span>Optional share password</span>
              <input name="sharePassword" type="password" />
            </label>
            <label className="field field-full">
              <span>Recipients</span>
              <textarea
                name="recipients"
                placeholder="customer.one@example.com, customer.two@example.com"
                required
              />
            </label>
            <label className="field field-full">
              <span>Optional message</span>
              <textarea name="message" placeholder="Please download these files before Friday." />
            </label>
            <label className="field field-full">
              <span>Files</span>
              <input name="files" type="file" multiple required />
            </label>
            <div className="form-actions field-full">
              <button className="button button-primary" type="submit">
                Create secure share
              </button>
            </div>
          </form>
        </section>
        <section className="card panel span-4 stack">
          <div>
            <p className="eyebrow">Policy Snapshot</p>
            <h2 style={{ margin: 0 }}>Current platform defaults</h2>
          </div>
          <div className="metric-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="metric">
              <strong>{settings?.defaultShareExpirationDays ?? 7} days</strong>
              Default expiration window
            </div>
            <div className="metric">
              <strong>{Number(settings?.maxFileSizeBytes ?? BigInt(1_073_741_824)) / 1024 / 1024} MB</strong>
              Maximum file size per upload
            </div>
            <div className="metric">
              <strong>{settings?.retentionDays ?? 30} days</strong>
              Retention after expiration
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
