import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateRange(searchParams) {
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");
  const range = searchParams.get("range") || "today";

  let start = new Date();
  let end = new Date();

  if (startParam && endParam) {
    start = new Date(startParam);
    start.setHours(0, 0, 0, 0);
    end = new Date(endParam);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setHours(0, 0, 0, 0);
    switch (range) {
      case "week":
        start.setDate(start.getDate() - 6);
        break;
      case "month":
        start.setDate(1);
        break;
      default:
        break;
    }
    end.setHours(23, 59, 59, 999);
  }

  const diffDays = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - diffDays);
  const previousEnd = new Date(start);
  previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);

  return { start, end, previousStart, previousEnd };
}

function mapRows(map, valueKey = "value", limit = 10) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, [valueKey]: value }))
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, limit);
}

function pct(curr, prev) {
  if (!prev || prev === 0) return 0;
  return Number(((curr - prev) / prev) * 100);
}

// ─── Sub-Report Handlers ──────────────────────────────────────────────────────

async function reportOverview(branchFilter, cashierFilter, start, end, previousStart, previousEnd) {
  const baseWhere = { channel: "POS", ...branchFilter, ...cashierFilter };

  const [currentSales, previousSales] = await Promise.all([
    prisma.sale.findMany({
      where: { ...baseWhere, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
      include: { items: true, payments: true },
    }),
    prisma.sale.findMany({
      where: { ...baseWhere, createdAt: { gte: previousStart, lte: previousEnd } },
      select: { total: true },
    }),
  ]);

  const totalRevenue = currentSales.reduce((s, x) => s + Number(x.total || 0), 0);
  const discountTotal = currentSales.reduce((s, x) => s + Number(x.discount || 0), 0);
  const taxTotal = currentSales.reduce((s, x) => s + Number(x.tax || 0), 0);
  const itemsSold = currentSales.reduce(
    (s, x) => s + (x.items || []).reduce((si, i) => si + Number(i.quantity || 0), 0),
    0
  );
  const prevTotalRevenue = previousSales.reduce((s, x) => s + Number(x.total || 0), 0);

  const paymentRevenue = new Map();
  const productUnits = new Map();
  const cashierRevenue = new Map();
  const revenueTrend = new Map();

  for (const sale of currentSales) {
    const dayKey = new Date(sale.createdAt).toISOString().slice(0, 10);
    cashierRevenue.set(sale.cashierName || "POS",
      Number(((cashierRevenue.get(sale.cashierName || "POS") || 0) + Number(sale.total || 0)).toFixed(2)));
    revenueTrend.set(dayKey,
      Number(((revenueTrend.get(dayKey) || 0) + Number(sale.total || 0)).toFixed(2)));
    for (const p of sale.payments || []) {
      paymentRevenue.set(p.method || "cash",
        Number(((paymentRevenue.get(p.method || "cash") || 0) + Number(p.amount || 0)).toFixed(2)));
    }
    for (const item of sale.items || []) {
      productUnits.set(item.name, (productUnits.get(item.name) || 0) + Number(item.quantity || 0));
    }
  }

  return {
    metrics: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      transactions: currentSales.length,
      itemsSold,
      averageTransaction: currentSales.length
        ? Number((totalRevenue / currentSales.length).toFixed(2))
        : 0,
      discountTotal: Number(discountTotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
    },
    comparisons: {
      totalRevenue: pct(totalRevenue, prevTotalRevenue),
      transactions: pct(currentSales.length, previousSales.length),
    },
    paymentRevenue: mapRows(paymentRevenue),
    topProducts: mapRows(productUnits, "quantity"),
    cashierRevenue: mapRows(cashierRevenue),
    revenueTrend: Array.from(revenueTrend.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    recentTransactions: currentSales.slice(0, 15).map((sale) => ({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      cashierName: sale.cashierName || "POS",
      total: Number(sale.total || 0),
      tax: Number(sale.tax || 0),
      discount: Number(sale.discount || 0),
      paymentMethod: sale.payments?.[0]?.method || "cash",
      itemCount: (sale.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
      createdAt: sale.createdAt,
    })),
  };
}

async function reportProducts(branchFilter, cashierFilter, start, end) {
  const baseWhere = { channel: "POS", ...branchFilter, ...cashierFilter };

  const sales = await prisma.sale.findMany({
    where: { ...baseWhere, createdAt: { gte: start, lte: end } },
    select: {
      items: {
        select: {
          name: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          costPrice: true,
          lineTotal: true,
          variant: {
            select: {
              product: {
                select: {
                  category: { select: { name: true } },
                  brand: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const productMap = new Map(); // key: name -> { revenue, units, cost, category, brand }
  const categoryMap = new Map();

  for (const sale of sales) {
    for (const item of sale.items || []) {
      const catName = item.variant?.product?.category?.name || "Uncategorized";
      const brandName = item.variant?.product?.brand?.name || "—";
      const revenue = Number(item.lineTotal || 0);
      const cost = Number(item.costPrice || 0) * Number(item.quantity || 0);
      const qty = Number(item.quantity || 0);

      const existing = productMap.get(item.name) || { revenue: 0, units: 0, cost: 0, category: catName, brand: brandName, sku: item.sku };
      existing.revenue = Number((existing.revenue + revenue).toFixed(2));
      existing.units += qty;
      existing.cost = Number((existing.cost + cost).toFixed(2));
      productMap.set(item.name, existing);

      const catExisting = categoryMap.get(catName) || { revenue: 0, units: 0 };
      catExisting.revenue = Number((catExisting.revenue + revenue).toFixed(2));
      catExisting.units += qty;
      categoryMap.set(catName, catExisting);
    }
  }

  const productList = Array.from(productMap.entries()).map(([name, v]) => ({
    name,
    sku: v.sku,
    category: v.category,
    brand: v.brand,
    units: v.units,
    revenue: v.revenue,
    cost: v.cost,
    grossProfit: Number((v.revenue - v.cost).toFixed(2)),
  }));

  const categoryList = Array.from(categoryMap.entries()).map(([name, v]) => ({
    label: name,
    value: v.revenue,
    units: v.units,
  }));

  const totalRevenue = productList.reduce((s, p) => s + p.revenue, 0);
  const totalUnits = productList.reduce((s, p) => s + p.units, 0);

  return {
    metrics: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalUnits,
      uniqueProducts: productMap.size,
      topCategory: categoryList.sort((a, b) => b.value - a.value)[0]?.label || "—",
    },
    topByRevenue: productList.sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    topByVolume: productList.sort((a, b) => b.units - a.units).slice(0, 10),
    categoryBreakdown: categoryList.sort((a, b) => b.value - a.value),
  };
}

async function reportShifts(branchFilter, cashierFilter, start, end) {
  const shifts = await prisma.shift.findMany({
    where: {
      ...branchFilter,
      ...(cashierFilter.cashierUserId ? { cashierId: cashierFilter.cashierUserId } : {}),
      openTime: { gte: start, lte: end },
    },
    include: {
      user: { select: { name: true, phoneNumber: true } },
      sales: {
        where: { channel: "POS" },
        select: { total: true, items: true, payments: true },
      },
    },
    orderBy: { openTime: "desc" },
  });

  const totalShifts = shifts.length;
  const openShifts = shifts.filter((s) => s.status === "OPEN").length;
  const closedShifts = shifts.filter((s) => s.status !== "OPEN").length;

  const totalDiscrepancy = shifts.reduce((s, sh) => {
    if (sh.discrepancy != null) return s + Number(sh.discrepancy || 0);
    return s;
  }, 0);

  const cashierRanking = new Map();
  for (const shift of shifts) {
    const name = shift.user?.name || "Unknown";
    const revenue = shift.sales.reduce((s, sl) => s + Number(sl.total || 0), 0);
    cashierRanking.set(name, (cashierRanking.get(name) || 0) + revenue);
  }

  const shiftRows = shifts.map((sh) => {
    const shiftRevenue = sh.sales.reduce((s, sl) => s + Number(sl.total || 0), 0);
    const startCash = Number(sh.startCash || 0);
    const endCashCalc = Number(sh.endCashCalc || 0);
    const endCashPhys = sh.endCashPhys != null ? Number(sh.endCashPhys) : null;
    const discrepancy = sh.discrepancy != null ? Number(sh.discrepancy) : null;

    return {
      id: sh.id,
      cashierName: sh.user?.name || "Unknown",
      openTime: sh.openTime,
      closeTime: sh.closeTime,
      status: sh.status,
      startCash,
      endCashCalc,
      endCashPhys,
      discrepancy,
      revenue: Number(shiftRevenue.toFixed(2)),
      salesCount: sh.sales.length,
    };
  });

  return {
    metrics: {
      totalShifts,
      openShifts,
      closedShifts,
      totalDiscrepancy: Number(totalDiscrepancy.toFixed(2)),
    },
    cashierRanking: mapRows(cashierRanking),
    shiftRows,
  };
}

async function reportCredit(branchFilter, _cashierFilter, start, end) {
  const [creditTx, customers] = await Promise.all([
    prisma.customerCredit.findMany({
      where: { ...branchFilter, createdAt: { gte: start, lte: end } },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customerCredit.findMany({
      where: { ...branchFilter },
      select: { customerId: true, type: true, amount: true, balance: true, createdAt: true,
        customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Summarize per customer using latest balance record
  const customerLatest = new Map();
  for (const tx of customers) {
    if (!customerLatest.has(tx.customerId)) {
      customerLatest.set(tx.customerId, {
        customerId: tx.customerId,
        name: tx.customer?.name || "Unknown",
        phone: tx.customer?.phone || "—",
        balance: Number(tx.balance || 0),
        lastDate: tx.createdAt,
      });
    }
  }

  const charges = creditTx.filter((t) => t.type === "CHARGE");
  const payments = creditTx.filter((t) => t.type === "PAYMENT");
  const totalCharged = charges.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalPaid = payments.reduce((s, t) => s + Number(t.amount || 0), 0);

  // Total outstanding (positive balance = owed)
  const totalOutstanding = Array.from(customerLatest.values())
    .reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  const debtorList = Array.from(customerLatest.values())
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const recentTransactions = creditTx.slice(0, 20).map((t) => ({
    id: t.id,
    customerName: t.customer?.name || "Unknown",
    phone: t.customer?.phone || "—",
    type: t.type,
    amount: Number(t.amount || 0),
    balance: Number(t.balance || 0),
    note: t.note,
    createdAt: t.createdAt,
  }));

  return {
    metrics: {
      totalCharged: Number(totalCharged.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      activeDebtors: debtorList.length,
      transactions: creditTx.length,
    },
    debtorList: debtorList.slice(0, 20),
    recentTransactions,
  };
}

async function reportContainers(branchFilter, _cashierFilter, start, end) {
  const transactions = await prisma.containerTransaction.findMany({
    where: { ...branchFilter, createdAt: { gte: start, lte: end } },
    include: {
      depositType: { select: { name: true, depositAmount: true } },
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const issued = transactions.filter((t) => t.type === "ISSUE");
  const returned = transactions.filter((t) => t.type === "RETURN");

  const depositsByType = new Map();
  for (const tx of transactions) {
    const typeName = tx.depositType?.name || "Unknown";
    const existing = depositsByType.get(typeName) || { issued: 0, returned: 0, depositsCollected: 0, depositsRefunded: 0 };
    if (tx.type === "ISSUE") {
      existing.issued += Number(tx.quantity || 0);
      existing.depositsCollected += Number(tx.depositAmount || 0);
    } else {
      existing.returned += Number(tx.quantity || 0);
      existing.depositsRefunded += Number(tx.depositAmount || 0);
    }
    depositsByType.set(typeName, existing);
  }

  const totalDepositsCollected = issued.reduce((s, t) => s + Number(t.depositAmount || 0), 0);
  const totalDepositsRefunded = returned.reduce((s, t) => s + Number(t.depositAmount || 0), 0);
  const totalIssued = issued.reduce((s, t) => s + Number(t.quantity || 0), 0);
  const totalReturned = returned.reduce((s, t) => s + Number(t.quantity || 0), 0);

  const typeBreakdown = Array.from(depositsByType.entries()).map(([label, v]) => ({
    label,
    ...v,
    net: v.issued - v.returned,
    netDeposit: Number((v.depositsCollected - v.depositsRefunded).toFixed(2)),
  }));

  const recentTransactions = transactions.slice(0, 20).map((t) => ({
    id: t.id,
    customerName: t.customer?.name || "Unknown",
    phone: t.customer?.phone || "—",
    depositType: t.depositType?.name || "—",
    type: t.type,
    quantity: t.quantity,
    depositAmount: Number(t.depositAmount || 0),
    note: t.note,
    createdAt: t.createdAt,
  }));

  return {
    metrics: {
      totalIssued,
      totalReturned,
      netOutstanding: totalIssued - totalReturned,
      depositsCollected: Number(totalDepositsCollected.toFixed(2)),
      depositsRefunded: Number(totalDepositsRefunded.toFixed(2)),
      netDepositHeld: Number((totalDepositsCollected - totalDepositsRefunded).toFixed(2)),
    },
    typeBreakdown,
    recentTransactions,
  };
}

async function reportProfitability(branchFilter, cashierFilter, start, end) {
  const baseWhere = { channel: "POS", ...branchFilter, ...cashierFilter };

  const sales = await prisma.sale.findMany({
    where: { ...baseWhere, createdAt: { gte: start, lte: end } },
    select: {
      total: true,
      subtotal: true,
      discount: true,
      items: {
        select: {
          name: true,
          quantity: true,
          unitPrice: true,
          costPrice: true,
          lineTotal: true,
          variant: {
            select: {
              product: {
                select: {
                  category: { select: { name: true } },
                  brand: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const productMap = new Map();
  const categoryMap = new Map();

  let totalRevenue = 0;
  let totalCOGS = 0;

  for (const sale of sales) {
    totalRevenue += Number(sale.total || 0);
    for (const item of sale.items || []) {
      const revenue = Number(item.lineTotal || 0);
      const cost = Number(item.costPrice || 0) * Number(item.quantity || 0);
      const qty = Number(item.quantity || 0);
      const catName = item.variant?.product?.category?.name || "Uncategorized";

      totalCOGS += cost;

      const existing = productMap.get(item.name) || { revenue: 0, cost: 0, units: 0, category: catName };
      existing.revenue = Number((existing.revenue + revenue).toFixed(2));
      existing.cost = Number((existing.cost + cost).toFixed(2));
      existing.units += qty;
      productMap.set(item.name, existing);

      const catExisting = categoryMap.get(catName) || { revenue: 0, cost: 0 };
      catExisting.revenue = Number((catExisting.revenue + revenue).toFixed(2));
      catExisting.cost = Number((catExisting.cost + cost).toFixed(2));
      categoryMap.set(catName, catExisting);
    }
  }

  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const productList = Array.from(productMap.entries()).map(([name, v]) => {
    const gp = Number((v.revenue - v.cost).toFixed(2));
    const margin = v.revenue > 0 ? (gp / v.revenue) * 100 : 0;
    return { name, category: v.category, units: v.units, revenue: v.revenue, cost: v.cost, grossProfit: gp, margin: Number(margin.toFixed(1)) };
  });

  const categoryList = Array.from(categoryMap.entries()).map(([name, v]) => {
    const gp = Number((v.revenue - v.cost).toFixed(2));
    const margin = v.revenue > 0 ? (gp / v.revenue) * 100 : 0;
    return { label: name, revenue: v.revenue, cost: v.cost, grossProfit: gp, margin: Number(margin.toFixed(1)) };
  });

  return {
    metrics: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCOGS: Number(totalCOGS.toFixed(2)),
      grossProfit: Number(grossProfit.toFixed(2)),
      grossMargin: Number(grossMargin.toFixed(1)),
      transactions: sales.length,
    },
    productList: productList.sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 20),
    categoryBreakdown: categoryList.sort((a, b) => b.grossProfit - a.grossProfit),
  };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("reportType") || "overview";
    const { start, end, previousStart, previousEnd } = parseDateRange(searchParams);

    const branchFilter = user.branchId ? { branchId: user.branchId } : {};
    const cashierFilter = user.role === "CASHIER" ? { cashierUserId: user.id } : {};

    let data;

    switch (reportType) {
      case "products":
        data = await reportProducts(branchFilter, cashierFilter, start, end);
        break;
      case "shifts":
        data = await reportShifts(branchFilter, cashierFilter, start, end);
        break;
      case "credit":
        data = await reportCredit(branchFilter, cashierFilter, start, end);
        break;
      case "containers":
        data = await reportContainers(branchFilter, cashierFilter, start, end);
        break;
      case "profitability":
        data = await reportProfitability(branchFilter, cashierFilter, start, end);
        break;
      case "overview":
      default:
        data = await reportOverview(branchFilter, cashierFilter, start, end, previousStart, previousEnd);
        break;
    }

    return ok({
      data: {
        reportType,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        generatedAt: new Date().toISOString(),
        ...data,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load POS reports.");
  }
}
