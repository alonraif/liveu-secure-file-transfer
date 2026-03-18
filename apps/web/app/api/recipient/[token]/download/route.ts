import archiver from "archiver";
import { AuditActorType, AuditEventType, Prisma, ShareStatus } from "@prisma/client";
import { Readable, PassThrough } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { getShareAccessCookieName } from "@/lib/auth";
import { createAuditLog, createShareAccessEvent } from "@/lib/audit";
import {
  findShareByToken,
  markShareDenied,
  resolveRecipientByAccessToken,
  resolveShareState,
  validateShareAccessCookie
} from "@/lib/shares";
import { getObjectStream } from "@/lib/storage";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { enforceRecipientRateLimit, isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

type Params = {
  params: {
    token: string;
  };
};

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.\-]+/g, "_");
}

async function buildArchiveResponse(share: NonNullable<Awaited<ReturnType<typeof findShareByToken>>>) {
  const archive = archiver("zip", {
    zlib: { level: 9 }
  });
  const output = new PassThrough();
  archive.pipe(output);

  for (const file of share.files) {
    const object = await getObjectStream(file.objectKey);
    archive.append(object.body, {
      name: sanitizeFilename(file.originalName)
    });
  }

  void archive.finalize();

  return new Response(Readable.toWeb(output) as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${sanitizeFilename(
        (share.title || "secure-share") + ".zip"
      )}"`
    }
  });
}

async function buildSingleFileResponse(share: NonNullable<Awaited<ReturnType<typeof findShareByToken>>>) {
  const file = share.files[0];
  const object = await getObjectStream(file.objectKey);
  return new Response(Readable.toWeb(object.body) as unknown as BodyInit, {
    headers: {
      "content-type": object.contentType,
      "content-disposition": `attachment; filename="${sanitizeFilename(file.originalName)}"`
    }
  });
}

async function consumeDownload(
  tx: Prisma.TransactionClient,
  share: NonNullable<Awaited<ReturnType<typeof findShareByToken>>>,
  recipientId: string
) {
  const now = new Date();
  const updateResult = await tx.share.updateMany({
    where: {
      id: share.id,
      revokedAt: null,
      status: {
        not: ShareStatus.REVOKED
      },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(share.expirationMode === "FIRST_DOWNLOAD"
        ? {
            downloadCount: 0
          }
        : share.maxDownloads
          ? {
              downloadCount: {
                lt: share.maxDownloads
              }
            }
          : {})
    },
    data: {
      downloadCount: {
        increment: 1
      },
      status: ShareStatus.DOWNLOADED,
      firstDownloadedAt: share.firstDownloadedAt ?? now,
      lastDownloadedAt: now
    }
  });

  if (updateResult.count !== 1) {
    return false;
  }

  await tx.shareRecipient.update({
    where: {
      id: recipientId
    },
    data: {
      downloadedAt: now
    }
  });

  return true;
}

export async function GET(request: NextRequest, { params }: Params) {
  const url = getPublicUrl(request, `/s/${params.token}`);
  if (request.nextUrl.searchParams.get("rt")) {
    url.searchParams.set("rt", request.nextUrl.searchParams.get("rt")!);
  }

  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      entityType: "Share"
    });
  }

  const share = await findShareByToken(params.token);

  if (!share) {
    return NextResponse.redirect(getPublicUrl(request, `/s/${params.token}?error=invalid_link`));
  }

  if (await enforceRecipientRateLimit(request, share.id)) {
    return NextResponse.redirect(getPublicUrl(request, `/s/${params.token}?error=too_many_attempts`));
  }

  const formData = await request.formData();
  const recipientAccessToken = String(formData.get("rt") ?? "") || null;
  const recipient = resolveRecipientByAccessToken(share, recipientAccessToken);

  if (!recipient) {
    await markShareDenied({
      shareId: share.id,
      reason: "invalid_recipient_token",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return NextResponse.redirect(getPublicUrl(request, `/s/${params.token}?error=invalid_link`));
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
    return NextResponse.redirect(
      getPublicUrl(request, `/s/${params.token}?rt=${encodeURIComponent(recipientAccessToken!)}&error=${state}`)
    );
  }

  const accessCookie = request.cookies.get(getShareAccessCookieName(share.id))?.value;
  if (share.passwordHash && !validateShareAccessCookie(accessCookie, share.id, recipient.id)) {
    await markShareDenied({
      shareId: share.id,
      recipientEmail: recipient.email,
      reason: "password_required",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return NextResponse.redirect(
      getPublicUrl(request, `/s/${params.token}?rt=${encodeURIComponent(recipientAccessToken!)}&error=password_required`)
    );
  }

  const consumed = await prisma.$transaction((tx) => consumeDownload(tx, share, recipient.id));
  if (!consumed) {
    await markShareDenied({
      shareId: share.id,
      recipientEmail: recipient.email,
      reason: "download_race_denied",
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
    return NextResponse.redirect(
      getPublicUrl(request, `/s/${params.token}?rt=${encodeURIComponent(recipientAccessToken!)}&error=already_downloaded`)
    );
  }

  await createShareAccessEvent({
    shareId: share.id,
    recipientEmail: recipient.email,
    eventType: AuditEventType.DOWNLOAD_SUCCESS,
    allowed: true,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  await createAuditLog({
    actorType: AuditActorType.RECIPIENT,
    actorLabel: recipient.email,
    eventType: AuditEventType.DOWNLOAD_SUCCESS,
    entityType: "Share",
    entityId: share.id,
    metadata: {
      fileCount: share.files.length,
      recipientId: recipient.id
    },
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  if (share.files.length === 1) {
    return buildSingleFileResponse(share);
  }

  return buildArchiveResponse(share);
}
