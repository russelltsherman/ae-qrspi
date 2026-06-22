# add-csv-export — structure

## Signatures & types
- `toCSV(report: { columns: string[], rows: object[] }): string` — new, in src/reports.js, beside
  `renderTable` (src/reports.js:21). Returns RFC-4180-ish CSV: header row from `columns`, one line
  per row, values comma-joined.
- `handle(req, res)` (src/server.js:6) gains a branch for `GET /reports.csv` that writes
  `content-type: text/csv` and the `toCSV(buildReport())` body.

## Vertical slices

| slice | description | touches | checkpoint |
| --- | --- | --- | --- |
| 1 | `toCSV` turns a report into correct CSV text | src/reports.js | unit test: header + rows match `buildReport()` |
| 2 | `GET /reports.csv` serves the CSV with the right content-type | src/server.js | request test: 200, `text/csv`, body equals `toCSV(buildReport())` |
