import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { buildPosReportDataset } from "@/lib/reports/pos-datasets";

// Cashier-facing report datasets: /api/pos/reports/data?report=pos-sales&…
export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("report") || "pos-sales";
    const params = Object.fromEntries(searchParams.entries());

    const data = await buildPosReportDataset(reportId, user, params);
    return ok({ data });
  } catch (error) {
    return handleRouteError(error, "Unable to load POS report data.");
  }
}
