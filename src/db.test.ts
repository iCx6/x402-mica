import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, logTransaction, tryLogTransaction } from "./db.js";

const dir = mkdtempSync(join(tmpdir(), "x402-mica-db-test-"));
const dbPath = join(dir, "audit.db");

const row = {
  ts: "2026-07-14T00:00:00.000Z",
  network: "eip155:8453",
  asset: "USDC",
  amount: "$0.001",
  payer: "0xP",
  txRef: "0xT",
  micaCompliant: true,
};

// openDb sets a busy_timeout so a cross-process lock waits instead of throwing
{
  const db = openDb(dbPath);
  const { timeout } = db.prepare("PRAGMA busy_timeout").get() as { timeout: number };
  assert.equal(timeout, 5000);

  // tryLogTransaction: success path actually writes the row (guard must not swallow writes)
  tryLogTransaction(db, row);
  const { c } = db.prepare("SELECT count(*) AS c FROM transactions").get() as { c: number };
  assert.equal(c, 1);

  // null row (failed settlement) is a no-op
  tryLogTransaction(db, null);
  assert.equal((db.prepare("SELECT count(*) AS c FROM transactions").get() as { c: number }).c, 1);

  // a DB failure must never throw — an audit-log failure can't be allowed to crash
  // a server that has already taken payment (logTransaction on a closed db throws)
  db.close();
  assert.throws(() => logTransaction(db, row));

  // ...and the failure line must be greppable/alertable AND carry the full row +
  // underlying error, so the lost regulatory record can be reconstructed from logs.
  const logged: unknown[][] = [];
  const origError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    tryLogTransaction(db, row); // must not throw
  } finally {
    console.error = origError;
  }
  const line = logged.flat().map(String).join(" ");
  assert.match(line, /AUDIT_WRITE_FAILED/); // stable grep token
  assert.match(line, /"txRef":"0xT"/); // full row payload...
  assert.match(line, /"payer":"0xP"/);
  assert.match(line, /"amount":"\$0\.001"/);
  assert.match(line, /database is not open/); // ...plus the underlying error
}

rmSync(dir, { recursive: true, force: true });
console.log("db.test.ts: all assertions passed");
