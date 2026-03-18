import { NextRequest, NextResponse } from "next/server";
import { AuditActorType, AuditEventType, UserRole } from "@prisma/client";
import { FLASH_SHARE_LINK_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/constants";
import { createAuditLog } from "@/lib/audit";
import { requireRouteUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRecipientLink, createRecipientAccessToken, createShareToken, hashOptionalPassword } from "@/lib/shares";
import { uploadBuffer } from "@/lib/storage";
import { getClientIp, getPublicUrl, getUserAgent } from "@/lib/request";
import { parseRecipients, shareFormSchema } from "@/lib/validation";
import { validateFileAgainstPolicy } from "@/lib/file-policy";
import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

export async function GET(request: NextRequest) {
  const current = await requireRouteUser(request);
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shares = await prisma.share.findMany({
    where:
      current.user.role === UserRole.SUPER_ADMIN
        ? undefined
        : {
            senderId: current.user.id
          },
    include: {
      recipients: true,
      files: true,
      sender: {
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json({ shares });
}

export async function POST(request: NextRequest) {
  const current = await requireRouteUser(request);
  if (!current) {
    return NextResponse.redirect(getPublicUrl(request, "/login"));
  }

  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      actorUserId: current.user.id,
      actorLabel: current.user.email,
      entityType: "Share"
    });
  }

  const formData = await request.formData();
  const parsed = shareFormSchema.safeParse({
    title: formData.get("title") ?? "",
    message: formData.get("message") ?? "",
    recipients: formData.get("recipients"),
    expirationMode: formData.get("expirationMode"),
    expirationDays: formData.get("expirationDays"),
    sharePassword: formData.get("sharePassword") ?? ""
  });

  const redirectUrl = getPublicUrl(request, "/shares/new");
  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "invalid_share_payload");
    return NextResponse.redirect(redirectUrl);
  }

  const recipientEmails = parseRecipients(parsed.data.recipients);
  if (recipientEmails.length === 0) {
    redirectUrl.searchParams.set("error", "recipient_required");
    return NextResponse.redirect(redirectUrl);
  }

  if (recipientEmails.length > 50) {
    redirectUrl.searchParams.set("error", "too_many_recipients");
    return NextResponse.redirect(redirectUrl);
  }

  for (const email of recipientEmails) {
    if (!email.includes("@")) {
      redirectUrl.searchParams.set("error", "invalid_recipient_email");
      return NextResponse.redirect(redirectUrl);
    }
  }

  const uploadedFiles = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (uploadedFiles.length === 0) {
    redirectUrl.searchParams.set("error", "file_required");
    return NextResponse.redirect(redirectUrl);
  }

  if (uploadedFiles.length > 20) {
    redirectUrl.searchParams.set("error", "too_many_files");
    return NextResponse.redirect(redirectUrl);
  }

  const settings = await prisma.platformSetting.findUnique({
    where: {
      id: 1
    }
  });

  const maxFileSize = Number(settings?.maxFileSizeBytes ?? BigInt(1_073_741_824));
  for (const file of uploadedFiles) {
    if (file.size > maxFileSize) {
      redirectUrl.searchParams.set("error", "file_too_large");
      return NextResponse.redirect(redirectUrl);
    }

    if (!validateFileAgainstPolicy({ file, allowedFileTypes: settings?.allowedFileTypes })) {
      redirectUrl.searchParams.set("error", "file_type_not_allowed");
      return NextResponse.redirect(redirectUrl);
    }
  }

  const token = createShareToken();
  const recipientTokens = recipientEmails.map((email) => ({
    email,
    access: createRecipientAccessToken()
  }));
  const expirationDays =
    parsed.data.expirationMode === "DAYS"
      ? parsed.data.expirationDays ?? settings?.defaultShareExpirationDays ?? 7
      : undefined;

  const share = await prisma.share.create({
    data: {
      senderId: current.user.id,
      tokenHash: token.hash,
      title: parsed.data.title || null,
      message: parsed.data.message || null,
      expirationMode: parsed.data.expirationMode,
      expiresAt: expirationDays ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) : null,
      maxDownloads: parsed.data.expirationMode === "FIRST_DOWNLOAD" ? 1 : null,
      passwordHash: await hashOptionalPassword(parsed.data.sharePassword),
      recipients: {
        create: recipientTokens.map((recipient) => ({
          email: recipient.email,
          accessTokenHash: recipient.access.hash
        }))
      },
      emailDeliveries: {
        create: recipientTokens.map((recipient) => ({
          recipient: recipient.email,
          subject: parsed.data.title || "Secure file share",
          templateKey: "recipient-share-link",
          triggeredByUserId: current.user.id
        }))
      }
    },
    include: {
      recipients: true
    }
  });

  const uploadedMetadata = [];
  for (const file of uploadedFiles) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const objectKey = `shares/${share.id}/${Date.now()}-${safeName}`;
    const body = Buffer.from(await file.arrayBuffer());

    await uploadBuffer({
      objectKey,
      body,
      contentType: file.type,
      filename: file.name
    });

    uploadedMetadata.push({
      shareId: share.id,
      objectKey,
      originalName: file.name,
      contentType: file.type || null,
      sizeBytes: BigInt(file.size)
    });
  }

  await prisma.shareFile.createMany({
    data: uploadedMetadata
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorUserId: current.user.id,
    actorLabel: current.user.email,
    eventType: AuditEventType.SHARE_CREATED,
    entityType: "Share",
    entityId: share.id,
    metadata: {
      recipients: recipientEmails,
      fileCount: uploadedFiles.length
    },
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request)
  });

  const response = NextResponse.redirect(getPublicUrl(request, "/shares?message=share_created"));
  response.cookies.set(FLASH_SHARE_LINK_COOKIE, buildRecipientLink(token.raw, recipientTokens[0]?.access.raw ?? null), {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60
  });
  return response;
}
