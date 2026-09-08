import { prisma } from "@/lib/prisma";

import { getReport } from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const SALE_STATUSES = ["OPEN", "COMPLETED", "VOIDED", "REFUNDED"];
const ORDER_STATUSES = [
  "PENDING", "CONFIRMED", "PICKING", "PACKING", "READY", "SHIPPED",
  "DELIVERED", "COMPLETED", "CANCELLED", "RETURNED", "REFUNDED", "PROCESSING", "PREPARING",
];
const EXCLUDED_ORDER_STATUSES = ["CANCELLED", "RETURNED", "REFUNDED"];

const STOCK_IN_TYPES = [
  "STOCK_IN", "PURCHASE_RECEIPT", "TRANSFER_IN", "SALE_RETURN",
  "ADJUSTMENT_INCREASE", "STOCK_COUNT_INCREASE",
];
const STOCK_OUT_TYPES = [
  "STOCK_OUT", "SALE", "PURCHASE_RETURN", "TRANSFER_OUT",
  "ADJUSTMENT_DECREASE", "STOCK_COUNT_DECREASE", "WASTE",
];

const RETURN_REASON_LABELS = {
  DEFECTIVE: "Defective",
  WRONG_ITEM: "Wrong Item",
  CUSTOMER_CHANGED_MIND: "Customer Changed Mind",
  EXCESS_ORDER: "Excess Order",
  EXPIRED: "Expired",
  OTHER: "Other",
};

function round2(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// All in/out boundaries use the server's local timezone so "today" matches
// what the cashier sees on the wall clock; day bucket keys use the same.
function parseRangeParams(params = {}) {
  const now = new Date();
  const preset = params.preset || params.range || "this_month";
  let start;
  let end;

  if (params.from && params.to) {
    start = startOfDay(new Date(`${params.from}T00:00:00`));
    end = endOfDay(new Date(`${params.to}T00:00:00`));
  } else {
    switch (preset) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "yesterday": {
        const y = new Date(now.getTime() - DAY_MS);
        start = startOfDay(y);
        end = endOfDay(y);
        break;
      }
      case "this_week": {
        const day = (now.getDay() + 6) % 7; // Monday-based week
        start = startOfDay(new Date(now.getTime() - day * DAY_MS));
        end = endOfDay(now);
        break;
      }
      case "this_month":
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = endOfDay(now);
        break;
    }
  }

  if (start > end) {
    const swap = start;
    start = end;
    end = swap;
  }

  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const label = start.toDateString() === end.toDateString()
    ? fmt(start)
    : `${fmt(start)} – ${fmt(end)}`;

  return { start, end, label, preset };
}

function dayKey(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// KHQR at POS is the cashier-recorded tender type (cash-equivalent), not a
// gateway transaction — Bakong reference data lives on Payment.externalRef.
function normalizePaymentMethod(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Cash";
  const up = value.toUpperCase();
  if (up.includes("KHQR") || up.includes("BAKONG") || up === "QR" || up.endsWith("_QR") || up === "QR") return "KHQR";
  if (up.includes("CASH")) return "Cash";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayStatus(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function itemsCount(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function sumBy(rows, key) {
  return round2(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0));
}

// Channel filter semantics:
//   ""        → both models, all channels
//   "POS"     → sales only (all Sale rows are POS-tendered)
//   "ONLINE"  → orders only
//   "WHOLESALE" → both models, WHOLESALE channel rows
function channelSplitsSale(channel) {
  return channel === "ONLINE";
}

function channelSplitsOrder(channel) {
  return channel === "POS";
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline: search → sort → paginate (summary/totalRow always over full set)
// ─────────────────────────────────────────────────────────────────────────────

const NUMERIC_TYPES = new Set(["money", "int", "percent", "rank"]);
const DATE_TYPES = new Set(["datetime", "date"]);

function compareValues(a, b, column) {
  if (NUMERIC_TYPES.has(column.type)) {
    return (Number(a) || 0) - (Number(b) || 0);
  }
  if (DATE_TYPES.has(column.type)) {
    const ta = Date.parse(a) || 0;
    const tb = Date.parse(b) || 0;
    return ta - tb;
  }
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, { sensitivity: "base" });
}

function sortRows(rows, columns, sortKey, dir) {
  const column = columns.find((c) => c.key === sortKey && c.sortable !== false);
  if (!column) return rows;
  const multiplier = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => multiplier * compareValues(a[sortKey], b[sortKey], column));
  return rows;
}

function searchRows(rows, keys, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle))
  );
}

