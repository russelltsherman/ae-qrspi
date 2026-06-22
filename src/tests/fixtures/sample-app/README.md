# sample-app (QRSPI test fixture)

A deliberately tiny app the QRSPI agents analyze in behavioral (L1) tests. It has a reports surface
that renders to the screen but **cannot export** — enough of a gap that a feature like
"add CSV export to the reports page" has somewhere real to land, without the fixture being large
enough to slow the tests.

```
src/reports.js   # builds report rows and renders them as a plain-text table
src/server.js    # exposes GET /reports (HTML) — the "reports page"
```

This is a fixture, not a product. Keep it minimal.
