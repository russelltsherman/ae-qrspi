# add-csv-export — implement

## Slices

### slice 1
Added `toCSV(report)` beside `renderTable` in `src/reports.js`: header row from `report.columns`,
then one comma-joined line per row.
- **Checkpoint:** `node --test test/reports.test.mjs` → pass (header + 3 rows match `buildReport()`).

### slice 2
Added a `GET /reports.csv` branch to `handle` in `src/server.js` writing `content-type: text/csv`
and `toCSV(buildReport())`.
- **Checkpoint:** `node --test test/server.test.mjs` → pass (200, `text/csv`, body equals
  `toCSV(buildReport())`).
