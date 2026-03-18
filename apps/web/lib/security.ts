import { AuditActorType, AuditEventType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { getClientIp, getOriginFromRequest, getUserAgent } from "@/lib/request";

function normalizeOrigin(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function isTrustedOrigin(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  const referer = normalizeOrigin(request.headers.get("referer"));
  const expected = getOriginFromRequest(request);

  if (!expected) {
    return false;
  }

  return origin === expected || referer === expected;
}

export async function rejectUntrustedOrigin(request: NextRequest, context?: {
  actorUserId?: string | null;
  actorLabel?: string | null;
  entityType?: string;
  entityId?: string | null;
}) {
  await createAuditLog({
    actorType: context?.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
    actorUserId: context?.actorUserId ?? null,
    actorLabel: context?.actorLabel ?? null,
    eventType: AuditEventType.CSRF_BLOCKED,
    entityType: context?.entityType ?? "Request",
    entityId: context?.entityId ?? null,
    metadata: {
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      path: request.nextUrl.pathname
    },
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function enforceLoginRateLimit(request: NextRequest) {
  const ipAddress = getClientIp(request);
  if (!ipAddress) {
    return false;
  }

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const failures = await prisma.auditLog.count({
    where: {
      ipAddress,
      createdAt: {
        gte: since
      },
      eventType: {
        in: [AuditEventType.ADMIN_LOGIN_FAILED, AuditEventType.USER_LOGIN_FAILED]
      }
    }
  });

  return failures >= 10;
}

export async function enforceRecipientRateLimit(request: NextRequest, shareId: string) {
  const ipAddress = getClientIp(request);
  if (!ipAddress) {
    return false;
  }

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const attempts = await prisma.shareAccessEvent.count({
    where: {
      shareId,
      ipAddress,
      createdAt: {
        gte: since
      }
    }
  });

  return attempts >= 30;
}
