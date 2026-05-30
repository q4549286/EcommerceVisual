import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { analyzeProductImage } from "@/lib/product-analysis";
import type { Language, PlatformKey } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function isLanguage(value: string): value is Language {
  return value === "en" || value === "zh-CN" || value === "zh-TW";
}

function isPlatform(value: string): value is PlatformKey {
  return [
    "generic",
    "meituan_waimai",
    "meituan_flash",
    "taobao_tmall",
    "jd",
    "douyin",
    "pdd",
    "rednote"
  ].includes(value);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const formData = await request.formData();
    const image = formData.get("productImage");
    const rawLanguage = String(formData.get("language") || "zh-CN");
    const rawPlatform = String(formData.get("platform") || "generic");

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "请先上传商品图。" }, { status: 400 });
    }

    const language = isLanguage(rawLanguage) ? rawLanguage : "zh-CN";
    const platform = isPlatform(rawPlatform) ? rawPlatform : "generic";
    const analysis = await analyzeProductImage(user.id, image, language, platform);
    return NextResponse.json({ ok: true, analysis });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "商品识别失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
