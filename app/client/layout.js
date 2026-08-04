import { redirect } from "next/navigation";

import { canAccessClient, getCurrentUser, getDefaultRouteForRole } from "@/lib/auth";

export default async function ClientLayout({ children }) {
  const user = await getCurrentUser({ suppressDatabaseErrors: true });

  // Guests (no session) are welcome to browse as visitors
  if (!user) {
    return children;
  }

  // Staff/admins with a non-client role get sent to their own area
  if (!canAccessClient(user.role)) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return children;
}
