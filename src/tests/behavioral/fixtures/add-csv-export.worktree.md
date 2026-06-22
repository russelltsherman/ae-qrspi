# add-csv-export — worktree

## Branches

| slice | branch | depends on | checkpoint |
| --- | --- | --- | --- |
| 1 | add-csv-export-slice-1-tocsv | — | unit test: `toCSV(buildReport())` header + rows |
| 2 | add-csv-export-slice-2-route | slice 1 | request test: `GET /reports.csv` → 200, `text/csv`, body equals `toCSV(buildReport())` |
