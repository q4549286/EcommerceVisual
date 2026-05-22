import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { getAdminSettings, setImageApiSettings, setImageStorageSettings, setLoginBonusCredits } from "@/lib/settings";
import { writeSystemLog } from "@/lib/server-logs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const settings = await getAdminSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取设置失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();
    if (body?.loginBonusCredits !== undefined) {
      await setLoginBonusCredits(Number(body.loginBonusCredits));
    }
    if (body?.imageStorage !== undefined) {
      await setImageStorageSettings(body.imageStorage);
    }
    if (body?.imageApi !== undefined) {
      await setImageApiSettings(body.imageApi);
    }
    const settings = await getAdminSettings();
    await writeSystemLog({
      userId: admin.id,
      action: "admin.settings_update",
      message: "管理员更新系统设置",
      metadata: {
        loginBonusCredits: settings.loginBonusCredits,
        imageStorageEnabled: settings.imageStorage.enabled,
        imageApiConfigured: settings.imageApi.keyConfigured
      }
    });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "更新设置失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
