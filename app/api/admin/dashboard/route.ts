import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TREND_DAYS = 14;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const now = new Date();
    const startToday = startOfDay(now);
    const since = new Date(startToday);
    since.setDate(since.getDate() - (TREND_DAYS - 1));

    const [
      totalUsers,
      newUsersToday,
      activeUsers7d,
      totalGenerations,
      totalConsumedAgg,
      callsRaw,
      newUsersRaw,
      callTopRaw,
      consumeTopRaw,
      recentSystemLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startToday } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
      prisma.generation.count(),
      prisma.creditRecord.aggregate({
        where: { type: "GENERATION_DEBIT" },
        _sum: { amount: true }
      }),
      prisma.apiLog.findMany({
        where: { action: "image.generate", createdAt: { gte: since } },
        select: { createdAt: true, ok: true }
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true }
      }),
      prisma.apiLog.groupBy({
        by: ["userId"],
        where: { action: "image.generate" },
        _count: { _all: true },
        orderBy: { _count: { userId: "desc" } },
        take: 10
      }),
      prisma.creditRecord.groupBy({
        by: ["userId"],
        where: { type: "GENERATION_DEBIT" },
        _sum: { amount: true },
        orderBy: { _sum: { amount: "asc" } },
        take: 10
      }),
      prisma.systemLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { id: true, phone: true } } }
      })
    ]);

    const trend: { day: string; calls: number; success: number; users: number }[] = [];
    for (let i = 0; i < TREND_DAYS; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      trend.push({ day: dayKey(d), calls: 0, success: 0, users: 0 });
    }
    const indexByDay = new Map(trend.map((item, idx) => [item.day, idx] as const));

    for (const log of callsRaw) {
      const key = dayKey(log.createdAt);
      const idx = indexByDay.get(key);
      if (idx == null) continue;
      trend[idx].calls += 1;
      if (log.ok) trend[idx].success += 1;
    }
    for (const u of newUsersRaw) {
      const key = dayKey(u.createdAt);
      const idx = indexByDay.get(key);
      if (idx == null) continue;
      trend[idx].users += 1;
    }

    const topUserIds = Array.from(new Set([
      ...callTopRaw.map((item) => item.userId).filter((id): id is string => Boolean(id)),
      ...consumeTopRaw.map((item) => item.userId).filter((id): id is string => Boolean(id))
    ]));
    const topUsers = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, phone: true }
    });
    const userMap = new Map(topUsers.map((u) => [u.id, u.phone]));

    return NextResponse.json({
      ok: true,
      stats: {
        totalUsers,
        newUsersToday,
        activeUsers7d,
        totalGenerations,
        totalCreditsConsumed: Math.abs(totalConsumedAgg._sum.amount || 0)
      },
      trend,
      topByCalls: callTopRaw.map((item) => ({
        userId: item.userId,
        phone: item.userId ? userMap.get(item.userId) || "未知用户" : "未登录",
        count: item._count._all
      })),
      topByConsume: consumeTopRaw.map((item) => ({
        userId: item.userId,
        phone: item.userId ? userMap.get(item.userId) || "未知用户" : "未登录",
        amount: Math.abs(item._sum.amount || 0)
      })),
      recentSystemLogs: recentSystemLogs.map((log) => ({
        id: log.id,
        level: log.level,
        action: log.action,
        message: log.message,
        userPhone: log.user?.phone || null,
        createdAt: log.createdAt.toISOString()
      }))
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取看板失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
