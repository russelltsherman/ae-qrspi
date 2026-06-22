# add-csv-export — research

## Findings
1. `buildReport()` returns `{ columns, rows }` with fixed in-memory rows — src/reports.js:14.
2. `COLUMNS` is `["id", "name", "total"]` — src/reports.js:3.
3. `renderTable(report)` formats a report as a fixed-width text table — src/reports.js:21.
4. `GET /reports` returns the rendered table wrapped in `<pre>` HTML — src/server.js:7.
5. The 404 branch handles any other path — src/server.js:12.

## Open questions
- No automated tests cover the reporting code [UNKNOWN].
