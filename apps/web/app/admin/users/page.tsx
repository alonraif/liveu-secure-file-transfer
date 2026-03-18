import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/layout/app-shell";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { requirePageUser } from "@/lib/auth";
import { formatDateTime, formatNoticeMessage, sentenceCase } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: {
    message?: string;
    error?: string;
  };
}) {
  const current = await requirePageUser({
    role: UserRole.SUPER_ADMIN
  });

  const users = await prisma.user.findMany({
    orderBy: [
      {
        role: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return (
    <AppShell title="Users" activeHref="/admin/users" user={current.user}>
      <div className="section-grid">
        <section className="card panel span-4 stack">
          <div>
            <p className="eyebrow">Create User</p>
            <h2 style={{ margin: 0 }}>Provision an internal account</h2>
          </div>
          <Notice message={searchParams?.message ? sentenceCase(searchParams.message) : null} tone="success" />
          <Notice message={searchParams?.error ? formatNoticeMessage(searchParams.error) : null} tone="danger" />
          <form action="/api/admin/users" method="post" className="form-grid">
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" required />
            </label>
            <label className="field">
              <span>Username</span>
              <input name="username" required pattern="[A-Za-z0-9._-]+" title="Use only letters, numbers, dots, dashes, and underscores." />
            </label>
            <label className="field">
              <span>First name</span>
              <input name="firstName" />
            </label>
            <label className="field">
              <span>Last name</span>
              <input name="lastName" />
            </label>
            <label className="field">
              <span>Role</span>
              <select name="role" defaultValue="USER">
                <option value="USER">User</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </label>
            <label className="field">
              <span>Temporary password</span>
              <input name="temporaryPassword" type="password" required minLength={12} />
              <small className="muted">Use at least 12 characters with uppercase, lowercase, and a number.</small>
            </label>
            <label className="field field-full">
              <span>
                <input name="forcePasswordReset" type="checkbox" defaultChecked /> Force password reset on first login
              </span>
            </label>
            <div className="form-actions field-full">
              <button className="button button-primary" type="submit">
                Create user
              </button>
            </div>
          </form>
        </section>
        <section className="card panel span-8 stack">
          <div>
            <p className="eyebrow">Directory</p>
            <h2 style={{ margin: 0 }}>Manage existing users</h2>
          </div>
          <div className="data-list">
            {users.map((user) => (
              <div key={user.id} className="card panel stack" style={{ boxShadow: "none" }}>
                <div className="list-row" style={{ paddingTop: 0 }}>
                  <div>
                    <strong>{user.email}</strong>
                    <div className="muted">
                      @{user.username} • {user.firstName || ""} {user.lastName || ""}
                    </div>
                  </div>
                  <div className="inline-form">
                    <StatusBadge value={user.role} />
                    <StatusBadge value={user.status} />
                  </div>
                </div>
                <form action={`/api/admin/users/${user.id}`} method="post" className="form-grid">
                  <label className="field">
                    <span>Email</span>
                    <input name="email" defaultValue={user.email} required />
                  </label>
                  <label className="field">
                    <span>Username</span>
                    <input
                      name="username"
                      defaultValue={user.username}
                      required
                      pattern="[A-Za-z0-9._-]+"
                      title="Use only letters, numbers, dots, dashes, and underscores."
                    />
                  </label>
                  <label className="field">
                    <span>First name</span>
                    <input name="firstName" defaultValue={user.firstName ?? ""} />
                  </label>
                  <label className="field">
                    <span>Last name</span>
                    <input name="lastName" defaultValue={user.lastName ?? ""} />
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select name="role" defaultValue={user.role}>
                      <option value="USER">User</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <select name="status" defaultValue={user.status}>
                      <option value="ACTIVE">Active</option>
                      <option value="DISABLED">Disabled</option>
                      <option value="LOCKED">Locked</option>
                    </select>
                  </label>
                  <label className="field field-full">
                    <span>
                      <input name="forcePasswordReset" type="checkbox" defaultChecked={user.forcePasswordReset} /> Force password reset
                    </span>
                  </label>
                  <div className="form-actions field-full">
                    <button className="button button-primary" type="submit">
                      Save changes
                    </button>
                    <span className="muted">Last login: {formatDateTime(user.lastLoginAt)}</span>
                  </div>
                </form>
                <form action={`/api/admin/users/${user.id}`} method="post" className="form-grid">
                  <input type="hidden" name="_intent" value="reset-password" />
                  <label className="field">
                    <span>New temporary password</span>
                    <input name="temporaryPassword" type="password" minLength={12} required />
                    <small className="muted">Use at least 12 characters with uppercase, lowercase, and a number.</small>
                  </label>
                  <label className="field">
                    <span>
                      <input name="forcePasswordReset" type="checkbox" defaultChecked /> Force password reset after reset
                    </span>
                  </label>
                  <div className="form-actions field-full">
                    <button className="button button-secondary" type="submit">
                      Reset password
                    </button>
                    <button
                      className="button button-secondary"
                      type="submit"
                      name="_intent"
                      value="delete"
                      formNoValidate
                    >
                      Delete user
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
