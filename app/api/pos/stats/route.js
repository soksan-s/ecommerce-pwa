import { ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user || !canAccessPOS(user.role)) {
      return ok({
        data: {
          revenue: 0,
          transactions: 0,
          itemsSold: 0,
          sales: [],
        },
      });
    }

    const now = new Date();

    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // ------------------------------------------------------------
    // POS SALES
    // ------------------------------------------------------------
    const posSales = await prisma.sale.findMany({
      where: {
        channel: "POS",
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          not: "VOIDED",
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // ------------------------------------------------------------
    // ONLINE ORDERS
    //
    // Only PAID online orders are included as Dashboard sales.
    // Pending / failed / expired / cancelled orders are excluded.
    // ------------------------------------------------------------
    const onlineOrders = await prisma.order.findMany({
      where: {
        channel: "ONLINE",
        paymentStatus: "PAID",
        status: {
          notIn: ["CANCELLED", "RETURNED", "REFUNDED"],
        },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // ------------------------------------------------------------
    // NORMALIZE POS SALES
    // ------------------------------------------------------------
    const normalizedPosSales = posSales.map((sale) => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      orderNumber: null,

      type: "sale",
      channel: "POS",

      status: sale.status,

      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,

      subtotal: Number(sale.subtotal || 0),
      discount: Number(sale.discount || 0),
      tax: Number(sale.tax || 0),
      total: Number(sale.total || 0),

      currency: sale.currency,

      cashierUserId: sale.cashierUserId,
      cashierName: sale.cashierName,

      customerId: sale.customerId,
      branchId: sale.branchId,
      shiftId: sale.shiftId,

      paymentStatus: null,

      synced: true,

      items: (sale.items || []).map((item) => ({
        id: item.id,
        variantId: item.variantId,
        name: item.name,
        sku: item.sku,
        quantity: Number(item.quantity || 0),
        qty: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotal || 0),
      })),
    }));

    // ------------------------------------------------------------
    // NORMALIZE ONLINE ORDERS
    // ------------------------------------------------------------
    const normalizedOnlineOrders = onlineOrders.map((order) => ({
      id: order.id,
      receiptNumber: null,
      orderNumber: order.orderNumber,

      type: "order",
      channel: "ONLINE",

      // Use the order status so the Dashboard can display
      // the actual online-order state.
      status: order.status,

      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      subtotal: Number(order.subtotal || 0),

      discount: Number(
        order.discountAmount || order.couponDiscount || 0,
      ),

      tax: Number(order.taxAmount || 0),

      total: Number(order.total || 0),

      currency: order.currency,

      cashierUserId: null,
      cashierName: null,

      customerId: order.customerId,

      branchId: order.branchId,
      shiftId: null,

      paymentStatus: order.paymentStatus,

      synced: true,

      items: (order.items || []).map((item) => ({
        id: item.id,
        variantId: item.variantId,
        name: item.productName || item.variantName,
        sku: item.sku,
        quantity: Number(item.quantity || 0),
        qty: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotal || 0),
      })),
    }));

    // ------------------------------------------------------------
    // COMBINE POS + ONLINE
    // ------------------------------------------------------------
    const sales = [
      ...normalizedPosSales,
      ...normalizedOnlineOrders,
    ].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime(),
    );

    // ------------------------------------------------------------
    // DASHBOARD TOTALS
    // ------------------------------------------------------------
    const revenue = sales.reduce(
      (sum, sale) => sum + Number(sale.total || 0),
      0,
    );

    const transactions = sales.length;

    const itemsSold = sales.reduce(
      (sum, sale) =>
        sum +
        (sale.items || []).reduce(
          (itemSum, item) =>
            itemSum + Number(item.quantity || 0),
          0,
        ),
      0,
    );

    return ok({
      data: {
        revenue: Number(revenue.toFixed(2)),
        transactions,
        itemsSold,
        sales,
      },
    });
  } catch (error) {
    console.error("[pos/stats] Unable to load dashboard statistics:", error);

    return ok({
      data: {
        revenue: 0,
        transactions: 0,
        itemsSold: 0,
        sales: [],
      },
    });
  }
}

//Old code
// import { ok } from "@/lib/api-response";
// import { canAccessPOS, getCurrentUser } from "@/lib/auth";
// import { prisma } from "@/lib/prisma";

// export async function GET() {
//   try {
//     const user = await getCurrentUser({ suppressDatabaseErrors: true });

//     if (!user || !canAccessPOS(user.role)) {
//       return ok({
//         data: {
//           revenue: 0,
//           transactions: 0,
//           itemsSold: 0,
//         },
//       });
//     }

//     const now = new Date();
//     const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
//     const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

//     const sales = await prisma.sale.findMany({
//       where: {
//         channel: "POS",
//         createdAt: { gte: start, lte: end },
//         status: { not: "VOIDED" },
//       },
//       include: {
//         items: true,
//       },
//     });

//     const revenue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
//     const transactions = sales.length;
//     const itemsSold = sales.reduce(
//       (sum, s) => sum + (s.items || []).reduce((si, i) => si + Number(i.quantity || 0), 0),
//       0
//     );

//     return ok({
//       data: {
//         revenue: Number(revenue.toFixed(2)),
//         transactions,
//         itemsSold,

//         sales: sales.map((sale) => ({
//           id: sale.id,
//           receiptNumber: sale.receiptNumber,
//           type: "sale",
//           channel: sale.channel,
//           status: sale.status,
//           createdAt: sale.createdAt,
//           updatedAt: sale.updatedAt,
//           subtotal: Number(sale.subtotal || 0),
//           discount: Number(sale.discount || 0),
//           tax: Number(sale.tax || 0),
//           total: Number(sale.total || 0),
//           currency: sale.currency,
//           cashierUserId: sale.cashierUserId,
//           cashierName: sale.cashierName,
//           customerId: sale.customerId,
//           branchId: sale.branchId,
//           shiftId: sale.shiftId,
//           synced: true,

//           items: (sale.items || []).map((item) => ({
//             id: item.id,
//             variantId: item.variantId,
//             name: item.name,
//             sku: item.sku,
//             quantity: Number(item.quantity || 0),
//             qty: Number(item.quantity || 0),
//             unitPrice: Number(item.unitPrice || 0),
//             lineTotal: Number(item.lineTotal || 0),
//           })),
//         })),
//       },
//     });
//   } catch (error) {
//     return ok({
//       data: {
//         revenue: 0,
//         transactions: 0,
//         itemsSold: 0,
//         sales: []
//       },
//     });
//   }
// }
