import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { buildImagePlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import type { HistoryEntry, ImagePlan, ProductInput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));

    const generations = await prisma.generation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        images: {
          orderBy: { createdAt: "asc" }
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            error: true,
            message: true
          }
        }
      }
    });

    const items: HistoryEntry[] = generations.map((generation) => {
      const input = generation.input as ProductInput;
      const draftPlans = buildImagePlans(input);
      const imageByType = new Map(generation.images.map((image) => [image.type, image]));
      const plans: ImagePlan[] = draftPlans.map((plan) => {
        const image = imageByType.get(plan.type);
        return {
          ...plan,
          title: image?.title || plan.title,
          size: image?.size || plan.size,
          imageUrl: image?.imageUrl || undefined,
          error: image?.error || undefined
        };
      });

      for (const image of generation.images) {
        if (!plans.some((plan) => plan.type === image.type)) {
          plans.push({
            type: image.type as ImagePlan["type"],
            title: image.title,
            usage: "历史生成图片",
            size: image.size,
            localizedCopy: [],
            designNotes: "",
            prompt: "",
            negativePrompt: "",
            imageUrl: image.imageUrl || undefined,
            error: image.error || undefined
          });
        }
      }

      const latestTask = generation.tasks[0];
      const imageSuccessCount = generation.images.filter((image) => image.ok && image.imageUrl).length;
      const imageFailCount = generation.images.filter((image) => !image.ok || image.error).length;
      const successCount = Math.max(generation.successCount, imageSuccessCount);
      const failCount = latestTask?.status === "FAILED" && successCount === 0 && generation.failCount === 0
        ? Math.max(1, generation.imageCount)
        : Math.max(generation.failCount, imageFailCount);
      const status: HistoryEntry["status"] =
        latestTask?.status === "PENDING" || latestTask?.status === "RUNNING"
          ? "running"
          : latestTask?.status === "CANCELED"
            ? "canceled"
            : successCount > 0 && successCount >= generation.imageCount && failCount === 0
              ? "success"
              : successCount > 0
                ? "partial"
                : latestTask?.status === "FAILED" || failCount > 0
                  ? "failed"
                  : "running";

      return {
        id: generation.id,
        timestamp: generation.createdAt.getTime(),
        productName: generation.productName,
        language: input.language,
        imageCount: generation.imageCount,
        successCount,
        failCount,
        status,
        error: latestTask?.error || latestTask?.message || null,
        plans
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取历史记录失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