function buildTotalRow(report, rows) {
  if (!report.totalRowKeys?.length) return null;
  const totalRow = {};
  for (const key of report.totalRowKeys) {
    const column = report.columns.find((c) => c.key === key);
    if (!column) continue;
    if (column.type === "percent") {
      totalRow[key] = round2(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0));
    } else {
      totalRow[key] = round2(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0));
    }
  }
  return totalRow;
}

function paginate(rows, params, forceAll, keyPrefix = "row") {
  const total = rows.length;
  const pageSize = Math.min(Math.max(parseInt(params.pageSize, 10) || 25, 5), 500);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parseInt(params.page, 10) || 1, 1), pageCount);
  const wantsAll = forceAll || params.all === "1" || params.all === "true";
  const slice = wantsAll ? rows : rows.slice((page - 1) * pageSize, page * pageSize);
  // Stable per-query React keys — product/customer names can legitimately repeat.
  const offset = wantsAll ? 0 : (page - 1) * pageSize;
  slice.forEach((row, index) => {
    row._rowKey = `${keyPrefix}:${offset + index}`;
  });
  return { rows: slice, pagination: { page, pageSize, total, pageCount, all: Boolean(wantsAll) } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

const SALE_INCLUDE = {
  items: { select: { quantity: true, lineTotal: true } },
  payments: { select: { method: true, amount: true, status: true } },
  customer: { select: { name: true } },
};

const ORDER_INCLUDE = {
  items: { select: { quantity: true, lineTotal: true } },
  customer: { select: { name: true } },
};

function saleWhere(range, params, extra = {}) {
  const where = { createdAt: { gte: range.start, lte: range.end }, ...extra };
  if (params.saleStatus && SALE_STATUSES.includes(params.saleStatus)) {
    where.status = params.saleStatus;
  }
  if (params.cashier) where.cashierName = params.cashier;
  if (params.channel) where.channel = params.channel;
  return where;
}

function orderWhere(range, params, extra = {}) {
  const where = { createdAt: { gte: range.start, lte: range.end }, ...extra };
  if (params.saleStatus && ORDER_STATUSES.includes(params.saleStatus)) {
    where.status = params.saleStatus;
  }
  if (params.orderStatus && ORDER_STATUSES.includes(params.orderStatus)) {
    where.status = params.orderStatus;
  }
  if (params.paymentStatus) where.paymentStatus = params.paymentStatus;
  if (params.customer) where.customerId = params.customer;
  if (params.channel) where.channel = params.channel;
  return where;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report builders — each returns { rows, summary, meta? }
// Row values stay raw (ISO dates, numbers); formatting happens at render/export.
// ─────────────────────────────────────────────────────────────────────────────

async function buildDailySales({ params, range }) {
  const includeSales = !channelSplitsSale(params.channel);
  const includeOrders = !channelSplitsOrder(params.channel);
  const paymentFilter = params.paymentMethod; // "Cash" | "KHQR" | ""

  const [sales, orders] = await Promise.all([
    includeSales
      ? prisma.sale.findMany({ where: saleWhere(range, params), include: SALE_INCLUDE, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    includeOrders
      ? prisma.order.findMany({ where: orderWhere(range, params), include: ORDER_INCLUDE, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const rows = [];

  for (const sale of sales) {
    const payments = sale.payments || [];
    if (paymentFilter && !payments.some((p) => normalizePaymentMethod(p.method) === paymentFilter)) {
      continue;
    }
    rows.push({
      saleId: sale.receiptNumber || sale.id,
      datetime: sale.createdAt.toISOString(),
      cashier: sale.cashierName || "—",
      customer: sale.customer?.name || "Walk-in",
      items: itemsCount(sale.items),
      subtotal: round2(sale.subtotal),
      discount: round2(sale.discount),
      total: round2(sale.total),
      paymentMethod: normalizePaymentMethod(payments[0]?.method),
      channel: "POS",
      status: displayStatus(sale.status),
    });
  }

  for (const order of orders) {
    const method = normalizePaymentMethod(order.paymentMethod);
    if (paymentFilter && method !== paymentFilter) continue;
    rows.push({
      saleId: order.orderNumber || order.id,
      datetime: order.createdAt.toISOString(),
      cashier: "Online",
      customer: order.customer?.name || "Guest",
      items: itemsCount(order.items),
      subtotal: round2(order.subtotal),
      discount: round2(order.discountAmount || order.couponDiscount || 0),
      total: round2(order.total),
      paymentMethod: method,
      channel: "Online",
      status: displayStatus(order.status),
    });
  }

  const cashRows = rows.filter((row) => row.paymentMethod === "Cash");
  const khqrRows = rows.filter((row) => row.paymentMethod === "KHQR");

  const summary = {
    totalTransactions: rows.length,
    itemsSold: sumBy(rows, "items"),
    grossSales: sumBy(rows, "subtotal"),
    totalDiscount: sumBy(rows, "discount"),
    netSales: sumBy(rows, "total"),
    cashSales: sumBy(cashRows, "total"),
    khqrSales: sumBy(khqrRows, "total"),
  };

  return { rows, summary };
}

async function buildSalesSummary({ params, range }) {
  const includeSales = !channelSplitsSale(params.channel);
  const includeOrders = !channelSplitsOrder(params.channel);

  const [sales, orders] = await Promise.all([
    includeSales
      ? prisma.sale.findMany({ where: saleWhere(range, params), include: SALE_INCLUDE })
      : Promise.resolve([]),
    includeOrders
      ? prisma.order.findMany({ where: orderWhere(range, params), include: ORDER_INCLUDE })
      : Promise.resolve([]),
  ]);

  const byDay = new Map();

  function dayRow(isoDate) {
    const key = dayKey(isoDate);
    if (!byDay.has(key)) {
      byDay.set(key, {
        date: `${key}T00:00:00`,
        transactions: 0,
        itemsSold: 0,
        grossSales: 0,
        discount: 0,
        netSales: 0,
        cash: 0,
        khqr: 0,
      });
    }
    return byDay.get(key);
  }

  for (const sale of sales) {
    const row = dayRow(sale.createdAt);
    row.transactions += 1;
    row.itemsSold += itemsCount(sale.items);
    row.grossSales = round2(row.grossSales + Number(sale.subtotal));
    row.discount = round2(row.discount + Number(sale.discount));
    row.netSales = round2(row.netSales + Number(sale.total));
    const primary = normalizePaymentMethod((sale.payments || [])[0]?.method);
    if (primary === "KHQR") row.khqr = round2(row.khqr + Number(sale.total));
    else row.cash = round2(row.cash + Number(sale.total));
  }

  for (const order of orders) {
    const row = dayRow(order.createdAt);
    row.transactions += 1;
    row.itemsSold += itemsCount(order.items);
    row.grossSales = round2(row.grossSales + Number(order.subtotal));
    row.discount = round2(row.discount + Number(order.discountAmount || order.couponDiscount || 0));
    row.netSales = round2(row.netSales + Number(order.total));
    const primary = normalizePaymentMethod(order.paymentMethod);
    if (primary === "KHQR") row.khqr = round2(row.khqr + Number(order.total));
    else row.cash = round2(row.cash + Number(order.total));
  }

  const rows = Array.from(byDay.values());

  const summary = {
    totalSales: sumBy(rows, "netSales"),
    totalTransactions: rows.reduce((sum, row) => sum + row.transactions, 0),
    totalItemsSold: sumBy(rows, "itemsSold"),
    averageTransaction: 0,
  };
  summary.averageTransaction = summary.totalTransactions
    ? round2(summary.totalSales / summary.totalTransactions)
    : 0;

  return { rows, summary };
}

async function buildBestSelling({ params, range }) {
  const channel = params.channel;
  const includeSales = !channelSplitsSale(channel);
  const includeOrders = !channelSplitsOrder(channel);

  const productSelect = {
    select: {
      quantity: true,
      lineTotal: true,
      variant: {
        select: {
          name: true,
          unit: { select: { abbreviation: true } },
          product: {
            select: {
              name: true,
              categoryId: true,
              brandId: true,
              categoryRef: { select: { name: true } },
              brandRef: { select: { name: true } },
            },
          },
        },
      },
    },
  };

  const [saleItems, orderItems] = await Promise.all([
    includeSales
      ? prisma.saleItem.findMany({
          where: { sale: saleWhere(range, params) },
          ...productSelect,
        })
      : Promise.resolve([]),
    includeOrders
      ? prisma.orderItem.findMany({
          where: { order: orderWhere(range, params, { status: { notIn: EXCLUDED_ORDER_STATUSES } }) },
          ...productSelect,
        })
      : Promise.resolve([]),
  ]);

  const productMap = new Map();
  let totalRevenue = 0;

  for (const item of [...saleItems, ...orderItems]) {
    const variant = item.variant;
    const product = variant?.product;
    if (!product) continue;
    if (params.category && product.categoryId !== params.category) continue;
    if (params.brand && product.brandId !== params.brand) continue;

    const existing = productMap.get(product.name) || {
      product: product.name,
      category: product.categoryRef?.name || "Uncategorized",
      qtySold: 0,
      unit: variant.unit?.abbreviation || "pcs",
      totalSales: 0,
    };
    existing.qtySold += Number(item.quantity || 0);
    existing.totalSales = round2(existing.totalSales + Number(item.lineTotal || 0));
    productMap.set(product.name, existing);
    totalRevenue += Number(item.lineTotal || 0);
  }

  const rows = Array.from(productMap.values()).map((row) => ({
    ...row,
    totalSales: round2(row.totalSales),
    percentOfSales: totalRevenue > 0 ? round2((row.totalSales / totalRevenue) * 100) : 0,
  }));

  // Rank is by revenue (default sort); it stays stable when the table is re-sorted.
  rows.sort((a, b) => b.totalSales - a.totalSales);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  const summary = {
    uniqueProducts: rows.length,
    totalUnits: sumBy(rows, "qtySold"),
    totalRevenue: round2(totalRevenue),
    topProduct: rows[0]?.product || "—",
  };

  return { rows, summary };
}

async function buildPaymentMethod({ params, range }) {
  const includeSales = !channelSplitsSale(params.channel);
  const includeOrders = !channelSplitsOrder(params.channel);
  const statusFilter = params.paymentStatus;

  const [sales, orders] = await Promise.all([
    includeSales
      ? prisma.sale.findMany({
          where: saleWhere(range, params),
          select: { payments: { select: { method: true, amount: true, status: true } } },
        })
      : Promise.resolve([]),
    includeOrders
      ? prisma.order.findMany({
          where: orderWhere(range, params),
          select: { paymentMethod: true, total: true, paymentStatus: true },
        })
      : Promise.resolve([]),
  ]);

  const methodMap = new Map();

  function bucket(method) {
    if (!methodMap.has(method)) {
      methodMap.set(method, { paymentMethod: method, transactions: 0, totalAmount: 0 });
    }
    return methodMap.get(method);
  }

  for (const sale of sales) {
    for (const payment of sale.payments || []) {
      if (statusFilter && payment.status !== statusFilter) continue;
      const method = normalizePaymentMethod(payment.method);
      const entry = bucket(method);
      entry.transactions += 1;
      entry.totalAmount = round2(entry.totalAmount + Number(payment.amount || 0));
    }
  }

  for (const order of orders) {
    if (statusFilter && order.paymentStatus !== statusFilter) continue;
    const method = normalizePaymentMethod(order.paymentMethod);
    const entry = bucket(method);
    entry.transactions += 1;
    entry.totalAmount = round2(entry.totalAmount + Number(order.total || 0));
  }

  const rows = Array.from(methodMap.values());
  const grandTotal = sumBy(rows, "totalAmount");
  for (const row of rows) {
    row.percentage = grandTotal > 0 ? round2((row.totalAmount / grandTotal) * 100) : 0;
  }

  const summary = {
    totalAmount: grandTotal,
    totalTransactions: rows.reduce((sum, row) => sum + row.transactions, 0),
    cashAmount: sumBy(rows.filter((row) => row.paymentMethod === "Cash"), "totalAmount"),
    khqrAmount: sumBy(rows.filter((row) => row.paymentMethod === "KHQR"), "totalAmount"),
  };

  return { rows, summary };
}

async function buildSalesChannel({ params, range }) {
  const [sales, orders] = await Promise.all([
    prisma.sale.findMany({ where: saleWhere(range, params), include: SALE_INCLUDE }),
    prisma.order.findMany({ where: orderWhere(range, params), include: ORDER_INCLUDE }),
  ]);

  const channelMap = new Map();

  function bucket(name) {
    if (!channelMap.has(name)) {
      channelMap.set(name, {
        channel: name,
        transactions: 0,
        itemsSold: 0,
        grossSales: 0,
        discount: 0,
        netSales: 0,
      });
    }
    return channelMap.get(name);
  }

  for (const sale of sales) {
    const entry = bucket("POS");
    entry.transactions += 1;
    entry.itemsSold += itemsCount(sale.items);
    entry.grossSales = round2(entry.grossSales + Number(sale.subtotal));
    entry.discount = round2(entry.discount + Number(sale.discount));
    entry.netSales = round2(entry.netSales + Number(sale.total));
  }

  for (const order of orders) {
    const name = order.channel === "WHOLESALE" ? "Wholesale" : "Online";
    const entry = bucket(name);
    entry.transactions += 1;
    entry.itemsSold += itemsCount(order.items);
    entry.grossSales = round2(entry.grossSales + Number(order.subtotal));
    entry.discount = round2(entry.discount + Number(order.discountAmount || order.couponDiscount || 0));
    entry.netSales = round2(entry.netSales + Number(order.total));
  }

  const rows = Array.from(channelMap.values());

  const summary = {
    totalNetSales: sumBy(rows, "netSales"),
    totalTransactions: rows.reduce((sum, row) => sum + row.transactions, 0),
    totalItemsSold: sumBy(rows, "itemsSold"),
    bestChannel: rows.length
      ? rows.reduce((best, row) => (row.netSales > best.netSales ? row : best), rows[0]).channel
      : "—",
  };

  return { rows, summary };
}

async function buildOrders({ params, range }) {
  const orders = await prisma.order.findMany({
    where: orderWhere(range, params),
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map((order) => ({
    orderId: order.orderNumber || order.id,
    date: order.createdAt.toISOString(),
    customer: order.customer?.name || order.user?.name || "Guest",
    items: itemsCount(order.items),
    total: round2(order.total),
    paymentMethod: normalizePaymentMethod(order.paymentMethod),
    paymentStatus: displayStatus(order.paymentStatus),
    status: displayStatus(order.status),
  }));

  const summary = {
    totalOrders: rows.length,
    pendingOrders: orders.filter((order) => order.status === "PENDING").length,
    completedOrders: orders.filter((order) => order.status === "COMPLETED" || order.status === "DELIVERED").length,
    cancelledOrders: orders.filter((order) => order.status === "CANCELLED").length,
    totalAmount: sumBy(rows, "total"),
  };

  return { rows, summary };
}

// ── Inventory pipeline shared by inventory-stock and low-stock ───────────────

// Row status values are display strings; the stockStatus filter uses enum keys.
const STOCK_STATUS_LABELS = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
};

function stockStatusLabel(key) {
  return STOCK_STATUS_LABELS[key] || key;
}

async function loadStockRows({ params, range }) {
  const productWhere = {};
  if (params.category) productWhere.categoryId = params.category;
  if (params.brand) productWhere.brandId = params.brand;

  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      select: {
        id: true,
        name: true,
        stock: true,
        minStockAlert: true,
        categoryRef: { select: { name: true } },
        brandRef: { select: { name: true } },
        variants: {
          select: {
            id: true,
            inventory: { select: { quantity: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        type: { in: [...STOCK_IN_TYPES, ...STOCK_OUT_TYPES] },
      },
      select: { variantId: true, type: true, quantityChange: true },
    }),
  ]);

  const movementByVariant = new Map();
  for (const movement of movements) {
    const entry = movementByVariant.get(movement.variantId) || { in: 0, out: 0 };
    const change = Number(movement.quantityChange || 0);
    if (STOCK_IN_TYPES.includes(movement.type) && change > 0) entry.in += change;
    if (STOCK_OUT_TYPES.includes(movement.type) && change < 0) entry.out += Math.abs(change);
    movementByVariant.set(movement.variantId, entry);
  }

  const rows = [];
  for (const product of products) {
    const variantIds = new Set(product.variants.map((variant) => variant.id));

    let current = 0;
    for (const variant of product.variants) {
      current += variant.inventory.reduce((sum, inv) => sum + Number(inv.quantity || 0), 0);
    }
    if (!product.variants.length) current = Number(product.stock || 0);

    let stockIn = 0;
    let stockOut = 0;
    for (const variantId of variantIds) {
      const movement = movementByVariant.get(variantId);
      if (movement) {
        stockIn += movement.in;
        stockOut += movement.out;
      }
    }

    const minimumStock = Number(product.minStockAlert || 0);
    const openingStock = current - stockIn + stockOut;
    const status =
      current <= 0 ? "Out of Stock" : current <= minimumStock ? "Low Stock" : "In Stock";

    rows.push({
      product: product.name,
      category: product.categoryRef?.name || "Uncategorized",
      openingStock,
      stockIn,
      stockOut,
      currentStock: current,
      minimumStock,
      difference: current - minimumStock,
      status,
    });
  }

  return rows;
}

async function buildInventoryStock({ params, range }) {
  let rows = await loadStockRows({ params, range });
  if (params.stockStatus) {
    rows = rows.filter((row) => row.status === stockStatusLabel(params.stockStatus));
  }

  const summary = {
    totalProducts: rows.length,
    totalStockItems: rows.reduce((sum, row) => sum + Math.max(row.currentStock, 0), 0),
    lowStockProducts: rows.filter((row) => row.status === "Low Stock").length,
    outOfStockProducts: rows.filter((row) => row.status === "Out of Stock").length,
  };

  return { rows, summary };
}

async function buildLowStock({ params, range }) {
  let rows = await loadStockRows({ params, range });
  rows = rows.filter((row) => row.status !== "In Stock");
  if (params.stockStatus) {
    rows = rows.filter((row) => row.status === stockStatusLabel(params.stockStatus));
  }

  const summary = {
    lowStockProducts: rows.filter((row) => row.status === "Low Stock").length,
    outOfStockProducts: rows.filter((row) => row.status === "Out of Stock").length,
    totalUnitsShort: rows.reduce((sum, row) => sum + Math.max(row.minimumStock - row.currentStock, 0), 0),
    affectedCategories: new Set(rows.map((row) => row.category)).size,
  };

  return { rows, summary };
}

async function buildReturnsRefunds({ params, range }) {
  const statusFilter = params.returnStatus; // "REFUNDED" | "VOIDED" | ""
  const reasonFilter = params.returnReason;

  const wantReturns = statusFilter !== "VOIDED" && (!reasonFilter || reasonFilter !== "VOIDED");
  const wantVoided = statusFilter !== "REFUNDED" && (!reasonFilter || reasonFilter === "VOIDED");

  const returnWhere = { createdAt: { gte: range.start, lte: range.end } };
  if (reasonFilter && reasonFilter !== "VOIDED") returnWhere.reason = reasonFilter;
  if (params.cashier) returnWhere.sale = { ...returnWhere.sale, cashierName: params.cashier };

  const voidedWhere = {
    createdAt: { gte: range.start, lte: range.end },
    status: "VOIDED",
  };
  if (params.cashier) voidedWhere.cashierName = params.cashier;

  const [returns, voidedSales] = await Promise.all([
    wantReturns
      ? prisma.return.findMany({
          where: returnWhere,
          include: {
            items: {
              include: {
                variant: { select: { name: true, product: { select: { name: true } } } },
              },
            },
            sale: { include: { customer: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    wantVoided
      ? prisma.sale.findMany({
          where: voidedWhere,
          include: {
            items: { select: { name: true, quantity: true, lineTotal: true } },
            customer: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const rows = [];

  for (const record of returns) {
    for (const item of record.items || []) {
      const variant = item.variant;
      rows.push({
        saleId: record.sale?.receiptNumber || record.saleId,
        datetime: record.createdAt.toISOString(),
        customer: record.sale?.customer?.name || "Walk-in",
        product: variant?.product?.name
          ? `${variant.product.name}${variant.name ? ` — ${variant.name}` : ""}`
          : item.variantId,
        qty: Number(item.quantity || 0),
        amount: round2(Number(item.unitPrice || 0) * Number(item.quantity || 0)),
        reason: item.reason || RETURN_REASON_LABELS[record.reason] || "Other",
        status: "Refunded",
      });
    }
  }

  for (const sale of voidedSales) {
    for (const item of sale.items || []) {
      rows.push({
        saleId: sale.receiptNumber || sale.id,
        datetime: sale.createdAt.toISOString(),
        customer: sale.customer?.name || "Walk-in",
        product: item.name,
        qty: Number(item.quantity || 0),
        amount: round2(item.lineTotal),
        reason: "Voided at POS",
        status: "Voided",
      });
    }
  }

  const summary = {
    totalReturns: returns.length,
    totalReturnedItems: sumBy(
      rows.filter((row) => row.status === "Refunded"),
      "qty"
    ),
    totalRefundAmount: sumBy(
      rows.filter((row) => row.status === "Refunded"),
      "amount"
    ),
    voidedCount: voidedSales.length,
  };

  return { rows, summary };
}

async function buildCustomerPurchase({ params, range }) {
  const includeSales = !channelSplitsSale(params.channel);
  const includeOrders = !channelSplitsOrder(params.channel);

  const saleWhereBase = saleWhere(range, params, { customerId: { not: null } });
  const orderWhereBase = orderWhere(range, params, { customerId: { not: null } });

  const [sales, orders] = await Promise.all([
    includeSales
      ? prisma.sale.findMany({
          where: saleWhereBase,
          include: { items: { select: { quantity: true } }, customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
    includeOrders
      ? prisma.order.findMany({
          where: orderWhereBase,
          include: { items: { select: { quantity: true } }, customer: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const byCustomer = new Map();

  function bucket(customerId, name) {
    if (!byCustomer.has(customerId)) {
      byCustomer.set(customerId, {
        customer: name,
        totalOrders: 0,
        itemsPurchased: 0,
        totalSpent: 0,
        lastPurchase: null,
      });
    }
    return byCustomer.get(customerId);
  }

  for (const sale of sales) {
    const entry = bucket(sale.customerId, sale.customer?.name || "Unknown");
    entry.totalOrders += 1;
    entry.itemsPurchased += itemsCount(sale.items);
    entry.totalSpent = round2(entry.totalSpent + Number(sale.total));
    const created = sale.createdAt.toISOString();
    if (!entry.lastPurchase || created > entry.lastPurchase) entry.lastPurchase = created;
  }

  for (const order of orders) {
    const entry = bucket(order.customerId, order.customer?.name || "Unknown");
    entry.totalOrders += 1;
    entry.itemsPurchased += itemsCount(order.items);
    entry.totalSpent = round2(entry.totalSpent + Number(order.total));
    const created = order.createdAt.toISOString();
    if (!entry.lastPurchase || created > entry.lastPurchase) entry.lastPurchase = created;
  }

  let rows = Array.from(byCustomer.values());
  if (params.customer) rows = rows.filter((row) => row.customer === params.customer);
  for (const row of rows) {
    row.averageOrder = row.totalOrders ? round2(row.totalSpent / row.totalOrders) : 0;
  }

  const summary = {
    totalCustomers: rows.length,
    totalOrders: sumBy(rows, "totalOrders"),
    totalSpent: sumBy(rows, "totalSpent"),
    averageOrderValue: rows.length ? round2(sumBy(rows, "totalSpent") / Math.max(sumBy(rows, "totalOrders"), 1)) : 0,
  };

  return { rows, summary };
}

const BUILDERS = {
  "daily-sales": buildDailySales,
  "sales-summary": buildSalesSummary,
  "best-selling": buildBestSelling,
  "payment-method": buildPaymentMethod,
  "sales-channel": buildSalesChannel,
  orders: buildOrders,
  "inventory-stock": buildInventoryStock,
  "low-stock": buildLowStock,
  "returns-refunds": buildReturnsRefunds,
  "customer-purchase": buildCustomerPurchase,
};

const SEARCH_KEYS = {
  "daily-sales": ["saleId", "cashier", "customer"],
  "sales-summary": ["date"],
  "best-selling": ["product", "category"],
  "payment-method": ["paymentMethod"],
  "sales-channel": ["channel"],
  orders: ["orderId", "customer"],
  "inventory-stock": ["product", "category"],
  "low-stock": ["product", "category"],
  "returns-refunds": ["saleId", "customer", "product", "reason"],
  "customer-purchase": ["customer"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Meta: dynamic filter options per report
// ─────────────────────────────────────────────────────────────────────────────

async function buildMeta(report, params) {
  const needs = new Set(report.filters);
  const meta = {};

  const jobs = [];
  if (needs.has("cashier")) {
    jobs.push(
      prisma.sale
        .findMany({
          where: { cashierName: { not: null } },
          distinct: ["cashierName"],
          select: { cashierName: true },
          orderBy: { cashierName: "asc" },
        })
        .then((rows) => {
          meta.cashiers = rows.map((row) => row.cashierName).filter(Boolean);
        })
    );
  }
  if (needs.has("category")) {
    jobs.push(
      prisma.category
        .findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
        .then((rows) => {
          meta.categories = rows;
        })
    );
  }
  if (needs.has("brand")) {
    jobs.push(
      prisma.brand
        .findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
        .then((rows) => {
          meta.brands = rows;
        })
    );
  }
  if (needs.has("customer")) {
    jobs.push(
      prisma.customer
        .findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" }, take: 500 })
        .then((rows) => {
          meta.customers = rows;
        })
    );
  }

  await Promise.all(jobs);
  return meta;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function buildReportDataset(reportId, params = {}, options = {}) {
  const report = getReport(reportId);
  if (!report) {
    const error = new Error(`Unknown report: ${reportId}`);
    error.statusCode = 404;
    throw error;
  }

  const range = parseRangeParams(params);
  const builder = BUILDERS[report.id];
  if (!builder) {
    const error = new Error(`No dataset builder for report: ${reportId}`);
    error.statusCode = 501;
    throw error;
  }

  const built = await builder({ params, range, report });

  let rows = built.rows;
  rows = searchRows(rows, SEARCH_KEYS[report.id] || [], params.search);
  sortRows(rows, report.columns, params.sort || report.defaultSort.sort, params.dir || report.defaultSort.dir);

  const summary = built.summary || {};
  const totalRow = buildTotalRow(report, rows);
  const { rows: pagedRows, pagination } = paginate(rows, params, options.all, report.id);

  const meta = options.skipMeta ? {} : await buildMeta(report, params);
  const rangeMeta = { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label };

  return {
    reportId: report.id,
    reportName: report.name,
    columns: report.columns,
    summaryCards: report.summaryCards,
    rows: pagedRows,
    summary,
    totalRow,
    meta,
    range: rangeMeta,
    pagination,
  };
}
