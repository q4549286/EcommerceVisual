import { NextResponse } from "next/server";
import { AuthError, hashPassword, requireUser, validatePassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeSystemLog } from "@/lib/server-logs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const oldPassword = String(body?.oldPassword || "");
    const newPassword = String(body?.newPassword || "");
    validatePassword(newPassword);

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true }
    });
    if (!record) {
      throw new AuthError("用户不存在。", 404);
    }

    const ok = await verifyPassword(oldPassword, record.passwordHash);
    if (!ok) {
      throw new AuthError("原密码不正确。", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    await prisma.session.deleteMany({
      where: { userId: user.id }
    });

    await writeSystemLog({
      userId: user.id,
      action: "auth.password_changed",
      message: "用户修改密码"
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "修改失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
