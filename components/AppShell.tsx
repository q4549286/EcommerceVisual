"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useUserSession } from "@/components/UserSession";

const navItems = [
  { href: "/", label: "首页", mark: "⌂" },
  { href: "/history", label: "历史", mark: "▣" },
  { href: "/admin/settings", label: "API", mark: "⚙" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useUserSession();

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[520px] bg-[radial-gradient(ellipse_at_52%_0%,rgba(255,147,61,0.35),transparent_34%),radial-gradient(ellipse_at_26%_10%,rgba(43,190,255,0.14),transparent_24%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,rgba(7,7,7,0.08),#070707_62%)]" />

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg text-white/80 backdrop-blur md:hidden" aria-label="菜单">
            ≡
          </button>
          <Link href="/" className="inline-flex items-center gap-2">
            <Image src="/brand/ecommerce-mascot.png" alt="" width={32} height={32} className="h-8 w-8 rounded-xl object-cover shadow-lg shadow-[#ff7a2f]/20" priority />
            <span className="text-xl font-black tracking-tight text-white">电商专用</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "ADMIN" ? (
            <Link href="/admin/settings" className="hidden rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/75 backdrop-blur hover:bg-white/[0.15] sm:inline-flex">
              API 管理
            </Link>
          ) : null}
          {user ? (
            <button
              onClick={logout}
              className="rounded-full bg-gradient-to-r from-[#ff7a2f] to-[#df37d8] px-5 py-2 text-sm font-medium text-white shadow-lg shadow-[#df37d8]/20"
            >
              退出
            </button>
          ) : (
            <Link href="/login" className="rounded-full bg-gradient-to-r from-[#ff7a2f] to-[#df37d8] px-5 py-2 text-sm font-medium text-white shadow-lg shadow-[#df37d8]/20">
              API 管理
            </Link>
          )}
        </div>
      </header>

      <aside className="fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 rounded-[28px] border border-white/[0.08] bg-white/[0.08] p-2 shadow-2xl shadow-black/40 backdrop-blur-xl md:block">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/10 text-xl text-white/70 hover:bg-white/[0.15]" aria-label="新建">
            +
          </Link>
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg transition ${active ? "bg-white text-[#111]" : "text-white/60 hover:bg-white/[0.12] hover:text-white"}`}
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
