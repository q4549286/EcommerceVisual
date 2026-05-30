"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUserSession } from "@/components/UserSession";

const navItems = [
  { href: "/", label: "首页", mark: "⌂" },
  { href: "/history", label: "历史", mark: "▣" },
  { href: "/admin/logs/api", label: "日志", mark: "≣" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUserSession();

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,#101010_0%,#070707_42%,#050505_100%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#070707]/86 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-4">
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-lg text-white/80 md:hidden" aria-label="菜单">
            ≡
          </button>
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/brand/ecommerce-mascot.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" priority />
            <span className="text-lg font-semibold tracking-tight text-white">AI 商品图</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "ADMIN" ? (
            <Link href="/admin/logs/api" className="hidden rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/75 hover:bg-white/[0.15] sm:inline-flex">
              日志
            </Link>
          ) : null}
          {user ? (
            <button
              onClick={logout}
              className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              退出
            </button>
          ) : (
            <Link href="/login" className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90">
              API 管理
            </Link>
          )}
        </div>
      </header>

      <aside className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-lg border border-white/[0.08] bg-[#111]/88 p-2 shadow-2xl shadow-black/40 backdrop-blur md:block">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.08] bg-white/10 text-xl text-white/70 hover:bg-white/[0.15]" aria-label="新建">
            +
          </Link>
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg transition ${active ? "bg-white text-[#111]" : "text-white/60 hover:bg-white/[0.12] hover:text-white"}`}
                title={item.label}
              >
                {item.mark}
              </Link>
            );
          })}
        </div>
      </aside>

      <main className="relative z-10 min-h-screen pt-16">{children}</main>
    </div>
  );
}
