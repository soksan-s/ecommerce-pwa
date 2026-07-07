import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    return ok({
      user,
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load session user.", {
      databaseMessage: "Unable to load session right now because the database is unreachable. Check your Neon connection and try again.",
    });
  }
}
