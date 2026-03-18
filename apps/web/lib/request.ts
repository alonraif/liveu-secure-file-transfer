import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

export function getClientIp(request: NextRequest | Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.headers.get("x-real-ip");
}

export function getUserAgent(request: NextRequest | Request) {
  return request.headers.get("user-agent");
}

export function getOriginFromRequest(request: NextRequest | Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!host) {
    return null;
  }

  return `${forwardedProto}://${host}`;
}

export function getPublicUrl(request: NextRequest | Request, path: string) {
  const base = getOriginFromRequest(request) ?? env.APP_PUBLIC_URL;
  return new URL(path, base);
}
