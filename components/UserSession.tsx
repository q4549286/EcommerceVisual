"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/types";

type Ctx = {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<Ctx | null>(null);

export function UserSessionProvider({
  initialUser = null,
  children
}: {
  initialUser?: AuthUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  // 同步服务端 RSC 重新渲染传入的 initialUser，避免登录后右上角不更新
  // 仅在没有本地最新态时同步，避免覆盖 setUser 的乐观更新
  useEffect(() => {
    setUser((current) => {
      if (!current && initialUser) return initialUser;
      if (current && initialUser && current.id === initialUser.id) {
        // 同账号：用服务端最新值（积分、状态等）覆盖
        return initialUser;
      }
      if (!initialUser) return null;
      return initialUser;
    });
  }, [initialUser]);

  return (
    <UserContext.Provider value={{ user, loading, setUser, refresh, logout }}>{children}</UserContext.Provider>
  );
}

export function useUserSession() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserSession must be used inside <UserSessionProvider />");
  return ctx;
}
