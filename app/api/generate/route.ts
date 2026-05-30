import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { CreditError } from "@/lib/credits";
import { runGeneration } from "@/lib/generation-service";
import type { ProductInput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function badRequest(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message, logs: [] }, { status });
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
      if (isTextToImage && input.description?.trim()) input.productName = "文字生图";
      else return badRequest("请填写商品名称。");
    }

    const result = await runGeneration({
      userId: user.id,
      input,
      productImage: image instanceof File ? image : null,
      referenceImages
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError || error instanceof CreditError) {
      return badRequest(error.message, error.status);
    }
    const message = error instanceof Error ? error.message : "生成接口异常。";
    return badRequest(message, 500);
  }
}
