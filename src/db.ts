import { DatabaseSync } from "node:sqlite";
import type { AuditRow } from "./audit.js";

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  // Same-process writers can't contend (synchronous autocommit statements only),
  // but a cross-process lock (e.g. a debug sqlite3 CLI on the deploy volume) would
  // otherwise throw SQLITE_BUSY immediately instead of waiting.
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    network TEXT NOT NULL,
    asset TEXT NOT NULL,
    amount TEXT NOT NULL,
    payer TEXT NOT NULL,
    tx_ref TEXT NOT NULL,
    mica_compliant INTEGER NOT NULL
  )`);
  try {
    // One settlement tx = one logical purchase = one audit row; a second insert
    // with the same tx_ref is a replayed audit hook, not a new payment. Partial:
    // tx_ref can legitimately be "" (settlement response without a tx hash).
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_tx_ref
      ON transactions(tx_ref) WHERE tx_ref != ''`);
  } catch (err) {
    // A legacy db that already holds duplicate tx_refs must degrade to "no unique
    // index", not "server won't start" — a consumer that can't boot audits nothing.
    console.error("x402-mica: could not create unique tx_ref index (duplicate legacy rows?):", err);
  }
  return db;
}

// OR IGNORE: a unique-index hit means this settlement is already audited — skip
// silently instead of erroring (the caller can't tell a replay from a new row).
const insert = `INSERT OR IGNORE INTO transactions (ts, network, asset, amount, payer, tx_ref, mica_compliant)
  VALUES (@ts, @network, @asset, @amount, @payer, @txRef, @mica)`;

export function logTransaction(db: DatabaseSync, row: AuditRow): void {
  db.prepare(insert).run({
    ts: row.ts,
    network: row.network,
    asset: row.asset,
    amount: row.amount,
    payer: row.payer,
    txRef: row.txRef,
    mica: row.micaCompliant ? 1 : 0,
  });
}

/**
 * `logTransaction` that never throws (logs the error instead). The middleware/MCP
 * audit hooks run after the payment has settled — a failing audit write (full disk,
 * locked db) must not crash a server that has already taken the payer's money.
 */
export function tryLogTransaction(db: DatabaseSync, row: AuditRow | null): void {
  if (!row) return;
  try {
    logTransaction(db, row);
  } catch (err) {
    // Greppable/alertable token + the full row: a lost audit row is a missing
    // regulatory record, so the log line must carry enough to reconstruct it.
    console.error(
      `x402-mica AUDIT_WRITE_FAILED (payment already settled) row=${JSON.stringify(row)}`,
      err,
    );
  }
}
