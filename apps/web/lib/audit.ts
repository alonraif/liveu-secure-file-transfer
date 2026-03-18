import { AuditActorType, AuditEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorType: AuditActorType;
  actorUserId?: string | null;
  actorLabel?: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null
    }
  });
}

export async function createShareAccessEvent(input: {
  shareId: string;
  recipientEmail?: string | null;
  eventType: AuditEventType;
  allowed: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.shareAccessEvent.create({
    data: {
      shareId: input.shareId,
      recipientEmail: input.recipientEmail ?? null,
      eventType: input.eventType,
      allowed: input.allowed,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null
    }
  });
}
