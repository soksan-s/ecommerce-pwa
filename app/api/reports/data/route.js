import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { buildReportDataset } from "@/lib/reports/datasets";
import { getReport } from "@/lib/reports/registry";

function canViewReports(user) {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.role === "MANAGER") {
    return true;
  }
  return hasPermission(user, "admin:reports");
}

export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!canViewReports(user)) {
      return fail("Report access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("report") || "daily-sales";

    if (!getReport(reportId)) {
      return fail(`Unknown report: ${reportId}`, 404);
    }

    const params = Object.fromEntries(searchParams.entries());
    const data = await buildReportDataset(reportId, params);

    return ok({ data });
  } catch (error) {
    return handleRouteError(error, "Unable to load report data.");
  }
}
