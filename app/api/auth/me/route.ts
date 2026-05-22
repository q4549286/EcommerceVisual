import { NextResponse } from "next/server";
import { AuthError, getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "获取登录状态失败。";
    return NextResponse.json({ ok: false, user: null, error: message }, { status });
  }
}
