import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getRangeStart(range) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case "week":
      start.setDate(start.getDate() - 6);
      return start;
    case "month":
      start.setDate(1);
      return start;
    case "today":
    default:
      return start;
  }
}

function addMapValue(map, key, value) {
  map.set(key, Number(((map.get(key) || 0) + Number(value || 0)).toFixed(2)));
}

function addMapCount(map, key, value = 1) {
  map.set(key, (map.get(key) || 0) + Number(value || 0));
}

function rows(map, valueKey = "value", limit = 8) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, [valueKey]: value }))
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, limit);
}

export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const range = searchParams.get("range") || "today";

    let start = new Date();
    let end = new Date();

    if (startDateParam && endDateParam) {
      start = new Date(startDateParam);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
    } else {
      start = getRangeStart(range);
      end.setHours(23, 59, 59, 999);
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - diffDays);
    const previousEnd = new Date(start);
    previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);

    const baseWhere = {
      channel: "POS",
      ...(user.role === "CASHIER" ? { cashierUserId: user.id } : {}),
    };

    const currentSales = await prisma.sale.findMany({
      where: {
        ...baseWhere,
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: "desc" },
      include: { items: true, payments: true },
    });

    const previousSales = await prisma.sale.findMany({
      where: {
        ...baseWhere,
        createdAt: { gte: previousStart, lte: previousEnd },
      },
    });

    const paymentRevenue = new Map();
    const productUnits = new Map();
    const cashierRevenue = new Map();
    const revenueTrend = new Map();
    const totalRevenue = currentSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const discountTotal = currentSales.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
    const taxTotal = currentSales.reduce((sum, sale) => sum + Number(sale.tax || 0), 0);
    const itemsSold = currentSales.reduce(
      (sum, sale) => sum + (sale.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0,
    );

    const prevTotalRevenue = previousSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const prevTransactions = previousSales.length;

    for (const sale of currentSales) {
      addMapValue(cashierRevenue, sale.cashierName || "POS", Number(sale.total || 0));
      addMapValue(revenueTrend, new Date(sale.createdAt).toISOString().slice(0, 10), Number(sale.total || 0));

      for (const payment of sale.payments || []) {
        addMapValue(paymentRevenue, payment.method || "cash", Number(payment.amount || 0));
      }

      for (const item of sale.items || []) {
        addMapCount(productUnits, item.name, item.quantity);
      }
    }

    return ok({
      data: {
        range,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        generatedAt: new Date().toISOString(),
        metrics: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          transactions: currentSales.length,
          itemsSold,
          averageTransaction: currentSales.length ? Number((totalRevenue / currentSales.length).toFixed(2)) : 0,
          discountTotal: Number(discountTotal.toFixed(2)),
          taxTotal: Number(taxTotal.toFixed(2)),
        },
        comparisons: {
          totalRevenue: prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0,
          transactions: prevTransactions > 0 ? ((currentSales.length - prevTransactions) / prevTransactions) * 100 : 0,
        },
        paymentRevenue: rows(paymentRevenue),
        topProducts: rows(productUnits, "quantity"),
        cashierRevenue: rows(cashierRevenue),
        revenueTrend: Array.from(revenueTrend.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => a.label.localeCompare(b.label)),
        recentTransactions: currentSales.slice(0, 12).map((sale) => ({
          id: sale.id,
          cashierName: sale.cashierName || "POS",
          total: Number(sale.total || 0),
          tax: Number(sale.tax || 0),
          discount: Number(sale.discount || 0),
          paymentMethod: sale.payments?.[0]?.method || "cash",
          itemCount: (sale.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          createdAt: sale.createdAt,
        })),
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load POS reports.");
  }
}
