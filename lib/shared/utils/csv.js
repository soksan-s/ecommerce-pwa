// Header aliases used by the product import flow. Keys are normalized header
// names (trimmed, lowercased, spaces → underscores). Values are the canonical
// field names used by the import API.
const HEADER_ALIASES = {
  name: "name",
  product: "name",
  product_name: "name",
  productname: "name",
  title: "name",
  item: "name",
  item_name: "name",
  itemname: "name",
  sku: "sku",
  item_sku: "sku",
  barcode: "barcode",
  upc: "barcode",
  ean: "barcode",
  category: "category",
  categories: "category",
  type: "category",
  description: "description",
  desc: "description",
  details: "description",
  price: "price",
  unit_price: "price",
  unitprice: "price",
  cost: "costPrice",
  cost_price: "costPrice",
  costprice: "costPrice",
  wholesale: "wholesalePrice",
  wholesale_price: "wholesalePrice",
  stock: "stock",
  quantity: "stock",
  qty: "stock",
  units: "stock",
  available: "stock",
  inventory: "stock",
  image: "imageUrl",
  image_url: "imageUrl",
  imageurl: "imageUrl",
  img: "imageUrl",
  photo: "imageUrl",
  image_link: "imageUrl",
  picture: "imageUrl",
  thumbnail: "imageUrl",
  discount: "discountPercent",
  discount_percent: "discountPercent",
  discountpercent: "discountPercent",
  discount_pct: "discountPercent",
  sale: "discountPercent",
  active: "isActive",
  status: "isActive",
  is_active: "isActive",
  published: "isActive",
  enabled: "isActive",
  min_stock: "minStockAlert",
  minstock: "minStockAlert",
  min_stock_alert: "minStockAlert",
  low_stock: "minStockAlert",
};

/**
 * Strip a UTF-8 BOM if present.
 */
function stripBom(value) {
  return String(value || "").replace(/^\uFEFF/, "");
}

/**
 * Normalize a header name: trim, lowercase, collapse spaces to underscores.
 */
function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Resolve a normalized header to its canonical field name.
 */
export function resolveHeaderAlias(rawHeader) {
  const normalized = normalizeHeader(rawHeader);
  return HEADER_ALIASES[normalized] || normalized;
}

/**
 * Parse a CSV string into an array of plain objects.
 *
 * Handles:
 * - UTF-8 BOM
 * - CRLF / LF / CR line endings
 * - Quoted fields (including escaped double quotes `""`)
 * - Commas and newlines inside quoted fields
 * - Header alias normalization (e.g. `Product Name` → `name`, `Image URL` → `imageUrl`)
 *
 * @param {string} rawCsv
 * @returns {Array<Record<string, string>>}
 */
export function parseCsvRows(rawCsv) {
  const source = stripBom(rawCsv);
  if (!source.trim()) {
    return [];
  }

  // Split into logical records respecting quotes and newlines inside quotes.
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          // Escaped quote inside a quoted field.
          field += '"';
          i += 2;
          continue;
        }
        // End of quoted field.
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      record.push(field);
      field = "";
      i += 1;
      continue;
    }

    if (char === "\n") {
      record.push(field);
      field = "";
      // Skip a preceding \r already handled by trimming each field later.
      if (record.some((value) => value.trim() !== "")) {
        records.push(record);
      }
      record = [];
      i += 1;
      continue;
    }

    if (char === "\r") {
      // Treat \r\n and lone \r as a record break.
      if (source[i + 1] === "\n") {
        i += 1;
      }
      record.push(field);
      field = "";
      if (record.some((value) => value.trim() !== "")) {
        records.push(record);
      }
      record = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Push the final record.
  record.push(field);
  if (record.some((value) => value.trim() !== "")) {
    records.push(record);
  }

  if (!records.length) {
    return [];
  }

  const [headerRecord, ...dataRecords] = records;
  const headers = headerRecord.map((value) => value.trim());
  const rowCount = dataRecords.length;

  return dataRecords.map((values) => {
    const result = {};
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (!header) {
        continue;
      }
      const key = resolveHeaderAlias(header);
      result[key] = (values[index] || "").trim();
    }
    return result;
  });
}

