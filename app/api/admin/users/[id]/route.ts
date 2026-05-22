import { NextResponse } from "next/server";
import { AuthError, hashPassword, requireAdmin, validatePassword } from "@/lib/auth";
import { setUserCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { writeSystemLog } from "@/lib/server-logs";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await context.params;
    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body?.status !== undefined) {
      if (body.status !== "ACTIVE" && body.status !== "DISABLED") {
        return NextResponse.json({ ok: false, error: "状态参数错误。" }, { status: 400 });
      }
      data.status = body.status;
    }

    if (body?.role !== undefined) {
      if (body.role !== "USER" && body.role !== "ADMIN") {
        return NextResponse.json({ ok: false, error: "角色参数错误。" }, { status: 400 });
      }
      data.role = body.role;
    }

    if (body?.password !== undefined && String(body.password).length > 0) {
      const password = String(body.password);
      validatePassword(password);
      data.passwordHash = await hashPassword(password);
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({
        where: { id },
        data
      });
    }

    if (body?.credits !== undefined) {
      await setUserCredits(id, Number(body.credits), admin.id);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        role: true,
        status: true,
        credits: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "用户不存在。" }, { status: 404 });
    }

    await writeSystemLog({
      userId: admin.id,
      action: "admin.user_update",
      message: `管理员更新用户 ${user.phone}`,
      metadata: { targetUserId: id }
    });

    return NextResponse.json({
      ok: true,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null
      }
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "更新用户失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
