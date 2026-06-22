// The "reports page": GET /reports returns the rendered table as HTML.
// No download / export endpoint exists yet.
import { createServer } from "node:http";
import { buildReport, renderTable } from "./reports.js";

export function handle(req, res) {
  if (req.url === "/reports") {
    const table = renderTable(buildReport());
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<pre>${table}</pre>`);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(handle).listen(3000, () => console.log("reports app on :3000"));
}
