import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Notice } from "@/components/ui/notice";
import { sentenceCase } from "@/lib/format";

const errorMessages: Record<string, string> = {
  invalid_request: "Enter a valid username or email and password.",
  invalid_credentials: "Incorrect credentials.",
  account_disabled: "This account is disabled.",
  account_locked: "This account is temporarily locked.",
  rate_limited: "Too many login attempts were detected. Try again later.",
  logged_out: "You have been logged out."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    message?: string;
  };
}) {
  const current = await getCurrentUser();
  if (current) {
    redirect(current.user.forcePasswordReset ? "/profile?forceReset=1" : "/dashboard");
  }

  const message =
    (searchParams?.error && errorMessages[searchParams.error]) ||
    (searchParams?.message && errorMessages[searchParams.message]) ||
    (searchParams?.error ? sentenceCase(searchParams.error) : null);

  return (
    <div className="recipient-shell">
      <div className="card panel" style={{ width: "100%", maxWidth: 480 }}>
        <div className="stack">
          <div>
            <p className="eyebrow">Authentication</p>
            <h1 style={{ margin: 0 }}>Sign in</h1>
          </div>
          <p className="subtitle">Sign in with your internal username or email and password.</p>
          <Notice message={message} tone={searchParams?.error ? "danger" : "success"} />
          <form action="/api/auth/login" method="post" className="stack">
            <label className="field">
              <span>Email or username</span>
              <input name="identifier" aria-label="Email or username" placeholder="admin@liveu.local" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                aria-label="Password"
                placeholder="••••••••••••"
                required
              />
            </label>
            <div className="button-row">
              <button type="submit" className="button button-primary">
                Continue
              </button>
              <Link href="/" className="button button-secondary">
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
