/**
 * Basit ve bağımlılıksız CSV yardımcıları.
 * RFC 4180 alt kümesi: çift tırnak kaçışı, gömülü satır sonu ve virgül desteği.
 */

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === "," || char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // yoksay
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim().length > 0));
}

export function parseCsvObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((cell) => cell.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (unknown[])[]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseDecimal(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const PRODUCT_CSV_HEADERS = [
  "title",
  "description",
  "sku",
  "vendor",
  "product_type",
  "price",
  "compare_at_price",
  "stock",
  "status",
  "tags",
] as const;

export const PRODUCT_CSV_TEMPLATE = toCsv([...PRODUCT_CSV_HEADERS], [
  [
    "Keten Gömlek",
    "Nefes alan %100 keten kumaş.",
    "KTN-001",
    "Atlas Moda",
    "Gömlek",
    "899.90",
    "1199.90",
    "25",
    "active",
    "yeni-sezon,keten",
  ],
]);
