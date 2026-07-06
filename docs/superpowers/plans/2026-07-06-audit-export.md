# Audit Export (CSV/JSON) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV/JSON download of the audit log from `GET /audit` with an inclusive date filter, plus the same filter on the HTML view (native date inputs, zero JS).

**Architecture:** Everything lives in `src/dashboard.ts` (the feature is dashboard-shaped and the file stays small). Three new pure, exported, unit-tested helpers — `dateBounds`, `toCsv`, `exportFilename` — and a rewritten handler that builds one WHERE fragment shared by the HTML view and both exports.

**Tech Stack:** Express + `node:sqlite` (already in place). No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-audit-export-design.md`.
- 503/401 gate behavior unchanged and applies to exports too.
- CSV must be RFC 4180 (CRLF, quote-doubling) **with formula-injection guard** — payer is attacker-influenceable and the audience opens the file in Excel. Trust boundary; not skippable.
- All `ts` values are our own `new Date().toISOString()` output — date filtering is lexicographic text comparison.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Pure helpers (`dateBounds`, `toCsv`, `exportFilename`)

**Files:**
- Modify: `src/dashboard.ts` (add helpers near `short`/`esc`)
- Test: `src/dashboard.test.ts` (append)

**Interfaces:**
- Produces (consumed by Task 2):
  - `dateBounds(from?: string, to?: string): { from?: string; to?: string } | null` — `null` = malformed input (caller sends 400); date-only `to` expanded to `<to>T23:59:59.999Z`.
  - `toCsv(rows: Row[]): string` — full CSV document incl. header, CRLF line ends.
  - `exportFilename(ext: string, from?: string, to?: string): string`.

- [ ] **Step 1: Write the failing tests** — append to `src/dashboard.test.ts` above the final `console.log`:

```ts
import { toCsv, dateBounds, exportFilename } from "./dashboard.js";

// dateBounds: passthrough, end-of-day expansion, full ISO kept, malformed -> null
assert.deepEqual(dateBounds(undefined, undefined), { from: undefined, to: undefined });
assert.deepEqual(dateBounds("2026-04-01", "2026-06-30"),
  { from: "2026-04-01", to: "2026-06-30T23:59:59.999Z" });
assert.equal(dateBounds(undefined, "2026-07-06T05:00:00.000Z")!.to, "2026-07-06T05:00:00.000Z");
assert.equal(dateBounds("junk", undefined), null);
assert.equal(dateBounds(undefined, "06/30/2026"), null);

// toCsv: header, CRLF, RFC 4180 quoting + formula-injection guard on a hostile payer
const csvRows = [{
  ts: "2026-07-06T05:12:33.006Z", network: "eip155:84532", asset: "EURC", amount: "0.01",
  payer: '=HYPERLINK("http://evil")', tx_ref: "0x82df", mica_compliant: 1,
}];
const csv = toCsv(csvRows as never);
assert(csv.startsWith("ts,network,asset,amount,payer,tx_ref,mica_compliant\r\n"));
assert(csv.includes('"\'=HYPERLINK(""http://evil"")"')); // guarded THEN quoted
assert(csv.endsWith(",0x82df,1\r\n"));

// exportFilename
assert.equal(exportFilename("csv", "2026-04-01", "2026-06-30"), "x402-mica-audit-2026-04-01-2026-06-30.csv");
assert.equal(exportFilename("json", undefined, undefined), "x402-mica-audit.json");
```

(Imports merge into the existing import line from `./dashboard.js`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/dashboard.test.ts`
Expected: FAIL — `toCsv` has no export.

- [ ] **Step 3: Implement** — add to `src/dashboard.ts` after `esc()`:

