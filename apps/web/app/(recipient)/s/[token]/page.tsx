import { cookies } from "next/headers";
import { Notice } from "@/components/ui/notice";
import { formatBytes, formatDateTime } from "@/lib/format";
import { getShareAccessCookieName } from "@/lib/auth";
import {
  findShareByToken,
  markShareOpened,
  resolveRecipientByAccessToken,
  resolveShareState,
  validateShareAccessCookie
} from "@/lib/shares";

type PageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    rt?: string;
    error?: string;
  };
};

const errorMessages: Record<string, string> = {
  invalid_link: "This secure link is invalid.",
  expired: "This share has expired.",
  revoked: "This share was revoked by the sender.",
  already_downloaded: "This share has already been downloaded.",
  password_invalid: "The share password is incorrect.",
  password_required: "Enter the share password to continue.",
  too_many_attempts: "Too many attempts were detected from this device. Try again later."
};

export default async function RecipientDownloadPage({ params, searchParams }: PageProps) {
  const share = await findShareByToken(params.token);
  const recipientAccessToken = searchParams?.rt ?? null;
  const cookieStore = cookies();

  if (!share) {
    return (
      <div className="recipient-shell">
        <div className="card panel" style={{ width: "100%", maxWidth: 720 }}>
          <div className="stack">
            <div className="pill">Secure delivery</div>
            <h1 style={{ margin: 0 }}>Invalid link</h1>
            <p className="subtitle">The share could not be found. Ask the sender to issue a new secure link.</p>
          </div>
        </div>
      </div>
    );
  }

  const recipient = resolveRecipientByAccessToken(share, recipientAccessToken);
  const state = recipient ? resolveShareState(share) : "invalid_link";
  const totalSize = share.files.reduce((total, file) => total + Number(file.sizeBytes), 0);
  const accessCookie = cookieStore.get(getShareAccessCookieName(share.id))?.value;
  const passwordSatisfied = share.passwordHash
    ? validateShareAccessCookie(accessCookie, share.id, recipient?.id ?? null)
    : true;

  if (state === "available") {
    await markShareOpened({
      share,
      recipientEmail: recipient?.email ?? null
    });
  }

  return (
    <div className="recipient-shell">
      <div className="card panel" style={{ width: "100%", maxWidth: 720 }}>
        <div className="stack">
          <div className="pill">Secure delivery</div>
          <div>
            <p className="eyebrow">Recipient View</p>
            <h1 style={{ margin: 0 }}>
              {state === "available" ? "Files ready for download" : errorMessages[state] || "Share unavailable"}
            </h1>
          </div>
          <Notice
            message={searchParams?.error ? errorMessages[searchParams.error] || searchParams.error : null}
            tone="danger"
          />
          <div className="metric-grid">
            <div className="metric">
              <strong>{share.sender.firstName || share.sender.email}</strong>
              Sent by
            </div>
            <div className="metric">
              <strong>{share.files.length}</strong>
              Files in this share
            </div>
            <div className="metric">
              <strong>{formatBytes(totalSize)}</strong>
              Total size
            </div>
            <div className="metric">
              <strong>{share.expiresAt ? formatDateTime(share.expiresAt) : "First download"}</strong>
              Expiration policy
            </div>
          </div>
          {share.message ? <p className="subtitle">{share.message}</p> : null}
          <div className="card panel">
            <div className="data-list">
              {share.files.map((file) => (
                <div key={file.id} className="list-row">
                  <div>
                    <strong>{file.originalName}</strong>
                    <div className="muted">{file.contentType || "application/octet-stream"}</div>
                  </div>
                  <div className="muted">{formatBytes(file.sizeBytes)}</div>
                </div>
              ))}
            </div>
          </div>
          {state === "available" ? (
            passwordSatisfied ? (
              <form action={`/api/recipient/${params.token}/download`} method="post">
                <input type="hidden" name="rt" value={recipientAccessToken ?? ""} />
                <button className="button button-primary" type="submit">
                  Download {share.files.length > 1 ? "all files" : "file"}
                </button>
              </form>
            ) : (
              <form action={`/api/recipient/${params.token}/unlock`} method="post" className="stack">
                <input type="hidden" name="rt" value={recipientAccessToken ?? ""} />
                <label className="field">
                  <span>Share password</span>
                  <input name="password" type="password" required />
                </label>
                <button className="button button-primary" type="submit">
                  Unlock download
                </button>
              </form>
            )
          ) : (
            <p className="subtitle">{errorMessages[state] || "This share is not available."}</p>
          )}
        </div>
      </div>
    </div>
  );
}
