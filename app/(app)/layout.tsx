import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getUserByToken } from "@/lib/auth";
import { appPath } from "@/lib/paths";

export default async function AppRouteLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("ecv_session")?.value;
  const user = await getUserByToken(token).catch(() => null);
  if (!user) {
    redirect(appPath("/login"));
  }
  return <AppShell>{children}</AppShell>;
}
