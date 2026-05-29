import { CreditError, refundGenerationCredits, reserveGenerationCredits } from "@/lib/credits";
import { generateEditedImage, generateTextImage } from "@/lib/image-api";
import { persistGeneratedImageUrl } from "@/lib/image-storage";
import { buildImagePlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { writeApiLog, writeSystemLog } from "@/lib/server-logs";
import type { CallLog, ImagePlan, ProductInput } from "@/lib/types";

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

export async function runGeneration(input: GenerationRunInput): Promise<GenerationRunResult> {
  let generationId = input.existingGenerationId || "";
  let reservedCount = 0;

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
    await reserveGenerationCredits(input.userId, generationId, plans.length, `生成图片预扣：${input.input.productName.trim()}`);
    reservedCount = plans.length;

    const generatedPlans: ImagePlan[] = [];
    const logs: CallLog[] = [];
    const productImageFile = isTextToImage || !input.productImage ? null : input.productImage;
    const referenceImages = input.referenceImages || [];

    for (let index = 0; index < plans.length; index += 1) {
      const plan = plans[index];
      await input.onProgress?.({
        index,
        total: plans.length,
        message: `正在生成 ${plan.title}`
      });

      const result = isTextToImage
        ? await generateTextImage(plan)
        : await generateEditedImage(plan, productImageFile as File, referenceImages);

      logs.push(result.log);
      await writeApiLog(input.userId, "image.generate", result.log);

      if (result.ok) {
        const imageUrl = await persistGeneratedImageUrl(result.imageUrl, generationId, plan.type);
        generatedPlans.push({ ...plan, imageUrl });
      } else {
        generatedPlans.push({ ...plan, error: result.error });
      }

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

    if (failCount > 0) {
      await refundGenerationCredits(input.userId, generationId, failCount, `生成失败退回：${input.input.productName.trim()}`);
      reservedCount -= failCount;
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: {
        successCount,
        failCount,
        creditsCharged: successCount
      }
    });

    await prisma.generationImage.createMany({
      data: generatedPlans.map((plan) => ({
        generationId,
        type: plan.type,
        title: plan.title,
        size: plan.size,
        ok: Boolean(plan.imageUrl),
        imageUrl: plan.imageUrl,
        error: plan.error
      }))
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
    if (generationId && reservedCount > 0) {
      await refundGenerationCredits(input.userId, generationId, reservedCount, "生成异常退回").catch(() => undefined);
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          successCount: 0,
          failCount: reservedCount,
          creditsCharged: 0
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
    return { ok: false, generationId, plans: [], logs: [], error: message };
  }
}

export function buildTaskTitle(input: ProductInput) {
  return input.productName?.trim() || (input.generationMode === "text_to_image" ? "文生图任务" : "图片生成任务");
}

export function serializeGenerationInput(input: ProductInput) {
  return JSON.parse(JSON.stringify(input));
}
