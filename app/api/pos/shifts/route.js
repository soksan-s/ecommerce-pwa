import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasPermission(user, "pos:sales") && !hasPermission(user, "pos:shifts"))) {
      return fail("Unauthorized.", 403);
    }

    const activeShift = await prisma.shift.findFirst({
      where: {
        cashierId: user.id,
        status: "OPEN",
      },
      include: { branch: true },
    });

    if (!activeShift) return ok({ data: null });

    const [sales, drawerTransactions] = await Promise.all([
      prisma.sale.findMany({
        where: { shiftId: activeShift.id, status: "COMPLETED" },
        include: { payments: true, returns: { include: { refunds: true } } },
      }),
      prisma.cashDrawerTransaction.findMany({ where: { shiftId: activeShift.id } }),
    ]);

    let cashCollected = 0;
    let nonCashCollected = 0;
    let cashRefunded = 0;
    const paymentTotals = {};
    for (const sale of sales) {
      for (const payment of sale.payments) {
        if (payment.status !== "PAID") continue;
        const amount = Number(payment.baseAmount || 0);
        const method = payment.method || "Other";
        paymentTotals[method] = (paymentTotals[method] || 0) + amount;
        if (method.trim().toLowerCase() === "cash") cashCollected += amount;
        else nonCashCollected += amount;
      }
      for (const returnRecord of sale.returns) {
        for (const refund of returnRecord.refunds) {
          if (refund.paymentMethod.trim().toLowerCase() === "cash") {
            cashRefunded += Number(refund.baseAmount || refund.amount || 0);
          }
        }
      }
    }
    let cashIn = 0;
    let cashOut = 0;
    for (const transaction of drawerTransactions) {
      const amount = Number(transaction.amount || 0);
      const usdAmount = transaction.currency === "KHR" ? amount / 4000 : amount;
      if (transaction.type === "CASH_IN") cashIn += usdAmount;
      if (transaction.type === "CASH_OUT") cashOut += usdAmount;
    }
    const expectedCash = Number((Number(activeShift.startCash) + cashCollected + cashIn - cashOut - cashRefunded).toFixed(2));

    return ok({ data: {
      ...activeShift,
      summary: {
        transactionCount: sales.length,
        salesTotal: Number(sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0).toFixed(2)),
        cashCollected: Number(cashCollected.toFixed(2)),
        nonCashCollected: Number(nonCashCollected.toFixed(2)),
        cashRefunded: Number(cashRefunded.toFixed(2)),
        cashIn: Number(cashIn.toFixed(2)),
        cashOut: Number(cashOut.toFixed(2)),
        expectedCash,
        paymentTotals: Object.fromEntries(Object.entries(paymentTotals).map(([method, amount]) => [method, Number(amount.toFixed(2))])),
      },
    } });
  } catch (error) {
    return handleRouteError(error, "Unable to check shift status.");
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasPermission(user, "pos:sales") && !hasPermission(user, "pos:shifts"))) {
      return fail("Unauthorized.", 403);
    }

    const body = await request.json();
    const startCash = Number(body.startCash || 0);
    const branchId = body.branchId || user.branchId;

    if (isNaN(startCash) || startCash < 0) {
      return fail("Invalid starting cash amount.", 422);
    }

    // Check existing open shift
    const existing = await prisma.shift.findFirst({
      where: {
        cashierId: user.id,
        status: "OPEN",
      },
    });

    if (existing) {
      return fail("You already have an open shift active.", 409);
    }

    const shift = await prisma.shift.create({
      data: {
        cashierId: user.id,
        branchId,
        startCash,
        status: "OPEN",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        module: "shifts",
        recordId: shift.id,
        newValue: { startCash, branchId },
      },
    });

    return ok({ data: shift });
  } catch (error) {
    return handleRouteError(error, "Unable to open shift.");
  }
}
