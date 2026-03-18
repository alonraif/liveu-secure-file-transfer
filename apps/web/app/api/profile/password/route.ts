import { NextRequest, NextResponse } from "next/server";
import { AuditActorType, AuditEventType } from "@prisma/client";
import { changePasswordSchema, getValidationErrorMessage } from "@/lib/validation";
import { createAuditLog } from "@/lib/audit";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { createSession, hashPassword, requireRouteUser, revokeUserSessions, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/constants";
import { env } from "@/lib/env";
import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      entityType: "User"
    });
  }

  const current = await requireRouteUser(request, {
    allowForcedPasswordReset: true
  });

  if (!current) {
    return NextResponse.redirect(getPublicUrl(request, "/login"));
  }

  const formData = await request.formData();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword")
  });

  const redirectUrl = getPublicUrl(request, "/profile");

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", getValidationErrorMessage(parsed.error));
    return NextResponse.redirect(redirectUrl);
  }

  const passwordMatches = await verifyPassword(current.user.passwordHash, parsed.data.currentPassword);
  if (!passwordMatches) {
    redirectUrl.searchParams.set("error", "current_password_incorrect");
    return NextResponse.redirect(redirectUrl);
  }

  await prisma.user.update({
    where: { id: current.user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      forcePasswordReset: false
    }
  });

  await revokeUserSessions(current.user.id);
  const freshSession = await createSession({
    userId: current.user.id,
    request
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorUserId: current.user.id,
    actorLabel: current.user.email,
    eventType: AuditEventType.PASSWORD_CHANGE,
    entityType: "User",
    entityId: current.user.id,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  redirectUrl.searchParams.set("message", "password_updated");
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(SESSION_COOKIE_NAME, freshSession.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)
  });
  return response;
}
