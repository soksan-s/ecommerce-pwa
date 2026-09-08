import { fail } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { buildReportDataset } from "@/lib/reports/datasets";
import { buildCsv, buildPdf, exportFilename } from "@/lib/reports/exporters";
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
    const format = (searchParams.get("format") || "csv").toLowerCase();

    if (!getReport(reportId)) {
      return fail(`Unknown report: ${reportId}`, 404);
    }

    if (format !== "csv" && format !== "pdf") {
      return fail("Unsupported export format. Use csv or pdf.", 422);
    }

    // Exports always cover the full filtered result set — no pagination.
    const params = { ...Object.fromEntries(searchParams.entries()) };
    const dataset = await buildReportDataset(reportId, params, { all: true, skipMeta: true });

    if (format === "csv") {
      const csv = buildCsv(dataset);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exportFilename(reportId, "csv")}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = await buildPdf(dataset);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${exportFilename(reportId, "pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = process.env.NODE_ENV === "production" ? "Unable to export report." : `Unable to export report: ${error.message}`;
    return fail(message, 500);
  }
}
