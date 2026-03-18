import { AppShell } from "@/components/layout/app-shell";
import { Notice } from "@/components/ui/notice";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatNoticeMessage, sentenceCase } from "@/lib/format";

export default async function ProfilePage({
  searchParams
}: {
  searchParams?: {
    message?: string;
    error?: string;
    forceReset?: string;
  };
}) {
  const current = await requirePageUser({
    allowForcedPasswordReset: true
  });

  return (
    <AppShell title="Profile" activeHref="/profile" user={current.user}>
      <div className="section-grid">
        <section className="card panel span-4 stack">
          <div>
            <p className="eyebrow">Identity</p>
            <h2 style={{ margin: 0 }}>Account overview</h2>
          </div>
          <div className="metric-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="metric">
              <strong>{current.user.email}</strong>
              Email
            </div>
            <div className="metric">
              <strong>@{current.user.username}</strong>
              Username
            </div>
            <div className="metric">
              <strong>{current.user.role === "SUPER_ADMIN" ? "Super Admin" : "User"}</strong>
              Role
            </div>
            <div className="metric">
              <strong>{formatDateTime(current.user.lastLoginAt)}</strong>
              Last login
            </div>
          </div>
        </section>
        <section className="card panel span-8 stack">
          <div>
            <p className="eyebrow">Password</p>
            <h2 style={{ margin: 0 }}>Change your password</h2>
          </div>
          <Notice
            message={
              searchParams?.forceReset
                ? "Your account requires a password reset before you continue."
                : searchParams?.message
                  ? sentenceCase(searchParams.message)
                  : null
            }
            tone="success"
          />
          <Notice message={searchParams?.error ? formatNoticeMessage(searchParams.error) : null} tone="danger" />
          <form action="/api/profile/password" method="post" className="form-grid">
            <label className="field field-full">
              <span>Current password</span>
              <input name="currentPassword" type="password" required />
            </label>
            <label className="field">
              <span>New password</span>
              <input name="newPassword" type="password" minLength={12} required />
              <small className="muted">Use at least 12 characters with uppercase, lowercase, and a number.</small>
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" minLength={12} required />
            </label>
            <div className="form-actions field-full">
              <button className="button button-primary" type="submit">
                Update password
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
