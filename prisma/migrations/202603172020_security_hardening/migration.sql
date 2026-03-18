ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'ADMIN_LOGIN_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'USER_LOGIN_FAILED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'CSRF_BLOCKED';

ALTER TABLE "ShareRecipient" ADD COLUMN "accessTokenHash" TEXT;

UPDATE "ShareRecipient"
SET "accessTokenHash" = md5("id" || clock_timestamp()::text || random()::text)
WHERE "accessTokenHash" IS NULL;

ALTER TABLE "ShareRecipient" ALTER COLUMN "accessTokenHash" SET NOT NULL;
CREATE UNIQUE INDEX "ShareRecipient_accessTokenHash_key" ON "ShareRecipient"("accessTokenHash");
