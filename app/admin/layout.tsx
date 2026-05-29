import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/AdminShell";
import { getUserByToken } from "@/lib/auth";

export default async function AdminRouteLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("ecv_session")?.value;
  const user = await getUserByToken(token).catch(() => null);
  if (!user) {
    redirect("/login?next=/admin");
  }
  if (user.role !== "ADMIN") {
    redirect("/");
  }
  return <AdminShell>{children}</AdminShell>;
}
