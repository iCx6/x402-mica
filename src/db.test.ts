import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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

// One logical purchase = one audit row: a duplicate settlement tx_ref (double-fired
// audit hook) is silently ignored, never re-inserted and never an error.
{
  const db = openDb(dbPath); // reopen — the earlier block wrote txRef "0xT" then closed
  const count = () => (db.prepare("SELECT count(*) AS c FROM transactions").get() as { c: number }).c;

  logTransaction(db, row); // same txRef "0xT" — no-op, not a throw
  assert.equal(count(), 1);
  logTransaction(db, { ...row, txRef: "0xT2" }); // new settlement — inserts
  assert.equal(count(), 2);

  // rows without a tx hash can't be correlated to a settlement — the partial
  // index must NOT collapse them into one
  logTransaction(db, { ...row, txRef: "" });
  logTransaction(db, { ...row, txRef: "" });
  assert.equal(count(), 4);

  // tryLogTransaction on a duplicate: "already audited", NOT an AUDIT_WRITE_FAILED alert
  const logged: unknown[][] = [];
  const origError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    tryLogTransaction(db, row);
  } finally {
    console.error = origError;
  }
  assert.equal(logged.length, 0, "duplicate insert must not raise an audit-failure alert");
  assert.equal(count(), 4);
  db.close();
}

// A legacy db that already holds duplicate tx_refs (written before the index
// existed) must degrade to "no unique index", never crash openDb at startup —
// a consumer that won't boot logs NO audit rows at all (the 0.2.1 lesson).
{
  const legacyPath = join(dir, "legacy.db");
  const raw = new DatabaseSync(legacyPath);
  raw.exec(`CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL, network TEXT NOT NULL, asset TEXT NOT NULL, amount TEXT NOT NULL,
    payer TEXT NOT NULL, tx_ref TEXT NOT NULL, mica_compliant INTEGER NOT NULL
  )`);
  const dup = `INSERT INTO transactions (ts, network, asset, amount, payer, tx_ref, mica_compliant)
    VALUES ('t', 'n', 'USDC', '$0.001', '0xP', '0xDUP', 1)`;
  raw.exec(dup);
  raw.exec(dup);
  raw.close();

  const origError = console.error;
  console.error = () => {}; // silence the expected degradation warning
  let db: DatabaseSync;
  try {
    db = openDb(legacyPath); // must not throw
  } finally {
    console.error = origError;
  }
  logTransaction(db, row); // and must still accept writes
  assert.equal((db.prepare("SELECT count(*) AS c FROM transactions").get() as { c: number }).c, 3);
  db.close();
}

rmSync(dir, { recursive: true, force: true });
console.log("db.test.ts: all assertions passed");
