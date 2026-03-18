import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { logoutCurrentSession } from "@/lib/auth";
import { getPublicUrl } from "@/lib/request";
import { isTrustedOrigin, rejectUntrustedOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!isTrustedOrigin(request)) {
    return rejectUntrustedOrigin(request, {
      entityType: "Session"
    });
  }

  await logoutCurrentSession(request);
  const response = NextResponse.redirect(getPublicUrl(request, "/login?message=logged_out"));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
