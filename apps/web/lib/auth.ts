import { hash, verify } from "@node-rs/argon2";
import {
  AuditActorType,
  AuditEventType,
  SessionType,
  UserRole,
  UserStatus
} from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SHARE_ACCESS_COOKIE_PREFIX } from "@/lib/constants";
import { randomToken, sha256 } from "@/lib/crypto";
import { createAuditLog } from "@/lib/audit";
import { getClientIp, getUserAgent } from "@/lib/request";

export type SessionUser = Awaited<ReturnType<typeof getCurrentUser>>;

function sessionExpiresAt() {
  return new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export async function hashPassword(password: string) {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}

export async function createSession(input: {
  userId: string;
  request: NextRequest;
}) {
  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);

  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      type: SessionType.PASSWORD,
      tokenHash,
      expiresAt: sessionExpiresAt(),
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request)
    }
  });

  return {
    rawToken,
    session
  };
}

export async function getCurrentUser() {
  const cookieStore = cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: sha256(rawToken),
      type: SessionType.PASSWORD,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  });

  if (!session || session.user.status !== UserStatus.ACTIVE) {
    return null;
  }

  return {
    sessionId: session.id,
    user: session.user
  };
}

export async function requirePageUser(options?: {
  role?: UserRole;
  allowForcedPasswordReset?: boolean;
}) {
  const current = await getCurrentUser();
  if (!current) {
    redirect("/login");
  }

  if (options?.role && current.user.role !== options.role) {
    redirect("/dashboard?error=forbidden");
  }

  if (!options?.allowForcedPasswordReset && current.user.forcePasswordReset) {
    redirect("/profile?forceReset=1");
  }

  return current;
}

export async function authenticateUser(input: {
  identifier: string;
  password: string;
  request: NextRequest;
}) {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }]
    }
  });

  if (!user) {
    await createAuditLog({
      actorType: AuditActorType.SYSTEM,
      actorLabel: identifier,
      eventType: AuditEventType.USER_LOGIN_FAILED,
      entityType: "LoginAttempt",
      metadata: {
        reason: "invalid_credentials"
      },
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request)
    });

    return { ok: false as const, reason: "invalid_credentials" };
  }

  if (user.status === UserStatus.DISABLED) {
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: user.id,
      actorLabel: user.email,
      eventType: user.role === UserRole.SUPER_ADMIN ? AuditEventType.ADMIN_LOGIN_FAILED : AuditEventType.USER_LOGIN_FAILED,
      entityType: "LoginAttempt",
      entityId: user.id,
      metadata: {
        reason: "account_disabled"
      },
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request)
    });
    return { ok: false as const, reason: "account_disabled", user };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: user.id,
      actorLabel: user.email,
      eventType: user.role === UserRole.SUPER_ADMIN ? AuditEventType.ADMIN_LOGIN_FAILED : AuditEventType.USER_LOGIN_FAILED,
      entityType: "LoginAttempt",
      entityId: user.id,
      metadata: {
        reason: "account_locked"
      },
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request)
    });
    return { ok: false as const, reason: "account_locked", user };
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password);
  if (!passwordValid) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= env.MAX_LOGIN_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000)
          : null,
        status: shouldLock ? UserStatus.LOCKED : user.status
      }
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: user.id,
      actorLabel: user.email,
      eventType: user.role === UserRole.SUPER_ADMIN ? AuditEventType.ADMIN_LOGIN_FAILED : AuditEventType.USER_LOGIN_FAILED,
      entityType: "LoginAttempt",
      entityId: user.id,
      metadata: {
        reason: shouldLock ? "account_locked" : "invalid_credentials"
      },
      ipAddress: getClientIp(input.request),
      userAgent: getUserAgent(input.request)
    });

    return { ok: false as const, reason: shouldLock ? "account_locked" : "invalid_credentials", user };
  }

  if (user.status === UserStatus.LOCKED) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        lockedUntil: null
      }
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      status: UserStatus.ACTIVE,
      lastLoginAt: new Date()
    }
  });

  const created = await createSession({
    userId: user.id,
    request: input.request
  });

  await createAuditLog({
    actorType: AuditActorType.USER,
    actorUserId: user.id,
    actorLabel: user.email,
    eventType: user.role === UserRole.SUPER_ADMIN ? AuditEventType.ADMIN_LOGIN : AuditEventType.USER_LOGIN,
    entityType: "Session",
    entityId: created.session.id,
    ipAddress: getClientIp(input.request),
    userAgent: getUserAgent(input.request)
  });

  return {
    ok: true as const,
    user,
    rawToken: created.rawToken
  };
}

export async function logoutCurrentSession(request: NextRequest) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return;
  }

  const existing = await prisma.session.findFirst({
    where: {
      tokenHash: sha256(rawToken)
    },
    include: {
      user: true
    }
  });

  if (existing) {
    await prisma.session.delete({
      where: {
        id: existing.id
      }
    });

    await createAuditLog({
      actorType: AuditActorType.USER,
      actorUserId: existing.userId,
      actorLabel: existing.user.email,
      eventType:
        existing.user.role === UserRole.SUPER_ADMIN ? AuditEventType.ADMIN_LOGOUT : AuditEventType.USER_LOGOUT,
      entityType: "Session",
      entityId: existing.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request)
    });
  }

}

export async function revokeUserSessions(userId: string, keepSessionId?: string) {
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepSessionId
        ? {
            id: {
              not: keepSessionId
            }
          }
        : {})
    }
  });
}

export async function requireRouteUser(request: NextRequest, options?: {
  role?: UserRole;
  allowForcedPasswordReset?: boolean;
}) {
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: sha256(rawToken),
      type: SessionType.PASSWORD,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      user: true
    }
  });

  if (!session || session.user.status !== UserStatus.ACTIVE) {
    return null;
  }

  if (options?.role && session.user.role !== options.role) {
    return null;
  }

  if (!options?.allowForcedPasswordReset && session.user.forcePasswordReset) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: {
      lastSeenAt: new Date()
    }
  });

  return {
    session,
    user: session.user
  };
}

export function getShareAccessCookieName(shareId: string) {
  return `${SHARE_ACCESS_COOKIE_PREFIX}${shareId}`;
}
