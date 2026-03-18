import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/constants";
import { env } from "@/lib/env";
import { getPublicUrl } from "@/lib/request";
import { enforceLoginRateLimit, isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";
import { loginSchema } from "@/lib/validation";
import { authenticateUser } from "@/lib/auth";

function redirectToLogin(request: NextRequest, error: string) {
  const url = getPublicUrl(request, "/login");
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      entityType: "LoginAttempt"
    });
  }

  if (await enforceLoginRateLimit(request)) {
    return redirectToLogin(request, "rate_limited");
  }

  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return redirectToLogin(request, "invalid_request");
  }

  const result = await authenticateUser({
    identifier: parsed.data.identifier,
    password: parsed.data.password,
    request
  });

  if (!result.ok) {
    return redirectToLogin(request, result.reason);
  }

  const url = getPublicUrl(request, result.user.forcePasswordReset ? "/profile" : "/dashboard");
  if (result.user.forcePasswordReset) {
    url.searchParams.set("forceReset", "1");
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(SESSION_COOKIE_NAME, result.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)
  });
  return response;
}
