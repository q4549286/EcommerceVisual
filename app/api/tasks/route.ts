import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { CreditError } from "@/lib/credits";
import { buildImagePlans } from "@/lib/plans";
import { createGenerationTask, listUserTasks } from "@/lib/task-queue";
import type { ProductInput } from "@/lib/types";

export const runtime = "nodejs";

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const items = await listUserTasks(user.id, limit);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取任务失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
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
    if (!input.description?.trim() && isTextToImage) {
      return badRequest("请写一句想生成的商品图描述。");
    }

    const plans = buildImagePlans(input);
    if (plans.length === 0) {
      return badRequest("请至少选择一种图片类型。");
    }
    if (user.credits < plans.length) {
      return badRequest(`额度不足，本次需要 ${plans.length} 点。`);
    }

    const task = await createGenerationTask({
      userId: user.id,
      productImage: image instanceof File ? image : null,
      referenceImages,
      input
    });

    return NextResponse.json({ ok: true, taskId: task.id });
  } catch (error) {
    if (error instanceof AuthError || error instanceof CreditError) {
      return badRequest(error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "创建任务失败。";
    return badRequest(message, 500);
  }
}
