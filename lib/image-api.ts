import type { CallLog, ImagePlan } from "./types";
import { getImageApiSettings } from "@/lib/settings";

const MAX_RETRIES = 2;

export type ImageCallResult =
  | { ok: true; imageUrl: string; log: CallLog }
  | { ok: false; error: string; log: CallLog };

function normalizeModel(input: string) {
  const raw = input.trim().replace(/^["']|["']$/g, "");
  const leakedEnvIndex = raw.indexOf("DATABASE_URL");
  const value = leakedEnvIndex >= 0 ? raw.slice(0, leakedEnvIndex) : raw;
  return value;
}

async function imageApiConfig() {
  const settings = await getImageApiSettings(true);
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

function normalizeSize(size: string) {
  const fallback = "1024x1024";
  const match = /^(\d+)x(\d+)$/.exec(size || "");
  if (!match) return fallback;
  const width = Math.min(1536, Math.max(768, Math.floor(Number(match[1]) / 16) * 16));
  const height = Math.min(1536, Math.max(768, Math.floor(Number(match[2]) / 16) * 16));
  const pixels = width * height;
  if (pixels > 2_097_152) return fallback;
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

async function requestWithRetry(url: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Image API request failed.");
}

export async function generateEditedImage(plan: ImagePlan, productImage: File): Promise<ImageCallResult> {
  const startedAt = Date.now();
  const normalizedSize = normalizeSize(plan.size);
  const config = await imageApiConfig();
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
    formData.append("prompt", plan.prompt);
    formData.append("image", imageBlob, productImage.name || "product.png");
    formData.append("size", normalizedSize);
    formData.append("quality", "medium");
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
