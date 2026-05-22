import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ecv_session";

const PROTECTED_PREFIXES = ["/admin", "/history", "/account"];
const AUTH_PAGES = ["/login", "/register"];

function isProtected(pathname: string) {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPage(pathname: string) {
  return AUTH_PAGES.includes(pathname);
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  if (!token && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (token && isAuthPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/history/:path*",
    "/account/:path*",
    "/admin/:path*"
  ]
};
