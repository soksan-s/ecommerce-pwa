import PDFDocument from "pdfkit";

// ─────────────────────────────────────────────────────────────────────────────
// Exporters — render a report dataset (lib/reports/datasets) to CSV or PDF.
// Both render the CURRENTLY FILTERED dataset passed in, never the whole DB.
// ─────────────────────────────────────────────────────────────────────────────

export const STORE_NAME = "SOEUM SAVET STORE";

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? "");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatCellValue(value, type, { withCurrencySymbol = false } = {}) {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "money": {
      const amount = (Number(value) || 0).toFixed(2);
      return withCurrencySymbol ? `$${amount}` : amount;
    }
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    case "datetime":
      return formatDateTime(value);
    case "date":
      return formatDate(value);
    default:
      return String(value);
  }
}

function csvEscape(cell) {
  const value = String(cell ?? "");
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCsv(dataset) {
  const { columns, rows, totalRow } = dataset;
  const lines = [];
  lines.push(columns.map((column) => csvEscape(column.label)).join(","));
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(formatCellValue(row[column.key], column.type))).join(","));
  }
  if (totalRow) {
    lines.push(
      columns
        .map((column) => {
          if (column.key === totalRow.__labelKey || columns[0].key === column.key) {
            return csvEscape("TOTAL");
          }
          const value = totalRow[column.key];
          return csvEscape(value === undefined ? "" : formatCellValue(value, column.type));
        })
        .join(",")
    );
  }
  // BOM so Excel opens the file as UTF-8
  return `\uFEFF${lines.join("\r\n")}`;
}

// ── PDF ──────────────────────────────────────────────────────────────────────

const PAGE_MARGIN = 36;
const CELL_PADDING = 4;
const CELL_FONT_SIZE = 7.5;
const HEADER_FONT_SIZE = 8;

function estimateColumnWidths(doc, columns, rows) {
  const available = doc.page.width - PAGE_MARGIN * 2;
  const sample = rows.slice(0, 200);
  const weights = columns.map((column) => {
    let weight = column.label.length;
    for (const row of sample) {
      const text = formatCellValue(row[column.key], column.type, { withCurrencySymbol: true });
      weight = Math.max(weight, Math.min(String(text).length, 30));
    }
    if (column.type === "money") weight = Math.max(weight, 8);
    if (column.type === "datetime") weight = Math.max(weight, 16);
    return Math.max(weight, 6);
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((weight) => (available * weight) / totalWeight);
}

function drawTableCell(doc, text, x, y, width, height, { bold = false } = {}) {
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(bold ? HEADER_FONT_SIZE : CELL_FONT_SIZE)
    .fillColor("#0f172a")
    .text(text, x + CELL_PADDING, y + CELL_PADDING, {
      width: width - CELL_PADDING * 2,
      height: height - CELL_PADDING * 2,
      align: "left",
      lineBreak: false,
      ellipsis: true,
    });
}

// `rawValues` skips per-type formatting — used for the header row (labels like
// "Subtotal" must not be run through the money formatter) and TOTAL labels.
function drawTableRow(doc, columns, widths, values, y, { bold = false, background = null, rawValues = false } = {}) {
  const cellText = (column) =>
    rawValues
      ? String(values[column.key] ?? "")
      : formatCellValue(values[column.key], column.type, { withCurrencySymbol: true });

  const rowHeight = Math.max(
    ...columns.map((column, index) =>
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? HEADER_FONT_SIZE : CELL_FONT_SIZE)
        .heightOfString(cellText(column), {
          width: widths[index] - CELL_PADDING * 2,
        })
    ),
    18
  ) + CELL_PADDING * 2;

  if (background) {
    doc.save().fillColor(background).rect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, rowHeight).fill().restore();
  }

  let x = PAGE_MARGIN;
  columns.forEach((column, index) => {
    drawTableCell(doc, cellText(column), x, y, widths[index], rowHeight, { bold });
    x += widths[index];
  });

  doc
    .save()
    .strokeColor("#e2e8f0")
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, y + rowHeight)
    .lineTo(doc.page.width - PAGE_MARGIN, y + rowHeight)
    .stroke()
    .restore();

  return rowHeight;
}

