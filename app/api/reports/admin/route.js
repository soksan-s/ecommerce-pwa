import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getRangeStart(range) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case "today":
      return start;
    case "week":
      start.setDate(start.getDate() - 6);
      return start;
    case "year":
      start.setMonth(0, 1);
      return start;
    case "month":
    default:
      start.setDate(1);
      return start;
  }
}

function addMapValue(map, key, value) {
  map.set(key, Number(((map.get(key) || 0) + Number(value || 0)).toFixed(2)));
}

function addMapCount(map, key, value = 1) {
  map.set(key, (map.get(key) || 0) + Number(value || 0));
}

function mapToRows(map, valueKey = "value", limit = 8) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, [valueKey]: value }))
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, limit);
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function GET(request) {
  try {
    const admin = await requireAdminUser();

    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "month";
    const start = getRangeStart(range);

    const [orders, sales, lowStockCount, outOfStockCount] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: start,
          },
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.sale.findMany({
        where: {
          createdAt: {
            gte: start,
          },
        },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      category: true,
                    },
                  },
                },
              },
            },
          },
          payments: true,
        },
      }),
      prisma.product.count({
        where: {
          stock: {
            lte: 5,
          },
        },
      }),
      prisma.product.count({
        where: {
          stock: 0,
        },
      }),
    ]);

    const activeOrders = orders.filter((order) => order.status !== "CANCELLED");
    const onlineRevenue = activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const posRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const cancelledValue = orders
      .filter((order) => order.status === "CANCELLED")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    const discountTotal =
      activeOrders.reduce((sum, order) => sum + Number(order.couponDiscount || 0), 0) +
      sales.reduce((sum, sale) => sum + Number(sale.discount || 0), 0);
    const taxTotal = sales.reduce((sum, sale) => sum + Number(sale.tax || 0), 0);
    const totalRevenue = onlineRevenue + posRevenue;
    const transactionCount = activeOrders.length + sales.length;

    const categoryRevenue = new Map();
    const productUnits = new Map();
    const paymentRevenue = new Map();
    const channelRevenue = new Map([
      ["Online", Number(onlineRevenue.toFixed(2))],
      ["POS", Number(posRevenue.toFixed(2))],
    ]);
    const statusCounts = new Map();
    const revenueTrend = new Map();

    for (const order of orders) {
      addMapCount(statusCounts, order.status.toLowerCase());
      if (order.status === "CANCELLED") {
        continue;
      }

      addMapValue(paymentRevenue, order.paymentMethod || "online", Number(order.total || 0));
      addMapValue(revenueTrend, dateKey(order.createdAt), Number(order.total || 0));

      for (const item of order.items || []) {
        const amount = Number(item.unitPrice || 0) * Number(item.quantity || 0);
        const category = item.variant?.product?.category || "Uncategorized";
        addMapValue(categoryRevenue, category, amount);
        addMapCount(productUnits, item.productName || "Unknown", item.quantity);
      }
    }

    for (const sale of sales) {
      addMapValue(revenueTrend, dateKey(sale.createdAt), Number(sale.total || 0));

      for (const payment of sale.payments || []) {
        addMapValue(paymentRevenue, payment.method || "pos", Number(payment.amount || 0));
      }

      for (const item of sale.items || []) {
        const amount = Number(item.unitPrice || 0) * Number(item.quantity || 0);
        const category = item.variant?.product?.category || "Uncategorized";
        addMapValue(categoryRevenue, category, amount);
        addMapCount(productUnits, item.productName || item.name || "Unknown", item.quantity);
      }
    }

    return ok({
      data: {
        range,
        generatedAt: new Date().toISOString(),
        metrics: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          onlineRevenue: Number(onlineRevenue.toFixed(2)),
          posRevenue: Number(posRevenue.toFixed(2)),
          transactionCount,
          averageTransaction: transactionCount ? Number((totalRevenue / transactionCount).toFixed(2)) : 0,
          cancelledValue: Number(cancelledValue.toFixed(2)),
          discountTotal: Number(discountTotal.toFixed(2)),
          taxTotal: Number(taxTotal.toFixed(2)),
          lowStockCount,
          outOfStockCount,
        },
        channelRevenue: mapToRows(channelRevenue),
        categoryRevenue: mapToRows(categoryRevenue),
        topProducts: mapToRows(productUnits, "quantity"),
        paymentRevenue: mapToRows(paymentRevenue),
        orderStatuses: mapToRows(statusCounts, "count", 12),
        revenueTrend: Array.from(revenueTrend.entries())
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load admin reports.");
  }
}
