import { NextRequest, NextResponse } from "next/server";
import { AuditActorType, AuditEventType, UserRole } from "@prisma/client";
import { getValidationErrorMessage, resetPasswordSchema, updateUserSchema } from "@/lib/validation";
import { createAuditLog } from "@/lib/audit";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { hashPassword, requireRouteUser, revokeUserSessions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

function toBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

type Params = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: Params) {
  const current = await requireRouteUser(request, {
    role: UserRole.SUPER_ADMIN
  });

  if (!current) {
    return NextResponse.redirect(getPublicUrl(request, "/login"));
  }

  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      actorUserId: current.user.id,
      actorLabel: current.user.email,
      entityType: "User",
      entityId: params.id
    });
  }

  const formData = await request.formData();
  const intent = String(formData.get("_intent") ?? "update");
  const redirectUrl = getPublicUrl(request, "/admin/users");

  if (intent === "delete") {
    if (current.user.id === params.id) {
      redirectUrl.searchParams.set("error", "cannot_delete_self");
      return NextResponse.redirect(redirectUrl);
    }

    try {
      await revokeUserSessions(params.id);
      await prisma.user.delete({
        where: { id: params.id }
      });

      await createAuditLog({
        actorType: AuditActorType.USER,
        actorUserId: current.user.id,
        actorLabel: current.user.email,
        eventType: AuditEventType.USER_DELETED,
        entityType: "User",
        entityId: params.id,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request)
      });

      redirectUrl.searchParams.set("message", "user_deleted");
      return NextResponse.redirect(redirectUrl);
    } catch {
      redirectUrl.searchParams.set("error", "user_delete_failed");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (intent === "reset-password") {
    const parsed = resetPasswordSchema.safeParse({
      temporaryPassword: formData.get("temporaryPassword"),
      forcePasswordReset: toBoolean(formData.get("forcePasswordReset"))
    });

    if (!parsed.success) {
      redirectUrl.searchParams.set("error", getValidationErrorMessage(parsed.error));
      return NextResponse.redirect(redirectUrl);
    }

    await prisma.user.update({
      where: { id: params.id },
      data: {
        passwordHash: await hashPassword(parsed.data.temporaryPassword),
        forcePasswordReset: parsed.data.forcePasswordReset
      }
    });
    await revokeUserSessions(params.id);

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: current.user.id,
      actorLabel: current.user.email,
      eventType: AuditEventType.PASSWORD_RESET,
      entityType: "User",
      entityId: params.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });

    redirectUrl.searchParams.set("message", "password_reset");
    return NextResponse.redirect(redirectUrl);
  }

  const parsed = updateUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    role: formData.get("role"),
    status: formData.get("status"),
    forcePasswordReset: toBoolean(formData.get("forcePasswordReset"))
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", getValidationErrorMessage(parsed.error));
    return NextResponse.redirect(redirectUrl);
  }

  if (current.user.id === params.id && parsed.data.status !== "ACTIVE") {
    redirectUrl.searchParams.set("error", "cannot_disable_self");
    return NextResponse.redirect(redirectUrl);
  }

  await prisma.user.update({
    where: { id: params.id },
    data: {
      email: parsed.data.email.toLowerCase(),
      username: parsed.data.username.toLowerCase(),
      firstName: parsed.data.firstName || null,
      lastName: parsed.data.lastName || null,
      role: parsed.data.role,
      status: parsed.data.status,
      disabledAt: parsed.data.status === "DISABLED" ? new Date() : null,
      forcePasswordReset: parsed.data.forcePasswordReset
    }
  });

  if (parsed.data.status !== "ACTIVE") {
    await revokeUserSessions(params.id);
  }

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorUserId: current.user.id,
    actorLabel: current.user.email,
    eventType:
      parsed.data.status === "DISABLED" ? AuditEventType.USER_DISABLED : AuditEventType.USER_UPDATED,
    entityType: "User",
    entityId: params.id,
    metadata: {
      status: parsed.data.status,
      role: parsed.data.role
    },
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  redirectUrl.searchParams.set("message", "user_updated");
  return NextResponse.redirect(redirectUrl);
}
