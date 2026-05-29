import { redirect } from "next/navigation";
import { appPath } from "@/lib/paths";

export default function AdminCreditsPage() {
  redirect(appPath("/admin/logs/api"));
}
