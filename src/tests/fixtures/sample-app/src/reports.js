// The reports domain: build rows and render them as a plain-text table.
// There is intentionally NO export path here — that gap is what QRSPI features land in.

export const COLUMNS = ["id", "name", "total"];

const ROWS = [
  { id: 1, name: "Acme", total: 120.5 },
  { id: 2, name: "Globex", total: 80 },
  { id: 3, name: "Initech", total: 42.25 },
];

export function buildReport() {
  return { columns: COLUMNS, rows: ROWS };
}

// Render a report as a fixed-width text table (screen output only).
export function renderTable(report) {
  const header = report.columns.join(" | ");
  const body = report.rows
    .map((r) => report.columns.map((c) => String(r[c])).join(" | "))
    .join("\n");
  return `${header}\n${body}`;
}
