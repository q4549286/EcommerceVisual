import { CreditError, refundGenerationCredits, reserveGenerationCredits } from "@/lib/credits";
import { generateEditedImage, generateTextImage } from "@/lib/image-api";
import { persistGeneratedImageUrl } from "@/lib/image-storage";
import { buildImagePlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { writeApiLog, writeSystemLog } from "@/lib/server-logs";
import type { CallLog, ImagePlan, ProductInput, QualityMode } from "@/lib/types";

export type GenerationAssetBundle = {
  productImage?: {
    name: string;
    type: string;
    base64: string;
  } | null;
  referenceImages?: Array<{
    name: string;
    type: string;
    base64: string;
  }>;
};

export type GenerationRunInput = {
  userId: string;
  input: ProductInput;
  productImage?: File | null;
  referenceImages?: File[];
  taskId?: string;
  onProgress?: (update: { index: number; total: number; message: string }) => Promise<void> | void;
  existingGenerationId?: string;
};

export type GenerationRunResult = {
  ok: boolean;
  generationId: string;
  plans: ImagePlan[];
  logs: CallLog[];
  error?: string;
  credits?: number;
};

export async function fileToAsset(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name || "image",
    type: file.type || "application/octet-stream",
    base64: buffer.toString("base64")
  };
}

export async function assetToFile(asset: { name?: string; type?: string; base64: string }) {
  const bytes = Buffer.from(asset.base64, "base64");
  return new File([bytes], asset.name || "image.png", { type: asset.type || "image/png" });
}

async function generationNetCharge(generationId: string) {
  const rows = await prisma.creditRecord.findMany({
    where: { generationId },
    select: { amount: true }
  });
  return Math.max(0, -rows.reduce((sum, row) => sum + row.amount, 0));
}

async function reconcileGenerationCredits(userId: string, generationId: string, successCount: number, note: string) {
  const netCharge = await generationNetCharge(generationId);
  const refundCount = Math.max(0, netCharge - successCount);
  if (refundCount > 0) {
    await refundGenerationCredits(userId, generationId, refundCount, note);
  }
}

async function saveGenerationImageResult(generationId: string, plan: ImagePlan) {
  await prisma.generationImage.deleteMany({
    where: {
      generationId,
      type: plan.type
    }
  });

  await prisma.generationImage.create({
    data: {
      generationId,
      type: plan.type,
      title: plan.title,
      size: plan.size,
      ok: Boolean(plan.imageUrl),
      imageUrl: plan.imageUrl,
      error: plan.error
    }
  });
}

