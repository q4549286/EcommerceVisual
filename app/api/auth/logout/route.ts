import { NextResponse } from "next/server";
import { clearSessionCookie, deleteCurrentSession, secureCookieForRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await deleteCurrentSession(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response, secureCookieForRequest(request));
  return response;
}
