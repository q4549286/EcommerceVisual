import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { CreditError, refundGenerationCredits, reserveGenerationCredits } from "@/lib/credits";
import { generateEditedImage, generateTextImage } from "@/lib/image-api";
import { persistGeneratedImageUrl } from "@/lib/image-storage";
import { buildImagePlans } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { writeApiLog, writeSystemLog } from "@/lib/server-logs";
import type { CallLog, ImagePlan, ProductInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message, logs: [] }, { status });
}

export async function POST(request: Request) {
  let generationId = "";
  let reservedCount = 0;
  let userId = "";

  try {
    const user = await requireUser(request);
    userId = user.id;
    const formData = await request.formData();
    const image = formData.get("productImage");
    const referenceImages = formData.getAll("referenceImages").filter((item): item is File => item instanceof File && item.size > 0).slice(0, 6);
    const rawInput = formData.get("input");

    if (typeof rawInput !== "string") {
      return badRequest("缺少生成参数。");
    }

    const input = JSON.parse(rawInput) as ProductInput;
    const isTextToImage = input.generationMode === "text_to_image";
    if (!isTextToImage && !(image instanceof File)) {
      return badRequest("请上传商品图。");
    }
    if (!input.productName?.trim()) {
      if (isTextToImage && input.description?.trim()) input.productName = "文生图";
      else return badRequest("请填写商品名称。");
    }

    const plans = buildImagePlans(input);
    if (plans.length === 0) {
      return badRequest("请至少选择一种图片类型。");
    }

    const generatedPlans: ImagePlan[] = [];
    const logs: CallLog[] = [];
    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        productName: input.productName.trim(),
        language: input.language,
        imageCount: plans.length,
        input: JSON.parse(JSON.stringify(input))
      }
    });
    generationId = generation.id;
    await reserveGenerationCredits(user.id, generation.id, plans.length, `生成图片预扣：${input.productName.trim()}`);
    reservedCount = plans.length;

    for (const plan of plans) {
      const result = isTextToImage ? await generateTextImage(plan) : await generateEditedImage(plan, image as File, referenceImages);
      logs.push(result.log);
      await writeApiLog(user.id, "image.generate", result.log);
      if (result.ok) {
        const imageUrl = await persistGeneratedImageUrl(result.imageUrl, generation.id, plan.type);
        generatedPlans.push({ ...plan, imageUrl });
      } else {
        generatedPlans.push({ ...plan, error: result.error });
      }
    }

    const successCount = generatedPlans.filter((p) => Boolean(p.imageUrl)).length;
    const failCount = generatedPlans.length - successCount;
    if (failCount > 0) {
      await refundGenerationCredits(user.id, generation.id, failCount, `生成失败退回：${input.productName.trim()}`);
      reservedCount -= failCount;
    }

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        successCount,
        failCount,
        creditsCharged: successCount
      }
    });

    await prisma.generationImage.createMany({
      data: generatedPlans.map((plan) => ({
        generationId: generation.id,
        type: plan.type,
        title: plan.title,
        size: plan.size,
        ok: Boolean(plan.imageUrl),
        imageUrl: plan.imageUrl,
        error: plan.error
      }))
    });

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { credits: true }
    });
    reservedCount = 0;
    const hasSuccess = generatedPlans.some((p) => Boolean(p.imageUrl));
    if (!hasSuccess) {
      const firstError = generatedPlans.find((p) => p.error)?.error || "图片生成失败。";
      return NextResponse.json({ ok: false, generationId: generation.id, plans: generatedPlans, error: firstError, logs, credits: currentUser?.credits }, { status: 502 });
    }

    return NextResponse.json({ ok: true, generationId: generation.id, plans: generatedPlans, logs, credits: currentUser?.credits });
  } catch (error) {
    if (generationId && reservedCount > 0 && userId) {
      await refundGenerationCredits(userId, generationId, reservedCount, "生成异常退回").catch(() => undefined);
      await prisma.generation.update({
        where: { id: generationId },
        data: {
          successCount: 0,
          failCount: reservedCount,
          creditsCharged: 0
        }
      }).catch(() => undefined);
    }
    if (error instanceof AuthError || error instanceof CreditError) {
      return badRequest(error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "生成接口异常。";
    await writeSystemLog({
      userId: userId || undefined,
      level: "ERROR",
      action: "image.generate_error",
      message
    });
    return badRequest(message, 500);
  }
}
