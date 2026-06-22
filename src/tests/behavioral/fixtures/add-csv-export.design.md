# add-csv-export — design

## Current state
Reports are built as `{ columns, rows }` (src/reports.js:14) and rendered only as a fixed-width text
table for the `/reports` HTML page (src/server.js:7). There is no machine-readable output path.

## Desired end state
A user can download the same report data as CSV. A new route serves `text/csv` built from the same
`buildReport()` data, so the screen and the file never diverge.

## Design decisions
- **Reuse `buildReport()` as the single source of rows.** Trade-off: couples CSV to the existing
  shape, but guarantees the export matches what's on screen. Rejected: a separate query (risk of drift).
- **Add a `toCSV(report)` pure function next to `renderTable`.** Trade-off: one more renderer to keep
  in sync, but keeps formatting out of the route handler and makes it unit-testable.
- **Serve CSV at `GET /reports.csv`.** Trade-off: a second route vs a `?format=csv` query param;
  a distinct path is simpler to test and link. Open question for review: is a query param preferred?
