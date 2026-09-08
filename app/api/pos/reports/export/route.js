import { fail } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let start = new Date();
    let end = new Date();

    if (startDateParam && endDateParam) {
      start = new Date(startDateParam);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const baseWhere = {
      channel: "POS",
      ...(user.branchId ? { branchId: user.branchId } : {}),
      ...(user.role === "CASHIER" ? { cashierUserId: user.id } : {}),
    };

    const sales = await prisma.sale.findMany({
      where: {
        ...baseWhere,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      include: { items: true, payments: true },
    });

    const headers = [
      "Transaction ID",
      "Date",
      "Cashier",
      "Payment Method",
      "Items Count",
      "Subtotal",
      "Discount",
      "Tax",
      "Total",
    ];

    const rows = sales.map((sale) => [
      sale.id,
      new Date(sale.createdAt).toISOString(),
      sale.cashierName || "POS",
      sale.payments?.[0]?.method || "cash",
      (sale.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      Number(sale.subtotal || 0).toFixed(2),
      Number(sale.discount || 0).toFixed(2),
      Number(sale.tax || 0).toFixed(2),
      Number(sale.total || 0).toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pos-report-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    return new Response("Unable to export POS reports", { status: 500 });
  }
}