export async function runGeneration(input: GenerationRunInput): Promise<GenerationRunResult> {
  let generationId = input.existingGenerationId || "";
  const generatedPlans: ImagePlan[] = [];
  const logs: CallLog[] = [];

  try {
    const plans = buildImagePlans(input.input);
    if (plans.length === 0) {
      throw new CreditError("请至少选择一种图片类型。", 400);
    }

    const isTextToImage = input.input.generationMode === "text_to_image";
    const generation = generationId
      ? await prisma.generation.findUnique({ where: { id: generationId } })
      : await prisma.generation.create({
          data: {
            userId: input.userId,
            productName: input.input.productName.trim(),
            language: input.input.language,
            imageCount: plans.length,
            input: JSON.parse(JSON.stringify(input.input))
          }
        });

    if (!generation) {
      throw new Error("生成记录不存在。");
    }

    generationId = generation.id;
    if (input.taskId && !input.existingGenerationId) {
      await prisma.generationTask.update({
        where: { id: input.taskId },
        data: { generationId }
      }).catch(() => undefined);
    }

    const existingImages = await prisma.generationImage.findMany({
      where: { generationId },
      orderBy: { createdAt: "asc" }
    });
    const completedByType = new Map(
      existingImages
        .filter((image) => image.ok && image.imageUrl)
        .map((image) => [image.type, image])
    );
    const remainingCount = plans.filter((plan) => !completedByType.has(plan.type)).length;
    const reserveCount = Math.max(0, plans.length - await generationNetCharge(generationId));
    if (reserveCount > 0 && remainingCount > 0) {
      await reserveGenerationCredits(input.userId, generationId, Math.min(reserveCount, remainingCount), `生成图片预扣：${input.input.productName.trim()}`);
    }

    const productImageFile = isTextToImage || !input.productImage ? null : input.productImage;
    const referenceImages = input.referenceImages || [];
    const qualityMode: QualityMode = input.input.qualityMode === "hd" ? "hd" : "fast";

    for (let index = 0; index < plans.length; index += 1) {
      if (input.taskId) {
        const latestTask = await prisma.generationTask.findUnique({
          where: { id: input.taskId },
          select: { status: true }
        }).catch(() => null);
        if (latestTask?.status === "CANCELED") {
          return { ok: false, generationId, plans: generatedPlans, logs, error: "任务已终止。" };
        }
      }

      const plan = plans[index];
      const completed = completedByType.get(plan.type);
      if (completed?.imageUrl) {
        generatedPlans.push({ ...plan, imageUrl: completed.imageUrl });
        await prisma.generationTask.updateMany({
          where: input.taskId ? { id: input.taskId } : { generationId, status: "RUNNING" },
          data: {
            progress: Math.min(99, Math.round(((index + 1) / plans.length) * 100)),
            message: `已跳过 ${index + 1}/${plans.length}，继续补剩余图片`
          }
        }).catch(() => undefined);
        continue;
      }

      await input.onProgress?.({
        index,
        total: plans.length,
        message: `正在生成 ${plan.title}`
      });

      const result = isTextToImage
        ? await generateTextImage(plan, qualityMode)
        : await generateEditedImage(plan, productImageFile as File, referenceImages, qualityMode);

      logs.push(result.log);
      await writeApiLog(input.userId, "image.generate", result.log);

      if (result.ok) {
        const imageUrl = await persistGeneratedImageUrl(result.imageUrl, generationId, plan.type);
        generatedPlans.push({ ...plan, imageUrl });
      } else {
        generatedPlans.push({ ...plan, error: result.error });
      }
      await saveGenerationImageResult(generationId, generatedPlans[generatedPlans.length - 1]);

      await prisma.generationTask.updateMany({
        where: input.taskId ? { id: input.taskId } : { generationId, status: "RUNNING" },
        data: {
          progress: Math.min(99, Math.round(((index + 1) / plans.length) * 100)),
          message: `已完成 ${index + 1}/${plans.length}`
        }
      }).catch(() => undefined);
    }

    const successCount = generatedPlans.filter((plan) => Boolean(plan.imageUrl)).length;
    const failCount = generatedPlans.length - successCount;

    await reconcileGenerationCredits(input.userId, generationId, successCount, `生成失败退回：${input.input.productName.trim()}`);

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        successCount,
        failCount,
        creditsCharged: successCount
      }
    });

    const currentUser = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { credits: true }
    });

    await prisma.generationTask.updateMany({
      where: input.taskId ? { id: input.taskId } : { generationId, status: "RUNNING" },
      data: {
        status: successCount > 0 ? "SUCCEEDED" : "FAILED",
        progress: 100,
        message: successCount > 0 ? `已完成 ${successCount} 张` : "全部图片生成失败",
        error: successCount > 0 ? null : (generatedPlans.find((plan) => plan.error)?.error || "图片生成失败"),
        finishedAt: new Date()
      }
    }).catch(() => undefined);

    if (successCount === 0) {
      const firstError = generatedPlans.find((plan) => plan.error)?.error || "图片生成失败。";
      return { ok: false, generationId, plans: generatedPlans, logs, error: firstError, credits: currentUser?.credits };
    }

    return { ok: true, generationId, plans: generatedPlans, logs, credits: currentUser?.credits };
  } catch (error) {
    if (generationId) {
      const images = await prisma.generationImage.findMany({
        where: { generationId },
        select: { ok: true }
      }).catch(() => []);
      const successCount = images.filter((image) => image.ok).length;
      const plannedCount = buildImagePlans(input.input).length;
      await reconcileGenerationCredits(input.userId, generationId, successCount, "生成异常退回").catch(() => undefined);
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          successCount,
          failCount: Math.max(0, plannedCount - successCount),
          creditsCharged: successCount
        }
      }).catch(() => undefined);
    }

    await prisma.generationTask.updateMany({
      where: input.taskId ? { id: input.taskId } : { generationId, status: "RUNNING" },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "生成接口异常。",
        message: error instanceof Error ? error.message : "生成接口异常。",
        finishedAt: new Date()
      }
    }).catch(() => undefined);

    if (error instanceof CreditError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "生成接口异常。";
    await writeSystemLog({
      userId: input.userId,
      level: "ERROR",
      action: "image.generate_error",
      message
    });
    return { ok: false, generationId, plans: generatedPlans, logs, error: message };
  }
}

export function buildTaskTitle(input: ProductInput) {
  return input.productName?.trim() || (input.generationMode === "text_to_image" ? "文生图任务" : "图片生成任务");
}

export function serializeGenerationInput(input: ProductInput) {
  return JSON.parse(JSON.stringify(input));
}
