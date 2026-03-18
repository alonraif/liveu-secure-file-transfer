import { AuditActorType, AuditEventType, Prisma, ShareExpirationMode, ShareStatus } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256, signValue, constantTimeEqual } from "@/lib/crypto";
import { createAuditLog, createShareAccessEvent } from "@/lib/audit";
import { env } from "@/lib/env";

export type ShareWithRelations = Prisma.ShareGetPayload<{
  include: {
    sender: true;
    recipients: true;
    files: true;
  };
}>;

export async function createShareAccessCookieValue(shareId: string) {
  return createRecipientBoundShareAccessCookieValue(shareId, null);
}

export async function createRecipientBoundShareAccessCookieValue(shareId: string, recipientId: string | null) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${shareId}.${recipientId ?? "public"}.${expiresAt}`;
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

export function validateShareAccessCookie(value: string | undefined, shareId: string, recipientId: string | null) {
  if (!value) {
    return false;
  }

  const [cookieShareId, cookieRecipientId, expiresAt, signature] = value.split(".");
  if (!cookieShareId || !cookieRecipientId || !expiresAt || !signature) {
    return false;
  }

  const payload = `${cookieShareId}.${cookieRecipientId}.${expiresAt}`;
  if (!constantTimeEqual(signature, signValue(payload))) {
    return false;
  }

  if (cookieShareId !== shareId) {
    return false;
  }

  if (cookieRecipientId !== (recipientId ?? "public")) {
    return false;
  }

  return Number(expiresAt) > Date.now();
}

export function createShareToken() {
  const token = randomToken(24);
  return {
    raw: token,
    hash: sha256(token)
  };
}

export function createRecipientAccessToken() {
  const token = randomToken(18);
  return {
    raw: token,
    hash: sha256(token)
  };
}

export async function hashOptionalPassword(password?: string | null) {
  if (!password) {
    return null;
  }

  return hash(password);
}

export async function verifySharePassword(passwordHash: string | null, password: string) {
  if (!passwordHash) {
    return true;
  }

  return verify(passwordHash, password);
}

export function resolveShareState(share: Pick<ShareWithRelations, "status" | "expiresAt" | "revokedAt" | "downloadCount" | "expirationMode" | "maxDownloads">) {
  if (share.revokedAt || share.status === ShareStatus.REVOKED) {
    return "revoked" as const;
  }

  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
    return "expired" as const;
  }

  const maxDownloads = share.expirationMode === ShareExpirationMode.FIRST_DOWNLOAD ? 1 : share.maxDownloads;
  if (maxDownloads && share.downloadCount >= maxDownloads) {
    return "already_downloaded" as const;
  }

  return "available" as const;
}

export async function findShareByToken(rawToken: string) {
  return prisma.share.findFirst({
    where: {
      tokenHash: sha256(rawToken)
    },
    include: {
      sender: true,
      recipients: true,
      files: {
        where: {
          status: "ACTIVE"
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export function resolveRecipientByAccessToken(
  share: NonNullable<Awaited<ReturnType<typeof findShareByToken>>>,
  rawRecipientToken: string | null
) {
  if (!rawRecipientToken) {
    return null;
  }

  const tokenHash = sha256(rawRecipientToken);
  return share.recipients.find((recipient) => recipient.accessTokenHash === tokenHash) ?? null;
}

export async function markShareOpened(input: {
  share: ShareWithRelations;
  recipientEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    if (!input.share.openedAt) {
      await tx.share.update({
        where: { id: input.share.id },
        data: {
          openedAt: new Date(),
          status: ShareStatus.OPENED
        }
      });
    }

    if (input.recipientEmail) {
      await tx.shareRecipient.updateMany({
        where: {
          shareId: input.share.id,
          email: input.recipientEmail
        },
        data: {
          openedAt: new Date()
        }
      });
    }
  });

  await createShareAccessEvent({
    shareId: input.share.id,
    recipientEmail: input.recipientEmail,
    eventType: AuditEventType.LINK_OPENED,
    allowed: true,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });
}

export async function markShareDenied(input: {
  shareId: string;
  recipientEmail?: string | null;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await createShareAccessEvent({
    shareId: input.shareId,
    recipientEmail: input.recipientEmail,
    eventType: AuditEventType.DOWNLOAD_DENIED,
    allowed: false,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });

  await createAuditLog({
    actorType: AuditActorType.RECIPIENT,
    actorLabel: input.recipientEmail ?? "public-recipient",
    eventType: AuditEventType.DOWNLOAD_DENIED,
    entityType: "Share",
    entityId: input.shareId,
    metadata: {
      reason: input.reason
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });
}

export function buildRecipientLink(token: string, recipientAccessToken?: string | null) {
  const url = new URL(`/s/${token}`, env.APP_PUBLIC_URL);

  if (recipientAccessToken) {
    url.searchParams.set("rt", recipientAccessToken);
  }

  return url.toString();
}
