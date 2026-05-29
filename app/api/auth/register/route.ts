import { NextResponse } from "next/server";
import { AuthError, registerWithPassword, secureCookieForRequest, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await registerWithPassword(String(body?.phone || ""), String(body?.password || ""));
    const response = NextResponse.json({ ok: true, user: result.user });
    setSessionCookie(response, result.session.token, result.session.expiresAt, secureCookieForRequest(request));
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "注册失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
