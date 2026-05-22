import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, SystemLogLevel } from "@/lib/generated/prisma/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const levelParam = url.searchParams.get("level");
    const level: SystemLogLevel | undefined = levelParam === "INFO" || levelParam === "WARN" || levelParam === "ERROR" ? levelParam : undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 30)));

    const where: Prisma.SystemLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(level ? { level } : {})
    };

    const [items, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, phone: true } } }
      }),
      prisma.systemLog.count({ where })
    ]);

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      items: items.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString()
      }))
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
