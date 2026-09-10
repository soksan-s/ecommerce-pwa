import { ok } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";

async function doLogout() {
  try {
    const reqHeaders = await headers();
    await auth.api.signOut({
      headers: reqHeaders,
    });
  } catch {
    // Ignore - fallback to cookie clearing
  }

  try {
    const cookieStore = await cookies();
    cookieStore.delete("better-auth.session_token");
    cookieStore.delete("better-auth.session_data");
    cookieStore.delete("__Secure-better-auth.session_token");
    cookieStore.delete("better-auth.csrf_token");
  } catch {}

  return ok({ message: "Logged out." });
}

export async function POST() {
  return doLogout();
}

export async function GET() {
  return doLogout();
}
