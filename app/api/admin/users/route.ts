import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        credits: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            apiLogs: true,
            generations: true,
            creditRecords: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      users: users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
      }))
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取用户失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
