import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;

    const deleted = await prisma.generation.deleteMany({
      where: {
        id,
        userId: user.id
      }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ ok: false, error: "记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "删除历史记录失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
