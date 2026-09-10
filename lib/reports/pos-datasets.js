import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Cashier-facing POS reports. Same dataset contract as lib/reports/datasets —
// rendered as a table and exported to PDF/CSV from the same filtered rows.
// Every row identifies the sale by its official Sale ID (Sale.receiptNumber,
// e.g. SALE-20260909-015); the internal cuid is only a fallback for legacy rows.
// ─────────────────────────────────────────────────────────────────────────────

const round2 = (value) => Number((Number(value) || 0).toFixed(2));

function normalizePaymentMethod(raw) {
  const value = String(raw || "").trim();
  if (!value) return "Cash";
  const up = value.toUpperCase();
  if (up.includes("KHQR") || up.includes("BAKONG") || up === "QR" || up.endsWith("_QR")) return "KHQR";
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

const sumBy = (rows, key) => round2(rows.reduce((sum, row) => sum + Number(row[key] || 0), 0));

export const POS_REPORTS = [
  {
    id: "pos-sales",
    name: "Daily POS Sales Report",
    description: "POS transactions for the selected period, identified by Sale ID.",
    defaultSort: { sort: "datetime", dir: "desc" },
    columns: [
      { key: "saleId", label: "Sale ID", type: "text", sortable: true },
      { key: "datetime", label: "Date & Time", type: "datetime", sortable: true },
      { key: "cashier", label: "Cashier", type: "text", sortable: true },
      { key: "customer", label: "Customer", type: "text", sortable: true },
      { key: "items", label: "Items", type: "int", sortable: true, align: "right" },
      { key: "subtotal", label: "Subtotal", type: "money", sortable: true, align: "right" },
      { key: "discount", label: "Discount", type: "money", sortable: true, align: "right" },
      { key: "total", label: "Total", type: "money", sortable: true, align: "right" },
      { key: "paymentMethod", label: "Payment", type: "text", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
    filters: ["paymentMethod", "saleStatus"],
    summaryCards: [
      { key: "totalTransactions", label: "Transactions", type: "int" },
      { key: "itemsSold", label: "Items Sold", type: "int" },
      { key: "netSales", label: "Net Sales", type: "money" },
      { key: "cashSales", label: "Cash Sales", type: "money" },
      { key: "khqrSales", label: "KHQR Sales", type: "money" },
    ],
    totalRowKeys: ["items", "subtotal", "discount", "total"],
  },
  {
    id: "pos-sales-detail",
    name: "POS Sales Detail",
    description: "Line-item detail for every POS sale — the receipt behind each Sale ID.",
    defaultSort: { sort: "datetime", dir: "desc" },
    columns: [
      { key: "saleId", label: "Sale ID", type: "text", sortable: true },
      { key: "datetime", label: "Date & Time", type: "datetime", sortable: true },
      { key: "product", label: "Product", type: "text", sortable: true },
      { key: "sku", label: "SKU", type: "text", sortable: true },
      { key: "qty", label: "Qty", type: "int", sortable: true, align: "right" },
      { key: "unitPrice", label: "Unit Price", type: "money", sortable: true, align: "right" },
      { key: "lineTotal", label: "Line Total", type: "money", sortable: true, align: "right" },
    ],
    filters: ["paymentMethod", "saleStatus"],
    summaryCards: [
      { key: "totalSales", label: "Transactions", type: "int" },
      { key: "totalLines", label: "Line Items", type: "int" },
      { key: "itemsSold", label: "Items Sold", type: "int" },
      { key: "netSales", label: "Net Sales", type: "money" },
    ],
    totalRowKeys: ["qty", "lineTotal"],
  },
  {
    id: "pos-payment-summary",
    name: "POS Payment Summary",
    description: "Cash vs KHQR as recorded by the cashier (KHQR is the recorded tender method, not a gateway transaction).",
    defaultSort: { sort: "totalAmount", dir: "desc" },
    columns: [
      { key: "paymentMethod", label: "Payment Method", type: "text", sortable: true },
      { key: "transactions", label: "Transactions", type: "int", sortable: true, align: "right" },
      { key: "totalAmount", label: "Total Amount", type: "money", sortable: true, align: "right" },
      { key: "percentage", label: "Percentage", type: "percent", sortable: true, align: "right" },
    ],
    filters: [],
    summaryCards: [
      { key: "totalAmount", label: "Total Collected", type: "money" },
      { key: "totalTransactions", label: "Transactions", type: "int" },
      { key: "cashAmount", label: "Cash", type: "money" },
      { key: "khqrAmount", label: "KHQR", type: "money" },
    ],
    totalRowKeys: ["transactions", "totalAmount", "percentage"],
  },
  {
    id: "pos-void-refund",
    name: "POS Void / Refund Report",
    description: "POS sales that were voided or refunded during the selected period.",
    defaultSort: { sort: "datetime", dir: "desc" },
    columns: [
      { key: "saleId", label: "Sale ID", type: "text", sortable: true },
      { key: "datetime", label: "Date & Time", type: "datetime", sortable: true },
      { key: "cashier", label: "Cashier", type: "text", sortable: true },
      { key: "customer", label: "Customer", type: "text", sortable: true },
      { key: "items", label: "Items", type: "int", sortable: true, align: "right" },
      { key: "total", label: "Total", type: "money", sortable: true, align: "right" },
      { key: "paymentMethod", label: "Payment", type: "text", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
    filters: ["saleStatus"],
    summaryCards: [
      { key: "voidedCount", label: "Voided Sales", type: "int" },
      { key: "refundedCount", label: "Refunded Sales", type: "int" },
      { key: "voidedValue", label: "Voided Value", type: "money" },
      { key: "refundedValue", label: "Refunded Value", type: "money" },
    ],
    totalRowKeys: ["items", "total"],
  },
];

const POS_REPORT_MAP = new Map(POS_REPORTS.map((report) => [report.id, report]));

const SALE_INCLUDE = {
  items: { select: { name: true, sku: true, quantity: true, unitPrice: true, lineTotal: true } },
  payments: { select: { method: true, amount: true } },
  customer: { select: { name: true } },
};

function parseRange(params = {}) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const preset = params.range || params.preset || "";
  if (params.startDate && params.endDate) {
    start = new Date(`${params.startDate}T00:00:00`);
    end = new Date(`${params.endDate}T23:59:59.999`);
  } else if (preset === "yesterday") {
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  } else if (preset === "this_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (preset === "this_week") {
    const day = (now.getDay() + 6) % 7;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0, 0);
  }

  const fmt = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const label = start.toDateString() === end.toDateString() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  return { start, end, label };
}

function baseScope(user, params, range) {
  const where = {
    channel: "POS",
    createdAt: { gte: range.start, lte: range.end },
  };
  if (params.branchId) where.branchId = params.branchId;
  if (params.cashier) where.cashierName = params.cashier;
  if (params.status) where.status = params.status;
  return where;
}

function saleRow(sale) {
  const payments = sale.payments || [];
  return {
    saleId: sale.receiptNumber || sale.id,
    datetime: sale.createdAt.toISOString(),
    cashier: sale.cashierName || "—",
    customer: sale.customer?.name || "Walk-in",
    items: itemsCount(sale.items),
    subtotal: round2(sale.subtotal),
    discount: round2(sale.discount),
    total: round2(sale.total),
    paymentMethod: normalizePaymentMethod(payments[0]?.method),
    status: displayStatus(sale.status),
    _rawStatus: sale.status,
    _payments: payments,
    _items: sale.items || [],
  };
}

function sortRows(rows, columns, sortKey, dir) {
  const column = columns.find((c) => c.key === sortKey && c.sortable !== false);
  if (!column) return rows;
  const numeric = ["money", "int", "percent"].includes(column.type);
  const multiplier = dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (numeric) return multiplier * ((Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0));
    if (column.type === "datetime" || column.type === "date") {
      return multiplier * ((Date.parse(a[sortKey]) || 0) - (Date.parse(b[sortKey]) || 0));
    }
    return multiplier * String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
  });
  return rows;
}

function paginate(rows, params) {
  const total = rows.length;
  const pageSize = Math.min(Math.max(parseInt(params.pageSize, 10) || 25, 5), 500);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(parseInt(params.page, 10) || 1, 1), pageCount);
  const wantsAll = params.all === "1" || params.all === "true";
  const offset = wantsAll ? 0 : (page - 1) * pageSize;
  const slice = wantsAll ? rows : rows.slice(offset, offset + pageSize);
  slice.forEach((row, index) => {
    row._rowKey = `${offset + index}`;
  });
  return { rows: slice, pagination: { page, pageSize, total, pageCount, all: Boolean(wantsAll) } };
}

