import type { RequestHandler } from "express";
import { DatabaseSync } from "node:sqlite";

export interface DashboardOptions {
  dbPath: string;
  apiKey?: string; // if unset -> route returns 503 (disabled)
  pageSize?: number; // default 50
}

interface Row {
  ts: string;
  network: string;
  asset: string;
  amount: string;
  payer: string;
  tx_ref: string;
  mica_compliant: number;
}

const EXPLORER: Record<string, string> = {
  "eip155:8453": "https://basescan.org",
  "eip155:84532": "https://sepolia.basescan.org",
};

/** 0xabcd…ef12 — first 6 + last 4; returned as-is if too short to shorten. */
export function short(hex: string): string {
  return hex.length <= 12 ? hex : `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

/** Basescan tx URL for the row's network, or null for an unknown network. */
export function explorerTxUrl(network: string, txRef: string): string | null {
  const base = EXPLORER[network];
  return base ? `${base}/tx/${txRef}` : null;
}

/** HTML-escape a cell value (payer comes from an attacker-influenceable header). */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRow(r: Row): string {
  const url = explorerTxUrl(r.network, r.tx_ref);
  const txCell = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(short(r.tx_ref))}</a>`
    : esc(short(r.tx_ref));
  const mica = r.mica_compliant ? "✓" : "✗";
  return `<tr>
    <td>${esc(r.ts)}</td>
    <td>${esc(r.network)}</td>
    <td>${esc(r.asset)}</td>
    <td>${esc(r.amount)}</td>
    <td title="${esc(r.payer)}">${esc(short(r.payer))}</td>
    <td>${txCell}</td>
    <td class="mica ${r.mica_compliant ? "ok" : "no"}">${mica}</td>
  </tr>`;
}

function pagerLink(page: number, key: string, label: string): string {
  return `<a href="/audit?page=${page}&key=${encodeURIComponent(key)}">${label}</a>`;
}

function renderPage(rows: Row[], page: number, pageSize: number, total: number, key: string): string {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const body = rows.length
    ? `<table>
        <thead><tr>
          <th>ts</th><th>network</th><th>asset</th><th>amount</th>
          <th>payer</th><th>tx_ref</th><th>mica</th>
        </tr></thead>
        <tbody>${rows.map(renderRow).join("")}</tbody>
      </table>`
    : `<p class="empty">No transactions yet.</p>`;

  const prev = page > 0 ? pagerLink(page - 1, key, "← Prev") : "";
  const next = page < pages - 1 ? pagerLink(page + 1, key, "Next →") : "";
  const pager = total
    ? `<div class="pager">${prev}<span>Page ${page + 1} of ${pages} · ${total} rows</span>${next}</div>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>x402-mica audit log</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#111}
  h1{font-size:1.2rem}
  table{border-collapse:collapse;width:100%}
  th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid #eee;white-space:nowrap}
  th{border-bottom:2px solid #ccc;font-weight:600}
  td.mica{text-align:center;font-weight:700}
  .mica.ok{color:#15803d}.mica.no{color:#b91c1c}
  .pager{margin-top:1rem;display:flex;gap:1rem;align-items:center}
  .empty{color:#666}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
</style></head>
<body>
  <h1>x402-mica — MiCA compliance audit log</h1>
  ${body}
  ${pager}
</body></html>`;
}

/** Read-only, key-gated, paginated audit dashboard at GET /audit. */
export function auditDashboard(options: DashboardOptions): RequestHandler {
  const pageSize = options.pageSize ?? 50;
  // Read-only connection reused across requests (do NOT use openDb() — it writes/creates).
  const db = options.apiKey ? new DatabaseSync(options.dbPath, { readOnly: true }) : null;
  const rowsStmt = db?.prepare("SELECT * FROM transactions ORDER BY id DESC LIMIT ? OFFSET ?");
  const countStmt = db?.prepare("SELECT count(*) AS c FROM transactions");

  return (req, res) => {
    if (!options.apiKey || !db || !rowsStmt || !countStmt) {
      res.status(503).send("audit dashboard disabled: set AUDIT_API_KEY");
      return;
    }
    // ponytail: plain compare, local-only dashboard; ?key= is a browser-pagination convenience.
    const provided = req.header("x-api-key") ?? (typeof req.query.key === "string" ? req.query.key : "");
    if (provided !== options.apiKey) {
      res.status(401).send("unauthorized");
      return;
    }

    const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);
    const total = (countStmt.get() as { c: number }).c;
    const rows = rowsStmt.all(pageSize, page * pageSize) as unknown as Row[];

    res.type("html").send(renderPage(rows, page, pageSize, total, options.apiKey));
  };
}
