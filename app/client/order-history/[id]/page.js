import { redirect } from "next/navigation";

import { ClientShell } from "@/components/client-shell";
import { canAccessClient, getCurrentUser, getDefaultRouteForRole } from "@/lib/auth";

export default async function ClientOrderDetailPage({ params }) {
  const user = await getCurrentUser({ suppressDatabaseErrors: true });
  const { id } = await params;

  if (!user) {
    redirect("/login");
  }

  if (!canAccessClient(user.role)) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return <ClientShell user={user} initialTab="orders" orderDetailId={decodeURIComponent(id)} />;
}
