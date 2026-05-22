import { mkdir, writeFile } from "node:fs/promises";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import path from "node:path";
import { getImageStorageSettings } from "@/lib/settings";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

type StoredImageInput = {
  buffer: Buffer;
  mime: string;
  generationId: string;
  imageType: string;
};

type ImageStorage = {
  save(input: StoredImageInput): Promise<string>;
};

function extensionFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "image";
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function isStoredGeneratedImageUrl(value: string) {
  return value.startsWith("/generated/");
}

function fileNameFor(input: StoredImageInput) {
  return `${safeName(input.imageType)}-${Date.now()}.${extensionFromMime(input.mime)}`;
}

const localStorageProvider: ImageStorage = {
  async save(input) {
    const dir = path.join(GENERATED_DIR, safeName(input.generationId));
    const fileName = fileNameFor(input);
    const absolutePath = path.join(dir, fileName);

    await mkdir(dir, { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return `/generated/${safeName(input.generationId)}/${fileName}`;
  }
};

const objectStorageProvider: ImageStorage = {
  async save(input) {
    const settings = await getImageStorageSettings(true);
    if (!settings.enabled) return localStorageProvider.save(input);
    if (!settings.endpoint || !settings.bucket || !settings.accessKeyId || !settings.secretAccessKey || !settings.publicBaseUrl) {
      throw new Error("对象存储配置不完整，请到管理后台系统设置中补全。");
    }

    const fileName = fileNameFor(input);
    const key = [settings.pathPrefix, safeName(input.generationId), fileName].map(trimSlashes).filter(Boolean).join("/");
    const client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region || "auto",
      forcePathStyle: true,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey
      }
    });

    await client.send(new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.mime
    }));

    return `${settings.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
};

async function storageProvider() {
  const settings = await getImageStorageSettings(false);
  return settings.enabled ? objectStorageProvider : localStorageProvider;
}

export async function persistGeneratedImageUrl(imageUrl: string, generationId: string, imageType: string) {
  if (!imageUrl.startsWith("data:image/")) return imageUrl;

  const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return imageUrl;

  const mime = match[1];
  const base64 = match[2];
  return (await storageProvider()).save({
    buffer: Buffer.from(base64, "base64"),
    mime,
    generationId,
    imageType
  });
}
