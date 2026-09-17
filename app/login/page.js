import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PublicAuthGate } from "@/components/public-auth-gate";
import { getCurrentUser, getDefaultRouteForRole } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser({ suppressDatabaseErrors: true });

  if (user?.role) {
    redirect(getDefaultRouteForRole(user.role));
  }

  return (
    <>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
        <PublicAuthGate initialAuthView="login" />
      </Suspense>
    </>
  );
}
