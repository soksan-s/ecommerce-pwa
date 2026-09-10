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
        },
      });
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const sales = await prisma.sale.findMany({
      where: {
        channel: "POS",
        createdAt: { gte: start, lte: end },
        status: { not: "VOIDED" },
      },
      include: {
        items: true,
      },
    });

    const revenue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const transactions = sales.length;
    const itemsSold = sales.reduce(
      (sum, s) => sum + (s.items || []).reduce((si, i) => si + Number(i.quantity || 0), 0),
      0
    );

    return ok({
      data: {
        revenue: Number(revenue.toFixed(2)),
        transactions,
        itemsSold,
      },
    });
  } catch (error) {
    return ok({
      data: {
        revenue: 0,
        transactions: 0,
        itemsSold: 0,
      },
    });
  }
}
