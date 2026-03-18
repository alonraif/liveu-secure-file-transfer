import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/constants";
import {
  createRecipientBoundShareAccessCookieValue,
  findShareByToken,
  markShareDenied,
  resolveRecipientByAccessToken,
  resolveShareState,
  verifySharePassword
} from "@/lib/shares";
import { getShareAccessCookieName } from "@/lib/auth";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { enforceRecipientRateLimit, isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

type Params = {
  params: {
    token: string;
  };
};

export async function POST(request: NextRequest, { params }: Params) {
  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      entityType: "Share"
    });
  }

  const share = await findShareByToken(params.token);
  const redirectUrl = getPublicUrl(request, `/s/${params.token}`);
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const recipientAccessToken = String(formData.get("rt") ?? "") || null;

  if (recipientAccessToken) {
    redirectUrl.searchParams.set("rt", recipientAccessToken);
  }

  if (!share) {
    redirectUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(redirectUrl);
  }

  if (await enforceRecipientRateLimit(request, share.id)) {
    redirectUrl.searchParams.set("error", "too_many_attempts");
    return NextResponse.redirect(redirectUrl);
  }

  const recipient = resolveRecipientByAccessToken(share, recipientAccessToken);
  if (!recipient) {
    await markShareDenied({
      shareId: share.id,
      reason: "invalid_recipient_token",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    redirectUrl.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(redirectUrl);
  }

  const state = resolveShareState(share);
  if (state !== "available") {
    await markShareDenied({
      shareId: share.id,
      recipientEmail: recipient.email,
      reason: state,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    redirectUrl.searchParams.set("error", state);
    return NextResponse.redirect(redirectUrl);
  }

  const passwordMatches = await verifySharePassword(share.passwordHash, password);
  if (!passwordMatches) {
    await markShareDenied({
      shareId: share.id,
      recipientEmail: recipient.email,
      reason: "password_invalid",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    redirectUrl.searchParams.set("error", "password_invalid");
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(
    getShareAccessCookieName(share.id),
    await createRecipientBoundShareAccessCookieValue(share.id, recipient.id),
    {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 24 * 60 * 60
    }
  );

  return response;
}
