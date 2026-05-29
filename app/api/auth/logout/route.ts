import { NextResponse } from "next/server";
import { clearSessionCookie, deleteCurrentSession } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await deleteCurrentSession(request);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export async function GET(request: Request) {
  await deleteCurrentSession(request);
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: appPath("/login") }
  });
  clearSessionCookie(response);
  return response;
}
