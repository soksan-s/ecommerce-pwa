import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ClientShell } from "@/components/client-shell";
import { canAccessClient, getCurrentUser, getDefaultRouteForRole } from "@/lib/auth";

export default async function ClientIndexPage() {
  const user = await getCurrentUser({ suppressDatabaseErrors: true });

  // If an authenticated user has a non-client role, redirect to their area
  if (user && !canAccessClient(user.role)) {
    redirect(getDefaultRouteForRole(user.role));
  }

  // Guests (user === null) and CLIENT users both see the storefront
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <ClientShell user={user || null} />
    </Suspense>
  );
}
