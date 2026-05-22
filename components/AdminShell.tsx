"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUserSession } from "@/components/UserSession";

const adminNav = [
  { href: "/admin", label: "数据看板", exact: true },
  { href: "/admin/users", label: "用户管理" },
  { href: "/admin/generations", label: "生成记录" },
  { href: "/admin/credits", label: "积分流水" },
  { href: "/admin/logs/api", label: "API 日志" },
  { href: "/admin/logs/system", label: "系统日志" },
  { href: "/admin/settings", label: "系统设置" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUserSession();
  const current = adminNav.find((item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)));

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-xs font-bold text-white">A</span>
          <span className="text-sm font-semibold">管理后台</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">运营</div>
          <ul className="space-y-1">
            {adminNav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-slate-200 px-4 py-4 text-xs text-slate-500">
          <div className="mb-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-400">登录</div>
            <div className="mt-0.5 truncate text-slate-700">{user?.phone || "-"}</div>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/" className="rounded border border-slate-200 px-3 py-1.5 text-center text-xs hover:bg-slate-50">
              返回前台
            </Link>
            <button onClick={logout} className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50">
              退出登录
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6">
          <div className="text-xs text-slate-400">管理后台</div>
          <span className="text-slate-300">/</span>
          <div className="text-sm font-semibold text-slate-900">{current?.label || ""}</div>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
            <span className="hidden md:inline">{user?.role === "ADMIN" ? "管理员" : "未授权"}</span>
            <span className="hidden md:inline-flex rounded-full border border-slate-200 px-2 py-0.5">
              积分 <span className="ml-1 font-medium text-slate-700">{user?.credits ?? 0}</span>
            </span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
