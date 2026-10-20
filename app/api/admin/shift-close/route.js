import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BUSINESS_TIME_ZONE = "Asia/Phnom_Penh";

function getBusinessDayBounds(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  // Phnom Penh uses UTC+07:00. Shift the local business date to UTC bounds.
  const start = new Date(Date.UTC(year, month - 1, day, -7));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) return fail("Admin access required.", 403);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
      return fail("Provide a business date in YYYY-MM-DD format.", 422);
    }

    const bounds = getBusinessDayBounds(date);
    if (!bounds) {
      return fail("Invalid business date.", 422);
    }

    const shifts = await prisma.shift.findMany({
      where: {
        OR: [
          { closeTime: { gte: bounds.start, lt: bounds.end } },
          { status: "OPEN", openTime: { gte: bounds.start, lt: bounds.end } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        branch: { select: { id: true, name: true } },
        sales: {
          where: { status: "COMPLETED" },
          select: { total: true, payments: { select: { method: true, baseAmount: true, status: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { closeTime: "desc" }, { openTime: "desc" }],
    });

    const rows = shifts.map((shift) => {
      const salesTotal = shift.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
      const paymentTotals = {};
      for (const sale of shift.sales) {
        for (const payment of sale.payments) {
          if (payment.status !== "PAID") continue;
          const key = payment.method || "Other";
          paymentTotals[key] = (paymentTotals[key] || 0) + Number(payment.baseAmount || 0);
        }
      }

      return {
        id: shift.id,
        cashierName: shift.user?.name || shift.user?.email || "Unknown cashier",
        branchName: shift.branch?.name || "—",
        status: shift.status,
        openTime: shift.openTime,
        closeTime: shift.closeTime,
        startCash: Number(shift.startCash || 0),
        expectedCash: shift.endCashCalc == null ? null : Number(shift.endCashCalc),
        countedCash: shift.endCashPhys == null ? null : Number(shift.endCashPhys),
        discrepancy: shift.discrepancy == null ? null : Number(shift.discrepancy),
        note: shift.note || "",
        transactionCount: shift.sales.length,
        salesTotal: Number(salesTotal.toFixed(2)),
        paymentTotals: Object.fromEntries(Object.entries(paymentTotals).map(([method, amount]) => [method, Number(amount.toFixed(2))])),
      };
    });

    const closedRows = rows.filter((row) => row.status === "CLOSED");
    const sum = (key) => Number(closedRows.reduce((total, row) => total + Number(row[key] || 0), 0).toFixed(2));
    const paymentTotals = {};
    for (const row of rows) {
      for (const [method, amount] of Object.entries(row.paymentTotals)) {
        paymentTotals[method] = (paymentTotals[method] || 0) + amount;
      }
    }

    return ok({
      data: {
        date,
        timeZone: BUSINESS_TIME_ZONE,
        summary: {
          shiftCount: rows.length,
          closedCount: closedRows.length,
          openCount: rows.length - closedRows.length,
          salesTotal: Number(rows.reduce((total, row) => total + row.salesTotal, 0).toFixed(2)),
          expectedCash: sum("expectedCash"),
          countedCash: sum("countedCash"),
          discrepancy: sum("discrepancy"),
          paymentTotals: Object.fromEntries(Object.entries(paymentTotals).map(([method, amount]) => [method, Number(amount.toFixed(2))])),
        },
        shifts: rows,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load the admin daily close report.");
  }
}
