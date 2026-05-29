import { redirect } from "next/navigation";
import { appPath } from "@/lib/paths";

export default function AdminUsersPage() {
  redirect(appPath("/admin/logs/api"));
}
