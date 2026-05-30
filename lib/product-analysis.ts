import { getUserImageApiSettings } from "@/lib/settings";
import type { Language, PlatformKey, ProductAnalysis } from "@/lib/types";

function mimeFromFile(file: File) {
  if (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp") {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function languageName(language: Language) {
  if (language === "zh-TW") return "繁體中文";
  if (language === "zh-CN") return "简体中文";
  return "English";
}

function isChineseLanguage(language: Language) {
  return language === "zh-CN" || language === "zh-TW";
}

function platformName(platform?: PlatformKey) {
  const names: Record<PlatformKey, string> = {
    generic: "跨境电商",
    meituan_waimai: "美团外卖",
    meituan_flash: "美团闪购",
    taobao_tmall: "淘宝/天猫",
    jd: "京东",
    douyin: "抖音电商",
    pdd: "拼多多",
    rednote: "小红书店铺"
  };
  return names[platform || "generic"];
}

function parseJsonFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("商品识别接口没有返回内容。");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("商品识别接口返回格式不是 JSON。");
    return JSON.parse(match[0]);
  }
}

function extractChatContent(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:")) {
    const chunks = trimmed
      .split(/\n\n+/)
      .map((line) => line.replace(/^data:\s*/, "").trim())
      .filter((line) => line && line !== "[DONE]");
    for (const chunk of chunks.reverse()) {
      try {
        const parsed = JSON.parse(chunk);
        const content = parsed?.choices?.[0]?.message?.content;
        if (typeof content === "string") return content;
      } catch {
        // Try the next chunk.
      }
    }
  }

  const parsed = JSON.parse(trimmed);
  const content = parsed?.choices?.[0]?.message?.content ?? parsed?.output_text;
  if (typeof content !== "string") {
    throw new Error("商品识别接口返回中没有可解析的文本。");
  }
  return content;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 8)
    : [];
}

function normalizeAnalysis(value: Record<string, unknown>): ProductAnalysis {
  return {
    productName: cleanText(value.productName),
    category: cleanText(value.category),
    description: cleanText(value.description),
    brand: cleanText(value.brand),
    material: cleanText(value.material),
    size: cleanText(value.size),
    color: cleanText(value.color),
    audience: cleanText(value.audience),
    sellingPoints: cleanList(value.sellingPoints),
    avoid: cleanList(value.avoid)
  };
}

function buildAnalysisPrompt(language: Language, platform?: PlatformKey) {
  const outputLanguage = languageName(language);
  const targetPlatform = platformName(platform);
  const platformScope = platform === "generic" ? "跨境电商平台" : "中国电商平台";
  const englishPlatformScope = platform === "generic" ? "cross-border ecommerce marketplace" : "Chinese ecommerce marketplace";
  const schema = `{
  "productName": "short product name",
  "category": "marketplace category",
  "description": "one concise listing description",
  "brand": "visible brand or empty string",
  "material": "visible or likely material, cautious if inferred",
  "size": "visible package/spec/volume/size or empty string",
  "color": "main colors",
  "audience": "target buyers or use scenario",
  "sellingPoints": ["3-6 short selling points"],
  "avoid": ["3-8 words or phrases"]
}`;

  if (isChineseLanguage(language)) {
    return [
      `你是熟悉${platformScope}的商品上架运营，目标平台：${targetPlatform}。`,
      "请根据上传的商品图，识别并补全后续生成详情图需要的商品资料。只返回 JSON，不要解释。",
      `所有面向用户的字段值都用${outputLanguage}。JSON 字段名必须保持英文。`,
      "不要编造图片中看不出或无法谨慎推断的事实；不确定时用保守表达或留空。",
      "请按旧版产品卖点结构理解信息：产品名、核心卖点、适用人群、期望场景、尺寸参数。",
      "核心卖点要服务手机电商图生成：短、具体、能用于货架小图或详情首屏，不要写长句，不要写平台色引导。",
      "avoid 字段列出生成时应该避开的风险词，例如：假价格、假折扣、医疗功效、伪造认证、二维码、电话号码、水印；只列与该商品相关的风险。",
      "返回 JSON schema：",
      schema
    ].join("\n");
  }

  return [
    `You are an experienced ${englishPlatformScope} product listing operator for ${targetPlatform}.`,
    "Analyze the uploaded product image and infer useful listing information. Return JSON only.",
    `Write all customer-facing values in ${outputLanguage}.`,
    "Do not invent facts that are not visually supported. If uncertain, use cautious wording.",
    "For sellingPoints, generate practical marketplace benefits based on visible product features, packaging, category, usage scenario, and Chinese platform conversion style.",
    "For avoid, list risky generation words to avoid, such as fake price, fake discount, medical claim, fake certification, QR code, phone number, watermark, if relevant.",
    "JSON schema:",
    schema
  ].join("\n");
}

export async function analyzeProductImage(userId: string, file: File, language: Language, platform?: PlatformKey) {
  const settings = await getUserImageApiSettings(userId, true);
  const baseUrl = settings.baseUrl.replace(/\/$/, "");
  const apiKey = settings.apiKey || "";
  const model = process.env.IMAGE_ANALYSIS_MODEL || "gpt-5.4";

  if (!baseUrl || !apiKey) {
    throw new Error("商品识别接口配置不完整，请先配置 IMAGE_API_BASE 和 IMAGE_API_KEY。");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${mimeFromFile(file)};base64,${bytes.toString("base64")}`;
  const prompt = buildAnalysisPrompt(language, platform);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ]
    })
  });

  const raw = await response.text();
  if (!response.ok) {
    let message = raw.slice(0, 300);
    try {
      message = JSON.parse(raw)?.error?.message || message;
    } catch {
      // Keep the raw preview.
    }
    throw new Error(`商品识别失败：${message}`);
  }

  return normalizeAnalysis(parseJsonFromText(extractChatContent(raw)));
}
