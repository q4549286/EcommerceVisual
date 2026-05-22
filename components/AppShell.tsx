"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUserSession } from "@/components/UserSession";

const navItems = [
  { href: "/", label: "工作台" },
  { href: "/history", label: "历史记录" },
  { href: "/account", label: "账号中心" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUserSession();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-xs font-bold text-white">E</span>
            <span>电商商品图生成器</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 sm:inline-flex">
                  积分 <span className="ml-1 font-semibold text-slate-900">{user.credits}</span>
                </span>
                {user.role === "ADMIN" ? (
                  <Link
                    href="/admin"
                    className="hidden rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 sm:inline-flex"
                  >
                    管理后台
                  </Link>
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="hidden text-right text-xs leading-tight sm:block">
                    <div className="font-medium text-slate-700">{user.phone}</div>
                    <div className="text-slate-400">{user.role === "ADMIN" ? "管理员" : "普通用户"}</div>
                  </div>
                  <button
                    onClick={logout}
                    className="rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    退出
                  </button>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-black"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