```ts
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/;

/** Validate/normalize the inclusive ?from=/?to= bounds; null = malformed (caller 400s). */
export function dateBounds(from?: string, to?: string): { from?: string; to?: string } | null {
  const ok = (s: string) => DATE_RE.test(s) || ISO_RE.test(s);
  if ((from && !ok(from)) || (to && !ok(to))) return null;
  // Our ts values are always toISOString() output, so a date-only `to` covers its
  // whole day via this exact upper bound; a date-only `from` compares correctly as-is.
  return { from, to: to && DATE_RE.test(to) ? `${to}T23:59:59.999Z` : to };
}

const CSV_HEADER = "ts,network,asset,amount,payer,tx_ref,mica_compliant";

function csvField(v: string): string {
  // Formula-injection guard first (payer is attacker-influenceable, target app is Excel),
  // then RFC 4180 quoting.
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Full CSV document (header + CRLF rows) for an export download. */
export function toCsv(rows: Row[]): string {
  const lines = rows.map((r) =>
    [r.ts, r.network, r.asset, r.amount, r.payer, r.tx_ref, String(r.mica_compliant)]
      .map(csvField)
      .join(","),
  );
  return [CSV_HEADER, ...lines].join("\r\n") + "\r\n";
}

/** x402-mica-audit[-<from-date>][-<to-date>].<ext> */
export function exportFilename(ext: string, from?: string, to?: string): string {
  const part = (s?: string) => (s ? `-${s.slice(0, 10)}` : "");
  return `x402-mica-audit${part(from)}${part(to)}.${ext}`;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS (all four test files… three files, all green)

- [ ] **Step 5: Commit**

```bash
git add src/dashboard.ts src/dashboard.test.ts
git commit -m "Add CSV/date-filter helpers for audit export"
```

---

### Task 2: Handler + HTML filter UI

**Files:**
- Modify: `src/dashboard.ts` — `renderPage`, `pagerLink`, `auditDashboard`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: `GET /audit` honors `format`/`from`/`to` per the spec table. `DashboardOptions` unchanged.

- [ ] **Step 1: Rework the handler.** Replace `pagerLink`, `renderPage`, and `auditDashboard` with:

```ts
function queryString(key: string, from: string | undefined, to: string | undefined, extra: Record<string, string | number>): string {
  const p = new URLSearchParams({ key });
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

function renderPage(
  rows: Row[], page: number, pageSize: number, total: number,
  key: string, from?: string, to?: string,
): string {
  const qs = (extra: Record<string, string | number>) => esc(queryString(key, from, to, extra));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const filter = `<form method="get" class="filter">
    <input type="hidden" name="key" value="${esc(key)}">
    <label>from <input type="date" name="from" value="${esc(from ?? "")}"></label>
    <label>to <input type="date" name="to" value="${esc(to ?? "")}"></label>
    <button>Apply</button>
    <span class="dl">download: <a href="/audit?${qs({ format: "csv" })}">CSV</a> · <a href="/audit?${qs({ format: "json" })}">JSON</a></span>
  </form>`;
  const body = rows.length
    ? `<table>
        <thead><tr>
          <th>ts</th><th>network</th><th>asset</th><th>amount</th>
          <th>payer</th><th>tx_ref</th><th>mica</th>
        </tr></thead>
        <tbody>${rows.map(renderRow).join("")}</tbody>
      </table>`
    : `<p class="empty">No transactions${from || to ? " in this date range" : " yet"}.</p>`;

  const prev = page > 0 ? `<a href="/audit?${qs({ page: page - 1 })}">← Prev</a>` : "";
  const next = page < pages - 1 ? `<a href="/audit?${qs({ page: page + 1 })}">Next →</a>` : "";
  const pager = total
    ? `<div class="pager">${prev}<span>Page ${page + 1} of ${pages} · ${total} rows</span>${next}</div>`
    : "";

  return `<!doctype html> … (unchanged head/style, plus:)
  .filter{display:flex;gap:.6rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap}
  .filter .dl{margin-left:auto}
  … <h1>…</h1>
  ${filter}
  ${body}
  ${pager} …`;
}
```

(The `<style>` block and page skeleton stay exactly as today; only the two new CSS rules and the `${filter}` line are added. `pagerLink` is deleted — the pager links are inlined above.)

In `auditDashboard`, drop the constructor-prepared `rowsStmt`/`countStmt` and rework the request handler:

```ts
export function auditDashboard(options: DashboardOptions): RequestHandler {
  const pageSize = options.pageSize ?? 50;
  // Read-only connection reused across requests (do NOT use openDb() — it writes/creates).
  const db = options.apiKey ? new DatabaseSync(options.dbPath, { readOnly: true }) : null;

  return (req, res) => {
    if (!options.apiKey || !db) {
      res.status(503).send("audit dashboard disabled: set AUDIT_API_KEY");
      return;
    }
    // ponytail: plain compare, local-only dashboard; ?key= is a browser-pagination convenience.
    const provided = req.header("x-api-key") ?? (typeof req.query.key === "string" ? req.query.key : "");
    if (provided !== options.apiKey) {
      res.status(401).send("unauthorized");
      return;
    }

    const q = (name: string): string | undefined =>
      typeof req.query[name] === "string" ? (req.query[name] as string) : undefined;
    const rawFrom = q("from") || undefined; // empty form field -> no bound
    const rawTo = q("to") || undefined;
    const format = q("format");

    const bounds = dateBounds(rawFrom, rawTo);
    if (!bounds) {
      res.status(400).send("invalid from/to — use YYYY-MM-DD or an ISO timestamp");
      return;
    }
    if (format !== undefined && format !== "csv" && format !== "json") {
      res.status(400).send("invalid format — use csv or json");
      return;
    }

    const where: string[] = [];
    const params: string[] = [];
    if (bounds.from) { where.push("ts >= ?"); params.push(bounds.from); }
    if (bounds.to) { where.push("ts <= ?"); params.push(bounds.to); }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    // ponytail: statements prepared per request — SQLite-scale traffic; cache if a profile ever cares.
    const selectAll = `SELECT * FROM transactions${whereSql} ORDER BY id DESC`;

    if (format) {
      // ponytail: full filtered set in memory — stream it if the log ever outgrows SQLite scale.
      const rows = db.prepare(selectAll).all(...params) as unknown as Row[];
      res.setHeader("Content-Disposition", `attachment; filename="${exportFilename(format, rawFrom, rawTo)}"`);
      if (format === "csv") res.type("text/csv; charset=utf-8").send(toCsv(rows));
      else res.json(rows.map((r) => ({ ...r, mica_compliant: !!r.mica_compliant })));
      return;
    }

    const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);
    const total = (db.prepare(`SELECT count(*) AS c FROM transactions${whereSql}`).get(...params) as { c: number }).c;
    const rows = db.prepare(`${selectAll} LIMIT ? OFFSET ?`).all(...params, pageSize, page * pageSize) as unknown as Row[];

    res.type("html").send(renderPage(rows, page, pageSize, total, options.apiKey, rawFrom, rawTo));
  };
}
```

- [ ] **Step 2: Typecheck + tests**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.ts
git commit -m "Add CSV/JSON export and date filter to audit dashboard"
```

