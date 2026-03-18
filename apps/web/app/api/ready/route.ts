import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "web",
      checks: {
        database: "up"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "web",
        error: error instanceof Error ? error.message : "Unknown database readiness failure"
      },
      { status: 503 }
    );
  }
}
