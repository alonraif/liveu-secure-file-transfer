import { NextRequest, NextResponse } from "next/server";
import { AuditActorType, AuditEventType, UserRole } from "@prisma/client";
import { createUserSchema, getValidationErrorMessage } from "@/lib/validation";
import { createAuditLog } from "@/lib/audit";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { hashPassword, requireRouteUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

function toBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

export async function GET(request: NextRequest) {
  const current = await requireRouteUser(request, {
    role: UserRole.SUPER_ADMIN
  });

  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      forcePasswordReset: true,
      lastLoginAt: true,
      createdAt: true
    }
  });

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
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
      entityType: "User"
    });
  }

  const formData = await request.formData();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    role: formData.get("role"),
    temporaryPassword: formData.get("temporaryPassword"),
    forcePasswordReset: toBoolean(formData.get("forcePasswordReset"))
  });

  const redirectUrl = getPublicUrl(request, "/admin/users");
  if (!parsed.success) {
    redirectUrl.searchParams.set("error", getValidationErrorMessage(parsed.error));
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const created = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        username: parsed.data.username.toLowerCase(),
        firstName: parsed.data.firstName || null,
        lastName: parsed.data.lastName || null,
        role: parsed.data.role,
        forcePasswordReset: parsed.data.forcePasswordReset,
        passwordHash: await hashPassword(parsed.data.temporaryPassword)
      }
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: current.user.id,
      actorLabel: current.user.email,
      eventType: AuditEventType.USER_CREATED,
      entityType: "User",
      entityId: created.id,
      metadata: {
        createdUserEmail: created.email
      },
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });

    redirectUrl.searchParams.set("message", "user_created");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set("error", "user_create_failed");
    return NextResponse.redirect(redirectUrl);
  }
}
