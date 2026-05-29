import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextResponse } from "next/server";
import { grantLoginCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { writeSystemLog } from "@/lib/server-logs";
import { setImageApiSettings } from "@/lib/settings";
import type { AuthUser } from "@/lib/types";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "ecv_session";
const SESSION_DAYS = 30;
const API_WORKSPACE_PHONE = "api-manager";
const API_WORKSPACE_CREDITS = 1_000_000;

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function normalizePhone(phone: string) {
  return phone.trim().replace(/[\s-]/g, "");
}

export function validatePhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!/^\+?\d{6,20}$/.test(normalized)) {
    throw new AuthError("请输入有效手机号。", 400);
  }
  return normalized;
}

export function validatePassword(password: string) {
  if (password.length < 6 || password.length > 72) {
    throw new AuthError("密码长度需为 6-72 位。", 400);
  }
}

export async function hashPassword(password: string) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [method, salt, key] = stored.split(":");
  if (method !== "scrypt" || !salt || !key) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  if (storedKey.length !== derivedKey.length) return false;
  return timingSafeEqual(storedKey, derivedKey);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const parts = raw.split(";").map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${name}=`));
  if (!pair) return "";
  return decodeURIComponent(pair.slice(name.length + 1));
}

function toAuthUser(user: {
  id: string;
  phone: string;
  role: string;
  status: string;
  credits: number;
  createdAt: Date;
  lastLoginAt: Date | null;
}): AuthUser {
  return {
    id: user.id,
    phone: user.phone === API_WORKSPACE_PHONE ? "API 工作区" : user.phone,
    role: user.role as AuthUser["role"],
    status: user.status as AuthUser["status"],
    credits: user.credits,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
  };
}

async function ensureApiWorkspaceUser() {
  const existing = await prisma.user.findUnique({
    where: { phone: API_WORKSPACE_PHONE }
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
        credits: existing.credits < 1000 ? API_WORKSPACE_CREDITS : existing.credits,
        lastLoginAt: new Date()
      }
    });
  }

  return prisma.user.create({
    data: {
      phone: API_WORKSPACE_PHONE,
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      role: "ADMIN",
      status: "ACTIVE",
      credits: API_WORKSPACE_CREDITS,
      lastLoginAt: new Date()
    }
  });
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function deleteCurrentSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await prisma.session.deleteMany({
    where: {
      tokenHash: hashSessionToken(token)
    }
  });
}

export async function getUserByToken(token: string | undefined | null) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true }
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (session.user.status !== "ACTIVE") {
    throw new AuthError("账号已停用，请联系管理员。", 403);
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => undefined);

  return toAuthUser(session.user);
}

export async function getCurrentUser(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  return getUserByToken(token);
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthError("请先登录。", 401);
  }
  return user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") {
    throw new AuthError("无后台权限。", 403);
  }
  return user;
}

export async function registerWithPassword(phone: string, password: string) {
  const normalizedPhone = validatePhone(phone);
  validatePassword(password);

  const exists = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true }
  });

  if (exists) {
    throw new AuthError("该手机号已注册。", 409);
  }

  const userCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      phone: normalizedPhone,
      passwordHash: await hashPassword(password),
      role: userCount === 0 ? "ADMIN" : "USER",
      lastLoginAt: new Date()
    }
  });

  const credits = await grantLoginCredits(user.id);
  const session = await createSession(user.id);
  await writeSystemLog({
    userId: user.id,
    action: "auth.register",
    message: user.role === "ADMIN" ? "首个账号注册为管理员" : "用户注册"
  });

  return {
    user: toAuthUser({ ...user, credits }),
    session
  };
}

export async function loginWithPassword(phone: string, password: string) {
  const normalizedPhone = validatePhone(phone);
  validatePassword(password);

  const user = await prisma.user.findUnique({
    where: { phone: normalizedPhone }
  });

  if (!user) {
    throw new AuthError("手机号或密码错误。", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("账号已停用，请联系管理员。", 403);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await writeSystemLog({
      userId: user.id,
      level: "WARN",
      action: "auth.login_failed",
      message: "密码错误"
    });
    throw new AuthError("手机号或密码错误。", 401);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });
  const credits = await grantLoginCredits(user.id);
  const session = await createSession(user.id);
  await writeSystemLog({
    userId: user.id,
    action: "auth.login",
    message: "用户登录"
  });

  return {
    user: toAuthUser({ ...updated, credits }),
    session
  };
}

export async function loginWithApiSettings(input: { baseUrl: string; apiKey: string; model: string }) {
  const baseUrl = input.baseUrl.trim().replace(/\/$/, "");
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();

  if (!/^https?:\/\/.+/i.test(baseUrl)) {
    throw new AuthError("请输入有效的 API Base URL。", 400);
  }
  if (!apiKey || apiKey.length < 12) {
    throw new AuthError("请输入有效的 API Key。", 400);
  }
  if (!model) {
    throw new AuthError("请输入图片模型名称。", 400);
  }

  await setImageApiSettings({ baseUrl, apiKey, model });
  const user = await ensureApiWorkspaceUser();
  const session = await createSession(user.id);

  await writeSystemLog({
    userId: user.id,
    action: "auth.api_manager_login",
    message: "通过 API 配置进入工作区",
    metadata: {
      baseUrl,
      model,
      apiKeyConfigured: true
    }
  });

  return {
    user: toAuthUser(user),
    session
  };
}
