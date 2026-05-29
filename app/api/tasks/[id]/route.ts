import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { toTaskSummary } from "@/lib/task-queue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const task = await prisma.generationTask.findFirst({
      where: { id, userId: user.id },
      include: {
        generation: {
          include: {
            images: {
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ ok: false, error: "任务不存在。" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, task: toTaskSummary(task as unknown as Parameters<typeof toTaskSummary>[0]) });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取任务失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
