import { NextResponse } from "next/server";
import { AuthError, loginWithApiSettings, loginWithPassword, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = body?.imageApi
      ? await loginWithApiSettings({
        baseUrl: String(body.imageApi.baseUrl || ""),
        apiKey: String(body.imageApi.apiKey || ""),
        model: String(body.imageApi.model || "")
      })
      : await loginWithPassword(String(body?.phone || ""), String(body?.password || ""));
    const response = NextResponse.json({ ok: true, user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "登录失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
