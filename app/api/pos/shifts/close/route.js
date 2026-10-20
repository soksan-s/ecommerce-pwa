import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const user = await getCurrentUser();
    if (!user || (!hasPermission(user, "pos:sales") && !hasPermission(user, "pos:shifts"))) {
      return fail("Unauthorized.", 403);
    }

    const body = await request.json();
    const endCashPhys = Number(body.endCashPhys);

    if (isNaN(endCashPhys) || endCashPhys < 0) {
      return fail("Invalid physical counted cash.", 422);
    }

    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findFirst({
        where: {
          cashierId: user.id,
          status: "OPEN",
        },
      });

      if (!shift) {
        throw new Error("NO_OPEN_SHIFT");
      }

      const sales = await tx.sale.findMany({
        where: { shiftId: shift.id, status: "COMPLETED" },
        include: {
          payments: true,
          returns: { include: { refunds: true } },
        },
      });

      let cashCollected = 0;
      let nonCashCollected = 0;
      let cashRefunded = 0;
      let transactionCount = 0;
      const paymentTotals = {};
      for (const sale of sales) {
        transactionCount += 1;
        for (const pay of sale.payments) {
          if (pay.status !== "PAID") continue;
          const baseAmount = Number(pay.baseAmount || 0);
          const method = pay.method || "Other";
          paymentTotals[method] = (paymentTotals[method] || 0) + baseAmount;
          if (method.trim().toLowerCase() === "cash") cashCollected += baseAmount;
          else nonCashCollected += baseAmount;
        }
        for (const returnRecord of sale.returns) {
          for (const refund of returnRecord.refunds) {
            if (refund.paymentMethod.trim().toLowerCase() === "cash") {
              cashRefunded += Number(refund.baseAmount || refund.amount || 0);
            }
          }
        }
      }

      const drawerTransactions = await tx.cashDrawerTransaction.findMany({
        where: { shiftId: shift.id },
      });
      let cashIn = 0;
      let cashOut = 0;
      for (const transaction of drawerTransactions) {
        const amount = Number(transaction.amount || 0);
        const usdAmount = transaction.currency === "KHR" ? amount / 4000 : amount;
        if (transaction.type === "CASH_IN") cashIn += usdAmount;
        if (transaction.type === "CASH_OUT") cashOut += usdAmount;
      }

      const endCashCalc = Number((Number(shift.startCash) + cashCollected + cashIn - cashOut - cashRefunded).toFixed(2));
      const discrepancy = endCashPhys - endCashCalc;

      const closedShift = await tx.shift.update({
        where: { id: shift.id },
        data: {
          status: "CLOSED",
          closeTime: new Date(),
          endCashCalc,
          endCashPhys,
          discrepancy,
          note: typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          module: "shifts",
          recordId: shift.id,
          newValue: {
            status: "CLOSED",
            endCashCalc,
            endCashPhys,
            discrepancy,
            cashCollected,
            nonCashCollected,
            cashRefunded,
            cashIn,
            cashOut,
            transactionCount,
            paymentTotals: Object.fromEntries(Object.entries(paymentTotals).map(([method, amount]) => [method, Number(amount.toFixed(2))])),
          },
        },
      });

      return {
        ...closedShift,
        summary: {
          transactionCount,
          cashCollected: Number(cashCollected.toFixed(2)),
          nonCashCollected: Number(nonCashCollected.toFixed(2)),
          cashRefunded: Number(cashRefunded.toFixed(2)),
          cashIn: Number(cashIn.toFixed(2)),
          cashOut: Number(cashOut.toFixed(2)),
          paymentTotals: Object.fromEntries(Object.entries(paymentTotals).map(([method, amount]) => [method, Number(amount.toFixed(2))])),
        },
      };
    });

    return ok({ data: result });
  } catch (error) {
    if (error.message === "NO_OPEN_SHIFT") {
      return fail("No active open shift found for this user.", 404);
    }
    return handleRouteError(error, "Unable to close shift.");
  }
}
