import type { CallLog, ImagePlan, QualityMode } from "./types";
import { getUserImageApiSettings } from "@/lib/settings";

const MAX_RETRIES = 2;
const IMAGE_API_TIMEOUT_MS = Number(process.env.IMAGE_API_TIMEOUT_MS || 240_000);

export type ImageCallResult =
  | { ok: true; imageUrl: string; log: CallLog }
  | { ok: false; error: string; log: CallLog };

function normalizeModel(input: string) {
  const raw = input.trim().replace(/^["']|["']$/g, "");
  const leakedEnvIndex = raw.indexOf("DATABASE_URL");
  const value = leakedEnvIndex >= 0 ? raw.slice(0, leakedEnvIndex) : raw;
  return value;
}

async function imageApiConfig(userId: string) {
  const settings = await getUserImageApiSettings(userId, true);
  return {
    baseUrl: settings.baseUrl.replace(/\/$/, ""),
    apiKey: settings.apiKey || "",
    model: normalizeModel(settings.model)
  };
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

function normalizeSize(size: string, qualityMode: QualityMode = "fast") {
  const fallback = "1024x1024";
  const match = /^(\d+)x(\d+)$/.exec(size || "");
  if (!match) return fallback;
  const maxSide = qualityMode === "hd" ? 2048 : 1024;
  const sourceWidth = Number(match[1]);
  const sourceHeight = Number(match[2]);
  const ratioScale = maxSide / Math.max(sourceWidth, sourceHeight);
  const width = Math.max(768, Math.floor(sourceWidth * ratioScale / 16) * 16);
  const height = Math.max(768, Math.floor(sourceHeight * ratioScale / 16) * 16);
  if (Math.max(width / height, height / width) > 3) return fallback;
  return `${width}x${height}`;
}

async function parseImageResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Image API returned non-JSON response: ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : JSON.stringify(data).slice(0, 200);
    throw new Error(`Image API HTTP ${response.status}: ${message}`);
  }

  const first = data?.data?.[0];
  if (!first) {
    throw new Error("Image API returned no image data.");
  }

  if (first.b64_json) {
    return `data:image/png;base64,${first.b64_json}`;
  }

  if (first.url) {
    return first.url as string;
  }

  throw new Error("Image API response did not include b64_json or url.");
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_API_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestWithRetry(url: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init);
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (isAbortError(error)) {
        lastError = new Error(`Image API request timed out after ${Math.round(IMAGE_API_TIMEOUT_MS / 1000)}s.`);
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Image API request failed.");
}

export async function generateEditedImage(userId: string, plan: ImagePlan, productImage: File, referenceImages: File[] = [], qualityMode: QualityMode = "fast"): Promise<ImageCallResult> {
  const startedAt = Date.now();
  const normalizedSize = normalizeSize(plan.size, qualityMode);
  const config = await imageApiConfig(userId);
  const endpointUrl = config.baseUrl ? `${config.baseUrl}/images/edits` : "";
  const modelName = config.model;

  const baseLog = {
    id: newId(),
    timestamp: startedAt,
    endpoint: endpointUrl,
    model: modelName,
    imageType: plan.type,
    size: normalizedSize
  };

  if (!config.baseUrl || !config.apiKey || !config.model) {
    const message = "图像生成接口配置不完整，请在管理后台系统设置中填写 IMAGE_API_BASE、IMAGE_API_KEY 和 IMAGE_MODEL。";
    return {
      ok: false,
      error: message,
      log: { ...baseLog, status: 0, durationMs: 0, ok: false, error: message }
    };
  }

  let status = 0;
  try {
    const bytes = await productImage.arrayBuffer();
    const mime = mimeFromFile(productImage);
    const imageBlob = new Blob([bytes], { type: mime });
    const formData = new FormData();
    formData.append("model", modelName);
    formData.append("prompt", referenceImages.length > 0
      ? `${plan.prompt}

REFERENCE IMAGE RULES:
The first uploaded image is the product image and must define the real SKU. The additional uploaded images are reference images only. Use reference images for visual style, composition, lighting, layout rhythm, angle, scene mood, or poster/detail-page direction, but do not replace the product identity with objects from reference images.`
      : plan.prompt);
    formData.append("image", imageBlob, productImage.name || "product.png");
    const selectedReferences = referenceImages.slice(0, 6);
    for (let index = 0; index < selectedReferences.length; index += 1) {
      const referenceImage = selectedReferences[index];
      const refBytes = await referenceImage.arrayBuffer();
      const refBlob = new Blob([refBytes], { type: mimeFromFile(referenceImage) });
      formData.append("image", refBlob, referenceImage.name || `reference-${index + 1}.png`);
    }
    formData.append("size", normalizedSize);
    formData.append("quality", qualityMode === "hd" ? "high" : "medium");
    formData.append("n", "1");
    formData.append("output_format", "png");
    formData.append("response_format", "b64_json");

    const response = await requestWithRetry(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "X-Client-Request-Id": newId()
      },
      body: formData
    });
    status = response.status;
    const imageUrl = await parseImageResponse(response);
    return {
      ok: true,
      imageUrl,
      log: { ...baseLog, status, durationMs: Date.now() - startedAt, ok: true }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成失败。";
    return {
      ok: false,
      error: message,
      log: { ...baseLog, status, durationMs: Date.now() - startedAt, ok: false, error: message }
    };
  }
}

export async function generateTextImage(userId: string, plan: ImagePlan, qualityMode: QualityMode = "fast"): Promise<ImageCallResult> {
  const startedAt = Date.now();
  const normalizedSize = normalizeSize(plan.size, qualityMode);
  const config = await imageApiConfig(userId);
  const endpointUrl = config.baseUrl ? `${config.baseUrl}/images/generations` : "";
  const modelName = config.model;

  const baseLog = {
    id: newId(),
    timestamp: startedAt,
    endpoint: endpointUrl,
    model: modelName,
    imageType: plan.type,
    size: normalizedSize
  };

  if (!config.baseUrl || !config.apiKey || !config.model) {
    const message = "图像生成接口配置不完整，请在管理后台系统设置中填写 IMAGE_API_BASE、IMAGE_API_KEY 和 IMAGE_MODEL。";
    return {
      ok: false,
      error: message,
      log: { ...baseLog, status: 0, durationMs: 0, ok: false, error: message }
    };
  }

  let status = 0;
  try {
    const response = await requestWithRetry(endpointUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "X-Client-Request-Id": newId()
      },
      body: JSON.stringify({
        model: modelName,
        prompt: plan.prompt,
        size: normalizedSize,
        quality: qualityMode === "hd" ? "high" : "medium",
        n: 1,
        output_format: "png",
        response_format: "b64_json"
      })
    });
    status = response.status;
    const imageUrl = await parseImageResponse(response);
    return {
      ok: true,
      imageUrl,
      log: { ...baseLog, status, durationMs: Date.now() - startedAt, ok: true }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片生成失败。";
    return {
      ok: false,
      error: message,
      log: { ...baseLog, status, durationMs: Date.now() - startedAt, ok: false, error: message }
    };
  }
}
