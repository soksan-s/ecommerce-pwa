import { ok } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST() {
  try {
    // Sign out via Better Auth
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch {
    // Ignore - may already be signed out
  }

  return ok({ message: "Logged out." });
}
