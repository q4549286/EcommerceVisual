import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;
    const status = url.searchParams.get("status");
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get("pageSize") || 20)));

    const where = {
      ...(userId ? { userId } : {}),
      ...(status === "fail" ? { failCount: { gt: 0 } } : status === "success" ? { failCount: 0 } : {})
    };

    const [items, total] = await Promise.all([
      prisma.generation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, phone: true } },
          _count: { select: { images: true } }
        }
      }),
      prisma.generation.count({ where })
    ]);

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      items: items.map((generation) => ({
        id: generation.id,
        productName: generation.productName,
        language: generation.language,
        imageCount: generation.imageCount,
        successCount: generation.successCount,
        failCount: generation.failCount,
        creditsCharged: generation.creditsCharged,
        user: generation.user,
        createdAt: generation.createdAt.toISOString()
      }))
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
