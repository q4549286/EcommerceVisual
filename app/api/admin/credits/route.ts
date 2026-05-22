import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const phone = url.searchParams.get("phone") || undefined;
    const limit = Math.min(200, Math.max(20, Number(url.searchParams.get("limit") || 100)));
    const userWhere = phone ? { phone: { contains: phone } } : undefined;

    const records = await prisma.creditRecord.findMany({
      where: {
        userId,
        user: userWhere
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            phone: true
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      records: records.map((record) => ({
        ...record,
        createdAt: record.createdAt.toISOString()
      }))
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取积分记录失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
