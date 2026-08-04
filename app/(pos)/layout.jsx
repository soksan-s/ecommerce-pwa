import { redirect } from "next/navigation";

import { PosLayoutShell } from "@/components/pos-layout-shell";
import { canAccessPOS, getCurrentUser, getDefaultRouteForRole } from "@/lib/auth";

export default async function PosLayout({ children }) {
  let user = null;
  try {
    user = await getCurrentUser({ suppressDatabaseErrors: true });
  } catch {
    user = {
      id: "offline-cashier",
      name: "Offline Cashier",
      role: "CASHIER",
      isOffline: true,
    };
  }

  if (!user) {
    user = {
      id: "offline-cashier",
      name: "Offline Cashier",
      role: "CASHIER",
      isOffline: true,
    };
  }

  if (!canAccessPOS(user.role)) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return <PosLayoutShell>{children}</PosLayoutShell>;
}
