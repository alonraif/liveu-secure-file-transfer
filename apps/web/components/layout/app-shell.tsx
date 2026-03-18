import Link from "next/link";
import { UserRole } from "@prisma/client";

type ShellUser = {
  email: string;
  username: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
};

function buildNav(role: UserRole) {
  const common = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/shares/new", label: "New Share" },
    { href: "/shares", label: "My Shares" },
    { href: "/profile", label: "Profile" }
  ];

  if (role === UserRole.SUPER_ADMIN) {
    return [...common, { href: "/admin/users", label: "Users" }, { href: "/audit", label: "Audit Logs" }];
  }

  return common;
}

export function AppShell({
  title,
  activeHref,
  user,
  children
}: {
  title: string;
  activeHref: string;
  user: ShellUser;
  children: React.ReactNode;
}) {
  const navItems = buildNav(user.role);
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="pill">LiveU Secure File Transfer</div>
        <div className="nav-list">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${activeHref === item.href ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </aside>
      <main className="content">
        <div className="content-topbar">
          <div>
            <p className="eyebrow">Operational Console</p>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="user-chip">
              <strong>{name}</strong>
              <span>{user.role === UserRole.SUPER_ADMIN ? "Super Admin" : "User"}</span>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="button button-secondary" type="submit">
                Logout
              </button>
            </form>
          </div>
        </div>
        <div style={{ height: 24 }} />
        {children}
      </main>
    </div>
  );
}
