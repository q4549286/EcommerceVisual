import type { ImagePlan, ImageTypeKey, ImageTypeOption, ProductInput } from "./types";

export const imageTypeOptions: ImageTypeOption[] = [
  {
    key: "main_white_bg",
    title: "白底首图",
    shortTitle: "白底首图",
    description: "纯白背景、商品居中、无文字、无水印。",
    defaultSelected: true
  },
  {
    key: "feature_infographic",
    title: "亮点介绍图",
    shortTitle: "亮点介绍图",
    description: "副图，本地化卖点 3-5 条。",
    defaultSelected: true
  },
  {
    key: "detail_specs",
    title: "细节规格图",
    shortTitle: "细节规格图",
    description: "材质、尺寸、包装与功能细节。",
    defaultSelected: true
  },
  {
    key: "lifestyle",
    title: "使用场景图",
    shortTitle: "使用场景图",
    description: "真实场景中的商品展示。",
    defaultSelected: false
  }
];

const defaultBenefits: Record<"en" | "zh-CN" | "zh-TW", string[]> = {
  en: ["Clean Design", "Daily Use Ready", "Quality Material", "Easy to Use"],
  "zh-CN": ["简约设计", "日常好用", "质感材质", "使用方便"],
  "zh-TW": ["簡約設計", "日常好用", "質感材質", "使用方便"]
};

const defaultDetailLabels: Record<"en" | "zh-CN" | "zh-TW", string[]> = {
  en: ["Material", "Size", "Package Includes", "Easy Care"],
  "zh-CN": ["材质说明", "尺寸规格", "包装内容", "清洁方式"],
  "zh-TW": ["材質說明", "尺寸規格", "包裝內容", "清潔方式"]
};

function languageDescription(lang: "en" | "zh-CN" | "zh-TW") {
  if (lang === "zh-TW") return "Traditional Chinese for Taiwan";
  if (lang === "zh-CN") return "Simplified Chinese for mainland China";
  return "English";
}

function languageShortName(lang: "en" | "zh-CN" | "zh-TW") {
  if (lang === "zh-TW") return "Traditional Chinese";
  if (lang === "zh-CN") return "Simplified Chinese";
  return "English";
}

function normalizeList(values?: string[]) {
  return (values || []).map((item) => item.trim()).filter(Boolean);
}

function sentenceJoin(values: string[]) {
  return values.filter(Boolean).join(", ");
}

function benefits(input: ProductInput) {
  const points = normalizeList(input.sellingPoints);
  if (points.length > 0) return points.slice(0, 5);
  return defaultBenefits[input.language];
}

function detailLabels(input: ProductInput) {
  const labels = [...defaultDetailLabels[input.language]];
  const isChinese = input.language === "zh-TW" || input.language === "zh-CN";
  if (input.material) labels[0] = isChinese ? (input.language === "zh-TW" ? `材質：${input.material}` : `材质：${input.material}`) : `Material: ${input.material}`;
  if (input.size) labels[1] = isChinese ? (input.language === "zh-TW" ? `尺寸：${input.size}` : `尺寸：${input.size}`) : `Size: ${input.size}`;
  return labels;
}

function baseContext(input: ProductInput) {
  return [
    `Product: ${input.productName}`,
    input.category ? `Category: ${input.category}` : "",
    input.brand ? `Brand: ${input.brand}` : "",
    input.color ? `Color: ${input.color}` : "",
    input.material ? `Material: ${input.material}` : "",
    input.size ? `Size: ${input.size}` : "",
    input.audience ? `Target audience: ${input.audience}` : "",
    input.description ? `Description: ${input.description}` : "",
    `Output language: ${languageDescription(input.language)}`
  ].filter(Boolean).join("\n");
}

function negativePrompt(input: ProductInput, extra = "") {
  const avoid = normalizeList(input.avoid);
  return sentenceJoin([
    "watermark",
    "distorted product",
    "wrong product shape",
    "fake certification",
    "unverified claim",
    "medical claim",
    "competitor logo",
    "messy layout",
    "low resolution",
    "blurry",
    "overprocessed",
    ...avoid,
    extra
  ]);
}

function createPlan(input: ProductInput, type: ImageTypeKey): ImagePlan {
  const context = baseContext(input);
  const benefitCopy = benefits(input);
  const detailCopy = detailLabels(input);

  if (type === "main_white_bg") {
    return {
      type,
      title: "白底首图",
      usage: "电商搜索结果与商品详情主图。",
      size: "2048x2048",
      localizedCopy: [],
      designNotes: "纯白背景、商品居中、自然影子、无文字、无 logo、无贴纸、无边框。",
      prompt: `${context}\n\nCreate a high-resolution ecommerce main product image on a pure white background. Keep the real product appearance, proportions, color, material, and visible details. Center the product, make it fill about 80% of the frame, add a soft natural studio shadow, and avoid all text, badges, stickers, watermarks, props, extra accessories, or decorative background elements.`,
      negativePrompt: negativePrompt(input, "text, logo, sticker, badge, promotional label, extra accessory, lifestyle background")
    };
  }

  if (type === "feature_infographic") {
    return {
      type,
      title: "亮点介绍图",
      usage: "副图，呈现 3-5 条本地化卖点。",
      size: "2048x2048",
      localizedCopy: benefitCopy,
      designNotes: "商品为主体，搭配本地化短标签、细线引导与留白。",
      prompt: `${context}\n\nCreate a clean ecommerce feature infographic using the uploaded product as the main subject. Keep the product accurate and prominent. Add ${benefitCopy.length} short benefit callouts in ${languageShortName(input.language)}: ${sentenceJoin(benefitCopy)}. Use a premium clean layout with simple icons, thin callout lines, strong readability, and no exaggerated claims.`,
      negativePrompt: negativePrompt(input, "tiny unreadable text, garbled text, exaggerated claims, crowded composition")
    };
  }

  if (type === "detail_specs") {
    return {
      type,
      title: "细节规格图",
      usage: "副图，材质、尺寸、包装与功能细节说明。",
      size: "1600x2000",
      localizedCopy: detailCopy,
      designNotes: "细节特写与信息块结合，结构清晰、可读性高。",
      prompt: `${context}\n\nCreate a detail and specification ecommerce image for the uploaded product. Show accurate product close-ups and structured information blocks. Include clear localized labels in ${languageShortName(input.language)}: ${sentenceJoin(detailCopy)}. Keep the design clean, credible, and easy to read. Do not invent certifications, measurements, technical data, or functional claims not provided by the user.`,
      negativePrompt: negativePrompt(input, "fake dimensions, fake certificates, fake test report, cluttered text")
    };
  }

  return {
    type,
    title: "使用场景图",
    usage: "副图，呈现真实使用场景与商品氛围。",
    size: "2048x2048",
    localizedCopy: [],
    designNotes: "自然光、真实使用环境、商品清晰可见，无明显文字。",
    prompt: `${context}\n\nCreate a realistic lifestyle ecommerce image showing the product in a natural use-case environment. Keep the product accurate, clear, and visually prominent. The scene should feel authentic and softly lit. Avoid adding text unless it naturally appears on the original product packaging.`,
    negativePrompt: negativePrompt(input, "floating product, unrealistic scene, text overlay, fake person interaction")
  };
}

export function buildImagePlans(input: ProductInput): ImagePlan[] {
  return input.imageTypes.map((type) => createPlan(input, type));
}
