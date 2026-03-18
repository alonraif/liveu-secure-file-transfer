import { NextRequest, NextResponse } from "next/server";
import { AuditActorType, AuditEventType, ShareStatus, UserRole } from "@prisma/client";
import { requireRouteUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, { params }: Params) {
  const current = await requireRouteUser(request);
  if (!current) {
    return NextResponse.redirect(getPublicUrl(request, "/login"));
  }

  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      actorUserId: current.user.id,
      actorLabel: current.user.email,
      entityType: "Share",
      entityId: params.id
    });
  }

  const share = await prisma.share.findUnique({
    where: {
      id: params.id
    }
  });

  if (!share) {
    return NextResponse.redirect(getPublicUrl(request, "/shares?error=share_not_found"));
  }

  const canRevoke = current.user.role === UserRole.SUPER_ADMIN || share.senderId === current.user.id;
  if (!canRevoke) {
    return NextResponse.redirect(getPublicUrl(request, "/shares?error=forbidden"));
  }

  await prisma.share.update({
    where: {
      id: share.id
    },
    data: {
      status: ShareStatus.REVOKED,
      revokedAt: new Date(),
      revokedByUserId: current.user.id
    }
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorUserId: current.user.id,
    actorLabel: current.user.email,
    eventType: AuditEventType.SHARE_REVOKED,
    entityType: "Share",
    entityId: share.id,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  return NextResponse.redirect(getPublicUrl(request, "/shares?message=share_revoked"));
}
