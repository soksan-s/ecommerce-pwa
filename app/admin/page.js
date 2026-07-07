import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminIndexPage() {
  const user = await getCurrentUser({ suppressDatabaseErrors: true });

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  // Admin First-Boot: force password change if they haven't changed the default password
  if (!user.passwordChangedAt) {
    redirect("/admin/change-password");
  }

  return <AdminShell user={user} />;
}
