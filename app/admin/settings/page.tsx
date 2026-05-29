import { redirect } from "next/navigation";
import { appPath } from "@/lib/paths";

export default function AdminSettingsPage() {
  redirect(appPath("/admin/logs/api"));
}
