import { prisma } from "@/lib/prisma";

const DEFAULT_LOGIN_BONUS_CREDITS = 4;

export type ImageStorageSettings = {
  enabled: boolean;
  provider: "s3";
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey?: string;
  publicBaseUrl: string;
  pathPrefix: string;
  secretConfigured?: boolean;
};

export type ImageApiSettings = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  keyConfigured?: boolean;
};

type SettingRow = { value: unknown };

function parsePositiveInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 1000) return fallback;
  return numeric;
}

function parseObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getSettingValue<T>(key: string, fallback: T) {
  try {
    const rows = await prisma.$queryRaw<SettingRow[]>`SELECT value FROM "SystemSetting" WHERE key = ${key} LIMIT 1`;
    return rows[0]?.value as T ?? fallback;
  } catch {
    return fallback;
  }
}

async function setSettingValue(key: string, value: unknown) {
  await prisma.$executeRaw`
    INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
  `;
}

export async function getLoginBonusCredits() {
  try {
    const rows = await prisma.$queryRaw<SettingRow[]>`SELECT value FROM "SystemSetting" WHERE key = 'loginBonusCredits' LIMIT 1`;
    return parsePositiveInteger(rows[0]?.value, DEFAULT_LOGIN_BONUS_CREDITS);
  } catch {
    return DEFAULT_LOGIN_BONUS_CREDITS;
  }
}

export async function setLoginBonusCredits(value: number) {
  const credits = parsePositiveInteger(value, -1);
  if (credits < 0) {
    throw new Error("登录赠送积分必须是 0 到 1000 之间的整数。");
  }

  await prisma.$executeRaw`
    INSERT INTO "SystemSetting" (key, value, "createdAt", "updatedAt")
    VALUES ('loginBonusCredits', to_jsonb(${credits}::int), NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
  `;
  return credits;
}

export async function getImageStorageSettings(includeSecret = false): Promise<ImageStorageSettings> {
  const value = parseObject(await getSettingValue("imageStorage", {}));
  const secretAccessKey = stringValue(value.secretAccessKey);
  return {
    enabled: value.enabled === true,
    provider: "s3",
    endpoint: stringValue(value.endpoint),
    region: stringValue(value.region) || "auto",
    bucket: stringValue(value.bucket),
    accessKeyId: stringValue(value.accessKeyId),
    secretAccessKey: includeSecret ? secretAccessKey : "",
    publicBaseUrl: stringValue(value.publicBaseUrl),
    pathPrefix: stringValue(value.pathPrefix) || "generated",
    secretConfigured: Boolean(secretAccessKey)
  };
}

export async function setImageStorageSettings(input: Partial<ImageStorageSettings>) {
  const current = await getImageStorageSettings(true);
  const next: ImageStorageSettings = {
    enabled: input.enabled === true,
    provider: "s3",
    endpoint: stringValue(input.endpoint),
    region: stringValue(input.region) || "auto",
    bucket: stringValue(input.bucket),
    accessKeyId: stringValue(input.accessKeyId),
    secretAccessKey: stringValue(input.secretAccessKey) || current.secretAccessKey || "",
    publicBaseUrl: stringValue(input.publicBaseUrl),
    pathPrefix: stringValue(input.pathPrefix) || "generated"
  };

  if (next.enabled) {
    const missing = [
      ["endpoint", next.endpoint],
      ["bucket", next.bucket],
      ["accessKeyId", next.accessKeyId],
      ["secretAccessKey", next.secretAccessKey],
      ["publicBaseUrl", next.publicBaseUrl]
    ].filter(([, value]) => !value).map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(`对象存储启用失败，缺少配置：${missing.join(", ")}。`);
    }
  }

  await setSettingValue("imageStorage", next);
  return getImageStorageSettings(false);
}

export async function getImageApiSettings(includeSecret = false): Promise<ImageApiSettings> {
  const value = parseObject(await getSettingValue("imageApi", {}));
  const storedApiKey = stringValue(value.apiKey);
  const envApiKey = stringValue(process.env.IMAGE_API_KEY);
  return {
    baseUrl: stringValue(value.baseUrl) || stringValue(process.env.IMAGE_API_BASE),
    apiKey: includeSecret ? storedApiKey || envApiKey : "",
    model: stringValue(value.model) || stringValue(process.env.IMAGE_MODEL) || "gpt-image-2",
    keyConfigured: Boolean(storedApiKey || envApiKey)
  };
}

export async function getUserImageApiSettings(userId: string, includeSecret = false): Promise<ImageApiSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, imageApiConfig: true }
  }).catch(() => null);
  const value = parseObject(user?.imageApiConfig);
  const storedApiKey = stringValue(value.apiKey);
  if (stringValue(value.baseUrl) || storedApiKey || stringValue(value.model)) {
    return {
      baseUrl: stringValue(value.baseUrl),
      apiKey: includeSecret ? storedApiKey : "",
      model: stringValue(value.model) || "gpt-image-2",
      keyConfigured: Boolean(storedApiKey)
    };
  }
  if (user?.phone.startsWith("api-manager")) {
    return {
      baseUrl: "",
      apiKey: "",
      model: "gpt-image-2",
      keyConfigured: false
    };
  }
  return getImageApiSettings(includeSecret);
}

export async function setUserImageApiSettings(userId: string, input: Partial<ImageApiSettings>) {
  const baseUrl = stringValue(input.baseUrl).replace(/\/$/, "");
  const apiKey = stringValue(input.apiKey);
  const model = stringValue(input.model) || "gpt-image-2";
  if (!/^https?:\/\/.+/i.test(baseUrl)) {
    throw new Error("请输入有效的 API Base URL。");
  }
  if (!apiKey || apiKey.length < 12) {
    throw new Error("请输入有效的 API Key。");
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      imageApiConfig: { baseUrl, apiKey, model }
    }
  });
  return getUserImageApiSettings(userId, false);
}

export async function setImageApiSettings(input: Partial<ImageApiSettings>) {
  const current = parseObject(await getSettingValue("imageApi", {}));
  const currentApiKey = stringValue(current.apiKey);
  const next: ImageApiSettings = {
    baseUrl: stringValue(input.baseUrl),
    apiKey: stringValue(input.apiKey) || currentApiKey,
    model: stringValue(input.model)
  };

  await setSettingValue("imageApi", next);
  return getImageApiSettings(false);
}

export async function getAdminSettings() {
  return {
    loginBonusCredits: await getLoginBonusCredits(),
    generationCreditCost: 1,
    imageStorage: await getImageStorageSettings(false),
    imageApi: await getImageApiSettings(false)
  };
}
