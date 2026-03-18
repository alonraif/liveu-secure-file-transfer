-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('PASSWORD', 'RESET');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('CREATED', 'EMAIL_SENT', 'OPENED', 'DOWNLOADED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ShareExpirationMode" AS ENUM ('DAYS', 'FIRST_DOWNLOAD');

-- CreateEnum
CREATE TYPE "ShareFileStatus" AS ENUM ('ACTIVE', 'DELETED', 'ORPHANED');

-- CreateEnum
CREATE TYPE "RecipientDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('SYSTEM', 'USER', 'RECIPIENT');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('ADMIN_LOGIN', 'ADMIN_LOGOUT', 'USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'USER_CREATED', 'USER_UPDATED', 'USER_DISABLED', 'USER_DELETED', 'SHARE_CREATED', 'EMAIL_SENT', 'LINK_OPENED', 'DOWNLOAD_SUCCESS', 'DOWNLOAD_DENIED', 'SHARE_REVOKED', 'SHARE_EXPIRED', 'FILE_DELETED', 'HOSTNAME_CHANGED', 'SSL_ISSUED', 'SSL_RENEWAL_SUCCESS', 'SSL_RENEWAL_FAILURE', 'SECURITY_SETTINGS_CHANGED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "forcePasswordReset" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'PASSWORD',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "title" TEXT,
    "message" TEXT,
    "status" "ShareStatus" NOT NULL DEFAULT 'CREATED',
    "expirationMode" "ShareExpirationMode" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxDownloads" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "passwordHash" TEXT,
    "openedAt" TIMESTAMP(3),
    "firstDownloadedAt" TIMESTAMP(3),
    "lastDownloadedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareRecipient" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "deliveryStatus" "RecipientDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "openedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareFile" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "status" "ShareFileStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareAccessEvent" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "publicHostname" TEXT,
    "letsEncryptEnabled" BOOLEAN NOT NULL DEFAULT false,
    "brandName" TEXT NOT NULL DEFAULT 'LiveU Secure File Transfer',
    "brandPrimaryColor" TEXT NOT NULL DEFAULT '#0F5BD8',
    "defaultShareExpirationDays" INTEGER NOT NULL DEFAULT 7,
    "maxFileSizeBytes" BIGINT NOT NULL DEFAULT 1073741824,
    "allowedFileTypes" JSONB,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "keepMetadataAfterDeletion" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUsername" TEXT,
    "smtpFrom" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SslCertificateStatus" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hostname" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'disabled',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastRenewedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SslCertificateStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "shareId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "triggeredByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "details" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Share_tokenHash_key" ON "Share"("tokenHash");

-- CreateIndex
CREATE INDEX "Share_senderId_idx" ON "Share"("senderId");

-- CreateIndex
CREATE INDEX "Share_status_idx" ON "Share"("status");

-- CreateIndex
CREATE INDEX "Share_expiresAt_idx" ON "Share"("expiresAt");

-- CreateIndex
CREATE INDEX "ShareRecipient_deliveryStatus_idx" ON "ShareRecipient"("deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShareRecipient_shareId_email_key" ON "ShareRecipient"("shareId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ShareFile_objectKey_key" ON "ShareFile"("objectKey");

-- CreateIndex
CREATE INDEX "ShareFile_shareId_idx" ON "ShareFile"("shareId");

-- CreateIndex
CREATE INDEX "ShareFile_status_idx" ON "ShareFile"("status");

-- CreateIndex
CREATE INDEX "ShareAccessEvent_shareId_idx" ON "ShareAccessEvent"("shareId");

-- CreateIndex
CREATE INDEX "ShareAccessEvent_eventType_idx" ON "ShareAccessEvent"("eventType");

-- CreateIndex
CREATE INDEX "EmailDelivery_shareId_idx" ON "EmailDelivery"("shareId");

-- CreateIndex
CREATE INDEX "EmailDelivery_status_idx" ON "EmailDelivery"("status");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareRecipient" ADD CONSTRAINT "ShareRecipient_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareFile" ADD CONSTRAINT "ShareFile_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareAccessEvent" ADD CONSTRAINT "ShareAccessEvent_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

