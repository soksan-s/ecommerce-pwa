import { redirect } from "next/navigation";

import { getCurrentUser, getDefaultRouteForRole } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser({ suppressDatabaseErrors: true });

  // Authenticated users → go to their role's default page
  if (user?.role) {
    redirect(getDefaultRouteForRole(user.role));
  }

  // Guests → browse the storefront freely
  redirect("/client");
}
