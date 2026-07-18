// Audit-hook lifecycle tests for x402Middleware, network-free: the fake requests
// target a non-gated path, so @x402/express passes straight through (no facilitator
// call) while still attaching our audit listeners to the fake res. Settlement is
// simulated by pre-setting the PAYMENT-RESPONSE header the real settle step writes.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { x402Middleware } from "./x402-middleware.js";

const b64 = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString("base64");

const dir = mkdtempSync(join(tmpdir(), "x402-mica-mw-test-"));
const dbPath = join(dir, "audit.db");

const mw = x402Middleware({
  route: "GET /demo",
  price: "$0.001",
  network: "eip155:84532",
  payTo: "0x0000000000000000000000000000000000000001",
  dbPath,
});

/** Run one fake request through the middleware, then fire the given res events. */
function run(settleHeader: string | undefined, events: string[]): Promise<void> {
  const req = { path: "/not-gated", method: "GET", header: () => undefined };
  const res = Object.assign(new EventEmitter(), {
    getHeader: (name: string) => (name === "PAYMENT-RESPONSE" ? settleHeader : undefined),
  });
  return new Promise((resolve) => {
    mw(req as never, res as never, () => {
      for (const e of events) res.emit(e);
      resolve();
    });
  });
}

const countByTxRef = (txRef: string): number => {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const { c } = db
    .prepare("SELECT count(*) AS c FROM transactions WHERE tx_ref = ?")
    .get(txRef) as { c: number };
  db.close();
  return c;
};

const settle = (txRef: string) =>
  b64({ success: true, transaction: txRef, network: "eip155:84532", payer: "0xPAYER" });

// No settlement double-write may masquerade as a write failure — watch for alerts throughout.
const alerts: string[] = [];
const origError = console.error;
console.error = (...args: unknown[]) => { alerts.push(args.map(String).join(" ")); };
try {
  // (a) client abort after settle: "finish" never fires, only "close" — row must still be written
  await run(settle("0xABORTED"), ["close"]);
  assert.equal(countByTxRef("0xABORTED"), 1, "close-only (client abort) must still write the audit row");

  // (b) normal delivery: "finish" then "close" both fire — exactly one row, no error.
  // txRef "" bypasses the partial unique index, so this proves the once-flag alone dedupes.
  await run(settle(""), ["finish", "close"]);
  assert.equal(countByTxRef(""), 1, "finish+close must write exactly once");

  // unpaid request (no settlement header): no row, on either event
  await run(undefined, ["finish", "close"]);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const { c } = db.prepare("SELECT count(*) AS c FROM transactions").get() as { c: number };
  db.close();
  assert.equal(c, 2, "unpaid requests must not log audit rows");
} finally {
  console.error = origError;
}
assert.deepEqual(alerts, [], "no audit write may fail or double-fire an alert");

// Best-effort: the middleware keeps its db connection open by design, and Windows
// won't unlink an open file — leaking one temp dir beats a false test failure.
try {
  rmSync(dir, { recursive: true, force: true });
} catch {}
console.log("x402-middleware.test.ts: all assertions passed");