export function buildPdf(dataset) {
  const { reportName, columns, rows, summary, totalRow, range } = dataset;

  return new Promise((resolve, reject) => {
    const landscape = columns.length > 7;
    const doc = new PDFDocument({
      size: "A4",
      layout: landscape ? "landscape" : "portrait",
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      bufferPages: true,
      info: { Title: `${STORE_NAME} — ${reportName}`, Creator: "Report Management Module" },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // ── Header ──
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text(STORE_NAME, PAGE_MARGIN, PAGE_MARGIN);
    doc.font("Helvetica").fontSize(11).fillColor("#334155").text(reportName, PAGE_MARGIN, doc.y + 4);
    doc.fontSize(9).fillColor("#64748b");
    doc.text(`Period: ${range?.label || "—"}`, PAGE_MARGIN, doc.y + 4);
    doc.text(`Generated: ${formatDateTime(new Date())}`, PAGE_MARGIN, doc.y + 2);
    doc.moveTo(PAGE_MARGIN, doc.y + 8).lineTo(doc.page.width - PAGE_MARGIN, doc.y + 8).strokeColor("#cbd5e1").lineWidth(1).stroke();

    let y = doc.y + 18;
    const pageBottom = () => doc.page.height - PAGE_MARGIN - 30;

    // ── Table ──
    const widths = estimateColumnWidths(doc, columns, rows);

    function drawTableHeader() {
      const values = Object.fromEntries(columns.map((column) => [column.key, column.label]));
      y += drawTableRow(doc, columns, widths, values, y, { bold: true, background: "#e2e8f0", rawValues: true });
    }

    function ensureSpace(rowHeight) {
      if (y + rowHeight > pageBottom()) {
        doc.addPage();
        y = PAGE_MARGIN + 8;
        drawTableHeader();
      }
    }

    y += 4;
    drawTableHeader();

    for (const row of rows) {
      const rowHeight =
        Math.max(
          ...columns.map((column, index) =>
            doc
              .font("Helvetica")
              .fontSize(CELL_FONT_SIZE)
              .heightOfString(formatCellValue(row[column.key], column.type, { withCurrencySymbol: true }), {
                width: widths[index] - CELL_PADDING * 2,
              })
          ),
          14
        ) + CELL_PADDING * 2;
      ensureSpace(rowHeight);
      y += drawTableRow(doc, columns, widths, row, y);
    }

    if (totalRow) {
      const totalValues = {};
      for (const column of columns) {
        if (column.key === columns[0].key) {
          totalValues[column.key] = "TOTAL";
          continue;
        }
        const value = totalRow[column.key];
        totalValues[column.key] = value === undefined ? "" : formatCellValue(value, column.type, { withCurrencySymbol: true });
      }
      ensureSpace(24);
      y += drawTableRow(doc, columns, widths, totalValues, y, { bold: true, background: "#f1f5f9", rawValues: true });
    }

    // ── Summary section ──
    if (summary && Object.keys(summary).length) {
      ensureSpace(60);
      y += 14;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text("Summary", PAGE_MARGIN, y);
      y = doc.y + 6;
      const summaryLabels = dataset.summaryCards || [];
      const entries = summaryLabels.length
        ? summaryLabels
            .map((card) => ({ label: card.label, value: summary[card.key], type: card.type }))
            .filter((entry) => entry.value !== undefined)
        : Object.entries(summary).map(([label, value]) => ({ label, value, type: "text" }));

      function formatSummaryValue(value, type) {
        if (type === "money") return `$${(Number(value) || 0).toFixed(2)}`;
        if (type === "int") return Number(value || 0).toLocaleString("en-US");
        return String(value);
      }

      for (const entry of entries) {
        ensureSpace(14);
        doc.font("Helvetica").fontSize(9).fillColor("#334155").text(entry.label, PAGE_MARGIN, y, { continued: true })
          .font("Helvetica-Bold").text(`: ${formatSummaryValue(entry.value, entry.type)}`);
        y = doc.y + 2;
      }
    }

    // ── Footers (page numbers on every buffered page) ──
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i += 1) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(7.5).fillColor("#94a3b8");
      doc.text(`${STORE_NAME} — Report Management Module`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN - 12, {
        lineBreak: false,
        width: 260,
      });
      doc.text(`Page ${i + 1} of ${pages.count}`, doc.page.width - PAGE_MARGIN - 80, doc.page.height - PAGE_MARGIN - 12, {
        lineBreak: false,
        width: 80,
        align: "right",
      });
    }

    doc.end();
  });
}

export function exportFilename(reportId, format) {
  const today = formatDate(new Date());
  return `${reportId}_report_${today}.${format}`;
}
