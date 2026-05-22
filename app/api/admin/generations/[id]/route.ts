import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const generation = await prisma.generation.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, phone: true } },
        images: true,
        creditRecords: true
      }
    });
    if (!generation) {
      return NextResponse.json({ ok: false, error: "记录不存在。" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      generation: {
        ...generation,
        createdAt: generation.createdAt.toISOString(),
        images: generation.images.map((image) => ({ ...image, createdAt: image.createdAt.toISOString() })),
        creditRecords: generation.creditRecords.map((record) => ({ ...record, createdAt: record.createdAt.toISOString() }))
      }
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
