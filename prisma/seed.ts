import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { parseEnv } from "@liveu-sft/config";

const prisma = new PrismaClient();
const env = parseEnv();

async function main() {
  const passwordHash = await hash(env.DEFAULT_ADMIN_PASSWORD);

  await prisma.platformSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      publicHostname: env.CADDY_SITE_ADDRESS,
      letsEncryptEnabled: false,
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
      smtpSecure: env.SMTP_SECURE,
      smtpUsername: env.SMTP_USERNAME,
      smtpFrom: env.SMTP_FROM
    }
  });

  await prisma.sslCertificateStatus.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      hostname: env.CADDY_SITE_ADDRESS,
      enabled: false,
      status: "not_configured"
    }
  });

  await prisma.user.upsert({
    where: { email: env.DEFAULT_ADMIN_EMAIL },
    update: {
      username: env.DEFAULT_ADMIN_USERNAME,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      forcePasswordReset: true
    },
    create: {
      email: env.DEFAULT_ADMIN_EMAIL,
      username: env.DEFAULT_ADMIN_USERNAME,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      forcePasswordReset: true
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
