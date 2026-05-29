import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { UserSessionProvider } from "@/components/UserSession";
import { getUserByToken } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "椒图AI 工作台",
  description: "中文 AI 修图、电商套图与商品图生成工作台。"
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("ecv_session")?.value;
  const user = await getUserByToken(token).catch(() => null);

  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <UserSessionProvider initialUser={user}>
          <ToastProvider>{children}</ToastProvider>
        </UserSessionProvider>
      </body>
    </html>
  );
}
