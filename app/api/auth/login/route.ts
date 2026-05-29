import { NextResponse } from "next/server";
import { AuthError, loginWithApiSettings, loginWithPassword, setSessionCookie } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  try {
    const body = isFormPost
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json();
    const result = body?.imageApi
      ? await loginWithApiSettings({
        baseUrl: String(body.imageApi.baseUrl || ""),
        apiKey: String(body.imageApi.apiKey || ""),
        model: String(body.imageApi.model || "")
      })
      : isFormPost
        ? await loginWithApiSettings({
          baseUrl: String(body.baseUrl || ""),
          apiKey: String(body.apiKey || ""),
          model: String(body.model || "")
        })
      : await loginWithPassword(String(body?.phone || ""), String(body?.password || ""));
    const response = isFormPost
      ? new NextResponse(null, { status: 303, headers: { Location: appPath("/") } })
      : NextResponse.json({ ok: true, user: result.user, nextUrl: appPath("/") });
    setSessionCookie(response, result.session.token, result.session.expiresAt);
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "登录失败。";
    if (isFormPost) {
      const redirectUrl = `${appPath("/login")}?error=${encodeURIComponent(message)}`;
      return new NextResponse(null, { status: 303, headers: { Location: redirectUrl } });
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
