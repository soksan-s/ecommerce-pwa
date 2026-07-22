export function parseCsvRows(rawCsv) {
  const normalized = String(rawCsv || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const [headerLine, ...lines] = normalized.split("\n").filter(Boolean);
  const headers = headerLine.split(",").map((value) => value.trim());

  return lines.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce((result, header, index) => {
      result[header] = values[index] || "";
      return result;
    }, {});
  });
}