export async function buildPosReportDataset(reportId, user, params = {}) {
  const report = POS_REPORT_MAP.get(reportId);
  if (!report) {
    const error = new Error(`Unknown POS report: ${reportId}`);
    error.statusCode = 404;
    throw error;
  }

  const range = parseRange(params);
  const scope = baseScope(user, params, range);
  const paymentFilter = params.paymentMethod; // "Cash" | "KHQR" | ""

  let sales;
  if (reportId === "pos-payment-summary") {
    sales = await prisma.sale.findMany({
      where: scope,
      select: { payments: { select: { method: true, amount: true } } },
    });
  } else {
    sales = await prisma.sale.findMany({
      where: scope,
      include: SALE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  let rows = [];
  let summary = {};

  if (reportId === "pos-sales") {
    rows = sales.map(saleRow);
    if (paymentFilter) rows = rows.filter((row) => row.paymentMethod === paymentFilter);
    const cashRows = rows.filter((row) => row.paymentMethod === "Cash");
    const khqrRows = rows.filter((row) => row.paymentMethod === "KHQR");
    summary = {
      totalTransactions: rows.length,
      itemsSold: sumBy(rows, "items"),
      grossSales: sumBy(rows, "subtotal"),
      totalDiscount: sumBy(rows, "discount"),
      netSales: sumBy(rows, "total"),
      cashSales: sumBy(cashRows, "total"),
      khqrSales: sumBy(khqrRows, "total"),
    };
  } else if (reportId === "pos-sales-detail") {
    const filteredSales = sales.filter((sale) => {
      if (!paymentFilter) return true;
      return (sale.payments || []).some((p) => normalizePaymentMethod(p.method) === paymentFilter);
    });
    for (const sale of filteredSales) {
      const row = saleRow(sale);
      for (const item of sale.items || []) {
        rows.push({
          saleId: row.saleId,
          datetime: row.datetime,
          product: item.name || "—",
          sku: item.sku || "—",
          qty: Number(item.quantity || 0),
          unitPrice: round2(item.unitPrice),
          lineTotal: round2(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0)),
        });
      }
    }
    summary = {
      totalSales: filteredSales.length,
      totalLines: rows.length,
      itemsSold: sumBy(rows, "qty"),
      netSales: round2(filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)),
    };
  } else if (reportId === "pos-payment-summary") {
    const methodMap = new Map();
    for (const sale of sales) {
      for (const payment of sale.payments || []) {
        const method = normalizePaymentMethod(payment.method);
        const entry = methodMap.get(method) || { paymentMethod: method, transactions: 0, totalAmount: 0 };
        entry.transactions += 1;
        entry.totalAmount = round2(entry.totalAmount + Number(payment.amount || 0));
        methodMap.set(method, entry);
      }
    }
    rows = Array.from(methodMap.values());
    const grandTotal = sumBy(rows, "totalAmount");
    for (const row of rows) {
      row.percentage = grandTotal > 0 ? round2((row.totalAmount / grandTotal) * 100) : 0;
    }
    summary = {
      totalAmount: grandTotal,
      totalTransactions: rows.reduce((sum, row) => sum + row.transactions, 0),
      cashAmount: sumBy(rows.filter((row) => row.paymentMethod === "Cash"), "totalAmount"),
      khqrAmount: sumBy(rows.filter((row) => row.paymentMethod === "KHQR"), "totalAmount"),
    };
  } else if (reportId === "pos-void-refund") {
    rows = sales.map(saleRow).filter((row) => row._rawStatus === "VOIDED" || row._rawStatus === "REFUNDED");
    if (paymentFilter) rows = rows.filter((row) => row.paymentMethod === paymentFilter);
    const voided = rows.filter((row) => row._rawStatus === "VOIDED");
    const refunded = rows.filter((row) => row._rawStatus === "REFUNDED");
    summary = {
      voidedCount: voided.length,
      refundedCount: refunded.length,
      voidedValue: sumBy(voided, "total"),
      refundedValue: sumBy(refunded, "total"),
    };
  }

  const search = String(params.search || "").trim().toLowerCase();
  if (search) {
    rows = rows.filter((row) =>
      ["saleId", "cashier", "customer", "product", "sku", "paymentMethod"].some((key) =>
        String(row[key] ?? "").toLowerCase().includes(search)
      )
    );
  }

  sortRows(rows, report.columns, params.sort || report.defaultSort.sort, params.dir || report.defaultSort.dir);
  const { rows: pagedRows, pagination } = paginate(rows, params);

  const totalRow = {};
  if (report.totalRowKeys.length) {
    // Total row always covers the full filtered dataset, not just the page.
    for (const key of report.totalRowKeys) {
      totalRow[key] = sumBy(rows, key);
    }
  }

  return {
    reportId: report.id,
    reportName: report.name,
    columns: report.columns,
    summaryCards: report.summaryCards,
    rows: pagedRows,
    summary,
    totalRow,
    range: { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label },
    pagination,
  };
}