---

### Task 3: Docs + manual smoke test

**Files:**
- Modify: `README.md` — extend the "Audit dashboard" section:

```md
The same route also exports the log: `?format=csv` or `?format=json`, optionally
filtered with inclusive `?from=YYYY-MM-DD&to=YYYY-MM-DD`. The HTML view has the
same date filter and download links. Example — Q2 as CSV:

    curl -H "x-api-key: $AUDIT_API_KEY" -OJ \
      "http://localhost:3000/audit?format=csv&from=2026-04-01&to=2026-06-30"
```

- Modify: `CLAUDE.md` — extend the `src/dashboard.ts` layout line with: "; CSV/JSON export (`?format=`, RFC 4180 + formula-injection guard) with inclusive `?from=`/`?to=` date filter shared by the HTML view".

- [ ] **Step 1: Make both edits**
- [ ] **Step 2: Smoke test against the running demo server** (AUDIT_API_KEY must be set in `.env`; set one temporarily if empty):

```powershell
npm run dev   # background
# HTML with filter (expect 200, <form ... type="date")
curl.exe -s -H "x-api-key: $env:KEY" "http://localhost:3000/audit?from=2026-07-01"
# CSV download (expect header line + rows incl. the EURC row; Content-Disposition attachment)
curl.exe -si -H "x-api-key: $env:KEY" "http://localhost:3000/audit?format=csv&from=2026-07-01&to=2026-07-06"
# JSON (expect boolean mica_compliant)
curl.exe -s -H "x-api-key: $env:KEY" "http://localhost:3000/audit?format=json"
# 400s
curl.exe -s -o NUL -w "%{http_code}" -H "x-api-key: $env:KEY" "http://localhost:3000/audit?format=xlsx"
curl.exe -s -o NUL -w "%{http_code}" -H "x-api-key: $env:KEY" "http://localhost:3000/audit?from=junk"
# 401 without key
curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/audit?format=csv"
```

Expected: 200/200/200, then 400, 400, 401. CSV includes the Sepolia EURC row (`2026-07-06T05:12:33.006Z,…,EURC,0.01,…,1`).

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "Document audit export endpoints"
```

---

## Self-review (done at write time)

- Spec coverage: date filter shared HTML+export ✔ (T2), CSV RFC 4180 + guard ✔ (T1), JSON boolean ✔ (T2), attachment filename ✔ (T1/T2), unpaginated export ✔ (T2), form UI + pager/download links carry from/to ✔ (T2), 400/401/503 ✔ (T2 + smoke), unit tests ✔ (T1), manual smoke ✔ (T3).
- No placeholders (the one elided block in T2's `renderPage` is explicitly "unchanged today's skeleton" with the exact additions listed).
- Type consistency: `dateBounds`/`toCsv`/`exportFilename` signatures match between T1 and T2.
