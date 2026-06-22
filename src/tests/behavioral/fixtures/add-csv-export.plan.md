# add-csv-export — plan

## Steps

1. **[slice 1]** Add a pure `toCSV(report)` to `src/reports.js`, beside `renderTable`
   (src/reports.js:21): emit the header row from `report.columns`, then one comma-joined line per row.
2. **[slice 1]** Add a unit test that calls `toCSV(buildReport())` and asserts the header plus the
   three data rows. **Checkpoint:** the unit test passes.
3. **[slice 2]** In `src/server.js`, add a `GET /reports.csv` branch to `handle` (src/server.js:6)
   that writes `content-type: text/csv` and `toCSV(buildReport())` as the body.
4. **[slice 2]** Add a request test hitting `/reports.csv`. **Checkpoint:** 200, `text/csv`, body
   equals `toCSV(buildReport())`.
